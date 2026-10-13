// FND-06: exercises the real S3 server, plus multipart limits and global auth/role guards.
// Test-only HTTP adapter: business features add record/own checks; no generic route ships.
import { randomUUID } from 'node:crypto';
import {
  Controller,
  Inject,
  Get,
  Module,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FileInterceptor } from '@nestjs/platform-express';
import type { App } from 'supertest/types.js';
import { MAX_FILE_BYTES } from '@mdarj/shared';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { Roles } from '../../src/auth/roles.decorator.js';
import { FILE_UPLOAD_OPTIONS } from '../../src/common/files/file-upload.js';
import { FilesService } from '../../src/common/files/files.service.js';
import { runInCompany } from '../../src/common/tenancy/tenant-context.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

@Controller('files-test')
@Roles('admin')
class FileTestController {
  constructor(@Inject(FilesService) private readonly files: FilesService) {}
  @Post()
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_OPTIONS))
  async upload(@UploadedFile() file: Express.Multer.File | undefined) {
    return { key: await this.files.upload(file) };
  }
  @Get('link')
  link(@Query('key') key: string) {
    return this.files.signedDownload(key);
  }
}
@Module({ imports: [AppModule], controllers: [FileTestController] })
class FileTestModule {}

describe('Private S3 files (SCRUM-25)', () => {
  let app: INestApplication<App>;
  let roles: RoleBrowsers;
  let other: RoleBrowsers;
  let files: FilesService;
  let expiryFiles: FilesService;
  const keys: string[] = [];
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=',
    'base64',
  );
  const jpeg = Buffer.from([
    255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    255, 217,
  ]);

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [FileTestModule],
    }).compile();
    app = ref.createNestApplication();
    setupApp(app);
    await app.init();
    roles = await setupRoleBrowsers(app);
    other = await setupRoleBrowsers(app);
    files = app.get(FilesService);
    const config = app.get(ConfigService);
    expiryFiles = new FilesService(
      new ConfigService(
        Object.fromEntries(
          [
            'S3_ENDPOINT',
            'S3_REGION',
            'S3_BUCKET',
            'S3_ACCESS_KEY_ID',
            'S3_SECRET_ACCESS_KEY',
            'S3_FORCE_PATH_STYLE',
          ]
            .map((key) => [key, config.get(key)])
            .concat([['S3_LINK_TTL_SECONDS', '1']]),
        ),
      ),
    );
  }, 30000);

  afterAll(async () => {
    if (roles) {
      await runInCompany(roles.companyId, async () => {
        for (const key of keys) await files.remove(key);
      });
      await roles.cleanup();
    }
    if (other) await other.cleanup();
    expiryFiles?.onModuleDestroy();
    await app?.close();
  });

  it.each([
    ['application/pdf', pdf, 'pdf'],
    ['image/png', png, 'png'],
    ['image/jpeg', jpeg, 'jpg'],
  ])(
    'stores %s privately and opens it through a short-lived signed link',
    async (mime, body, extension) => {
      const uploaded = await roles.admin
        .post('/files-test')
        .attach('file', body as Buffer, {
          filename: '../../private-name',
          contentType: mime as string,
        })
        .expect(201);
      const key: string = uploaded.body.key;
      keys.push(key);
      expect(key).toMatch(
        new RegExp(`^companies/${roles.companyId}/[0-9a-f-]+\\.${extension}$`),
      );
      const link = await roles.admin
        .get('/files-test/link')
        .query({ key })
        .expect(200);
      const url = new URL(link.body.url);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
      expect(Date.parse(link.body.expiresAt) - Date.now()).toBeGreaterThan(
        290000,
      );
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(body);
      expect(response.headers.get('content-type')).toBe(mime);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect((await fetch(new URL(url.pathname, url.origin))).status).toBe(403);
      url.searchParams.set('X-Amz-Signature', '0'.repeat(64));
      expect((await fetch(url)).status).toBe(403);
    },
  );

  it('requires login and Admin role at the adapter', async () => {
    await roles
      .anonymous()
      .post('/files-test')
      .attach('file', pdf, {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);
    await roles.employee
      .post('/files-test')
      .attach('file', pdf, {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);
    await roles.interviewer
      .get('/files-test/link')
      .query({ key: keys[0] })
      .expect(403);
  });

  it('refuses another company, malformed paths, missing objects and no company context', async () => {
    await other.admin
      .get('/files-test/link')
      .query({ key: keys[0] })
      .expect(404);
    for (const key of [
      `${keys[0]}/../x.pdf`,
      keys[0].replace('companies/', ''),
      `companies/${roles.companyId}/${randomUUID()}.pdf`,
    ]) {
      await roles.admin.get('/files-test/link').query({ key }).expect(404);
    }
    await expect(files.signedDownload(keys[0])).rejects.toThrow(
      'No company context',
    );
    await expect(
      runInCompany(other.companyId, () => files.remove(keys[0])),
    ).rejects.toThrow();
    // The foreign deletion attempt left the original usable.
    await roles.admin
      .get('/files-test/link')
      .query({ key: keys[0] })
      .expect(200);
  });

  it('rejects wrong MIME, disguised content, empty files and >10 MiB through multipart', async () => {
    for (const [buffer, mime] of [
      [pdf, 'text/plain'],
      [Buffer.from('not a PDF'), 'application/pdf'],
      [Buffer.alloc(0), 'image/png'],
    ] as const) {
      const response = await roles.admin
        .post('/files-test')
        .attach('file', buffer, { filename: 'x.pdf', contentType: mime })
        .expect(400);
      expect(response.body.errors.file).toBeTruthy();
    }
    await roles.admin
      .post('/files-test')
      .attach('file', Buffer.alloc(MAX_FILE_BYTES + 1), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
  });

  it('expires a real signed link and can delete an authorized object', async () => {
    const link = await runInCompany(roles.companyId, () =>
      expiryFiles.signedDownload(keys[0]),
    );
    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect((await fetch(link.url)).status).toBe(403);
    const key = await runInCompany(roles.companyId, () =>
      files.upload({ buffer: pdf, mimetype: 'application/pdf' }),
    );
    keys.push(key);
    await runInCompany(roles.companyId, () => files.remove(key));
    await roles.admin.get('/files-test/link').query({ key }).expect(404);
  });
});
