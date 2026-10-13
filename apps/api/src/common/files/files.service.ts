import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireCompanyId } from '../tenancy/tenant-context.js';
import { validateFile, type UploadedFile } from './file-upload.js';
import { storageConfig } from './storage-config.js';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY_PATTERN = new RegExp(`^companies/(${UUID})/${UUID}\\.(pdf|jpg|png)$`);

/** Internal foundation service. Feature routes must check record/role/own access before signing. */
@Injectable()
export class FilesService implements OnModuleDestroy {
  private storage?: ReturnType<typeof storageConfig>;
  constructor(private readonly config: ConfigService) {}

  private connection() {
    return (this.storage ??= storageConfig(this.config));
  }

  private companyKey(key: string) {
    const companyId = requireCompanyId();
    if (KEY_PATTERN.exec(key)?.[1] !== companyId)
      throw new NotFoundException({ message: 'notFound' });
  }

  /** Stores a validated file privately, returning only a key for the feature's database row. */
  async upload(file: UploadedFile | undefined): Promise<string> {
    const companyId = requireCompanyId();
    if (!new RegExp(`^${UUID}$`).test(companyId))
      throw new Error('Invalid company context');
    const { mimeType, extension } = validateFile(file);
    const key = `companies/${companyId}/${randomUUID()}.${extension}`;
    const { client, bucket } = this.connection();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file!.buffer,
        ContentType: mimeType,
        ContentDisposition: 'attachment',
        CacheControl: 'private, no-store',
      }),
    );
    return key;
  }

  /** Caller loads the owning record through TenantPrismaService, then enforces its permissions. */
  async signedDownload(
    key: string,
    disposition: 'attachment' | 'inline' = 'attachment',
  ): Promise<{ url: string; expiresAt: string }> {
    this.companyKey(key);
    const { client, bucket, ttl } = this.connection();
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      if (
        error instanceof Error &&
        'name' in error &&
        ['NotFound', 'NoSuchKey'].includes(error.name)
      )
        throw new NotFoundException({ message: 'notFound' });
      throw error;
    }
    const signingDate = new Date();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseCacheControl: 'private, no-store',
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: ttl, signingDate },
    );
    return {
      url,
      expiresAt: new Date(signingDate.getTime() + ttl * 1000).toISOString(),
    };
  }

  /** Used for rollback when saving metadata fails, or after an authorized replacement/deletion. */
  async remove(key: string): Promise<void> {
    this.companyKey(key);
    const { client, bucket } = this.connection();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  onModuleDestroy() {
    this.storage?.client.destroy();
  }
}
