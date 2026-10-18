import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import type { AuthContext } from '../auth/auth-context.js';
import { assertOwnEmployee } from '../auth/own-data.js';
import { AuditService } from '../common/audit/audit.service.js';
import { FilesService } from '../common/files/files.service.js';
import {
  validateFile,
  type UploadedFile,
} from '../common/files/file-upload.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service.js';

@Injectable()
export class EmployeePhotoService {
  private readonly logger = new Logger(EmployeePhotoService.name);
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  private async employee(id: string) {
    const employee = await this.tenant.db.employee.findUnique({
      where: { id },
      select: { id: true, photo: true },
    });
    if (!employee) throw new NotFoundException({ message: 'notFound' });
    return employee;
  }

  async read(auth: AuthContext, id: string) {
    const employee = await this.employee(id);
    assertOwnEmployee(auth, employee.id);
    if (!employee.photo) throw new NotFoundException({ message: 'notFound' });
    return this.files.signedDownload(employee.photo, 'inline');
  }

  /** Decode instead of trusting a signature alone; bound pixels, correct EXIF orientation, strip metadata. */
  async upload(auth: AuthContext, id: string, file: UploadedFile | undefined) {
    const employee = await this.employee(id);
    const { mimeType } = validateFile(file);
    if (!['image/png', 'image/jpeg'].includes(mimeType))
      throw this.invalidPhoto();
    let buffer: Buffer;
    try {
      buffer = await sharp(file!.buffer, {
        limitInputPixels: 25_000_000,
        failOn: 'warning',
      })
        .rotate()
        .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw this.invalidPhoto();
    }
    const key = await this.files.upload({ buffer, mimetype: 'image/jpeg' });
    try {
      await this.save(auth, employee.id, employee.photo, key);
    } catch (error) {
      await this.cleanup(key);
      throw error;
    }
    if (employee.photo) await this.cleanup(employee.photo);
    return { hasPhoto: true };
  }

  async remove(auth: AuthContext, id: string) {
    const employee = await this.employee(id);
    if (!employee.photo) return;
    await this.save(auth, employee.id, employee.photo, null);
    await this.cleanup(employee.photo);
  }

  private invalidPhoto() {
    return new BadRequestException({
      message: 'validationFailed',
      errors: { file: 'photoInvalid' },
    });
  }

  private async save(
    auth: AuthContext,
    id: string,
    before: string | null,
    after: string | null,
  ) {
    await this.tenant.db.$transaction(async (tx) => {
      const result = await tx.employee.updateMany({
        where: { id, photo: before },
        data: { photo: after },
      });
      if (result.count !== 1)
        throw new ConflictException({ message: 'conflict' });
      await this.audit.record(tx, auth.userId, {
        entityType: 'employee',
        entityId: id,
        employeeId: id,
        action: 'update',
        before: { photo: before },
        after: { photo: after },
        reason: 'Profile photo',
      });
    });
  }

  private async cleanup(key: string) {
    try {
      await this.files.remove(key);
    } catch {
      this.logger.warn(
        'Photo object cleanup failed; metadata remains authoritative.',
      );
    }
  }
}
