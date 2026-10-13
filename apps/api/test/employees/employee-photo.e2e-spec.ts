import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import sharp from 'sharp';
import { MAX_FILE_BYTES } from '@mdarj/shared';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { FilesService } from '../../src/common/files/files.service.js';
import { AuditService } from '../../src/common/audit/audit.service.js';
import { runInCompany } from '../../src/common/tenancy/tenant-context.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Profile photo (SCRUM-49)', () => {
  let app: INestApplication<App>;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  let prisma: PrismaService;
  let files: FilesService;
  let png: Buffer;
  const keys: string[] = [];
  const upload = (id: string) =>
    r.admin
      .post(`/employees/${id}/photo`)
      .attach('file', png, { filename: 'photo.png', contentType: 'image/png' });

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = ref.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    files = app.get(FilesService);
    r = await setupRoleBrowsers(app);
    other = await setupRoleBrowsers(app);
    png = await sharp({
      create: { width: 96, height: 64, channels: 3, background: '#3961a8' },
    })
      .png()
      .toBuffer();
  }, 30000);
  afterAll(async () => {
    await runInCompany(r.companyId, async () => {
      for (const key of keys) await files.remove(key);
    });
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  it('uploads a decoded image, stores only its private key, and audits it', async () => {
    await upload(r.ownEmployeeId).expect(201, { hasPhoto: true });
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: r.ownEmployeeId },
    });
    keys.push(employee.photo!);
    expect(employee.photo).toMatch(
      new RegExp(`^companies/${r.companyId}/.*\\.jpg$`),
    );
    const profile = await r.admin
      .get(`/employees/${r.ownEmployeeId}`)
      .expect(200);
    expect(profile.body.hasPhoto).toBe(true);
    expect(profile.body).not.toHaveProperty('photo');
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'employee', employeeId: r.ownEmployeeId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.before).toEqual({ photo: null });
    expect(audit.after).toEqual({ photo: employee.photo });
    const link = await r.admin
      .get(`/employees/${r.ownEmployeeId}/photo`)
      .expect(200);
    expect(link.headers['cache-control']).toBe('private, no-store');
    const response = await fetch(link.body.url);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe('inline');
    const metadata = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.exif).toBeUndefined();
  });

  it('allows own-photo reads only, and Admin writes only, with foreign records hidden', async () => {
    await r.employee.get(`/employees/${r.ownEmployeeId}/photo`).expect(200);
    await r.employee.get(`/employees/${r.otherEmployeeId}/photo`).expect(403);
    await r.interviewer.get(`/employees/${r.ownEmployeeId}/photo`).expect(403);
    await other.admin.get(`/employees/${r.ownEmployeeId}/photo`).expect(404);
    await upload(other.ownEmployeeId).expect(404);
    await r.anonymous().get(`/employees/${r.ownEmployeeId}/photo`).expect(401);
    await r.employee
      .post(`/employees/${r.ownEmployeeId}/photo`)
      .attach('file', png, { filename: 'x.png', contentType: 'image/png' })
      .expect(403);
    await r.employee.delete(`/employees/${r.ownEmployeeId}/photo`).expect(403);
    await r.admin.get('/employees/not-a-uuid/photo').expect(400);
  });

  it('rejects PDFs, malformed images, absent/empty uploads and oversized files', async () => {
    for (const [buffer, mime] of [
      [Buffer.from('%PDF-1.7\n%%EOF'), 'application/pdf'],
      [Buffer.from([255, 216, 255]), 'image/jpeg'],
      [Buffer.alloc(0), 'image/png'],
    ] as const) {
      await r.admin
        .post(`/employees/${r.ownEmployeeId}/photo`)
        .attach('file', buffer, { filename: 'x', contentType: mime })
        .expect(400);
    }
    await r.admin.post(`/employees/${r.ownEmployeeId}/photo`).expect(400);
    await r.admin
      .post(`/employees/${r.ownEmployeeId}/photo`)
      .attach('file', Buffer.alloc(MAX_FILE_BYTES + 1), {
        filename: 'x.png',
        contentType: 'image/png',
      })
      .expect(413);
  });

  it('removes the new object if the metadata/audit transaction fails', async () => {
    const before = await prisma.employee.findUniqueOrThrow({
      where: { id: r.ownEmployeeId },
    });
    const uploadSpy = vi.spyOn(files, 'upload');
    const auditSpy = vi
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('test audit failure'));
    try {
      await upload(r.ownEmployeeId).expect(500);
      const key = (await uploadSpy.mock.results[0].value) as string;
      const unchanged = await prisma.employee.findUniqueOrThrow({
        where: { id: r.ownEmployeeId },
      });
      expect(unchanged.photo).toBe(before.photo);
      await expect(
        runInCompany(r.companyId, () => files.signedDownload(key)),
      ).rejects.toThrow();
    } finally {
      uploadSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });

  it('replaces and removes photos, cleans up old objects, and returns to initials', async () => {
    const old = keys[0];
    await upload(r.ownEmployeeId).expect(201);
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: r.ownEmployeeId },
    });
    keys.push(employee.photo!);
    expect(employee.photo).not.toBe(old);
    await expect(
      runInCompany(r.companyId, () => files.signedDownload(old)),
    ).rejects.toThrow();
    await r.admin.delete(`/employees/${r.ownEmployeeId}/photo`).expect(204);
    await r.admin.get(`/employees/${r.ownEmployeeId}/photo`).expect(404);
    const profile = await r.admin
      .get(`/employees/${r.ownEmployeeId}`)
      .expect(200);
    expect(profile.body.hasPhoto).toBe(false);
    await expect(
      runInCompany(r.companyId, () => files.signedDownload(employee.photo!)),
    ).rejects.toThrow();
    await r.admin.delete(`/employees/${r.ownEmployeeId}/photo`).expect(204);
  });
});
