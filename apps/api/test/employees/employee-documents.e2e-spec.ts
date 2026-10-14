import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { FilesService } from '../../src/common/files/files.service.js';
import { runInCompany } from '../../src/common/tenancy/tenant-context.js';
import sharp from 'sharp';
import { MAX_FILE_BYTES } from '@mdarj/shared';
import { AuditService } from '../../src/common/audit/audit.service.js';

describe('Employee documents (SCRUM-53)', () => {
  let app: INestApplication<App>;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  let prisma: PrismaService;
  let files: FilesService;

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
  }, 30000);

  afterAll(async () => {
    for (const company of [r, other]) {
      const documents = await prisma.document.findMany({
        where: { companyId: company.companyId },
        select: { fileKey: true },
      });

      await runInCompany(company.companyId, async () => {
        for (const document of documents) {
          await files.remove(document.fileKey);
        }
      });

      await prisma.document.deleteMany({
        where: { companyId: company.companyId },
      });

      await company.cleanup();
    }

    await app.close();
  });

  it('returns an empty list for an employee without documents', async () => {
    const response = await r.admin
      .get(`/employees/${r.ownEmployeeId}/documents`)
      .expect(200);

    expect(response.body).toEqual({ items: [] });
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('allows own documents and rejects unauthorized access', async () => {
    await r.employee
      .get(`/employees/${r.ownEmployeeId}/documents`)
      .expect(200, { items: [] });

    await r.employee
      .get(`/employees/${r.otherEmployeeId}/documents`)
      .expect(403);

    await r.interviewer
      .get(`/employees/${r.ownEmployeeId}/documents`)
      .expect(403);

    await r
      .anonymous()
      .get(`/employees/${r.ownEmployeeId}/documents`)
      .expect(401);
  });

  it('hides employees belonging to another company', async () => {
    await other.admin
      .get(`/employees/${r.ownEmployeeId}/documents`)
      .expect(404);
  });
  it('uploads a document, lists it, and records an audit entry', async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#3961a8',
      },
    })
      .png()
      .toBuffer();

    const response = await r.admin
      .post(`/employees/${r.ownEmployeeId}/documents`)
      .field('docType', 'Certificate')
      .field('expiryDate', '2027-04-01')
      .attach('file', png, {
        filename: 'certificate.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      docType: 'Certificate',
      expiryDate: '2027-04-01',
      createdAt: expect.any(String),
    });

    const document = await prisma.document.findUniqueOrThrow({
      where: { id: response.body.id },
    });

    expect(document.employeeId).toBe(r.ownEmployeeId);
    expect(document.companyId).toBe(r.companyId);
    expect(document.fileKey).toMatch(new RegExp(`^companies/${r.companyId}/`));

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        entityType: 'document',
        entityId: document.id,
        action: 'create',
      },
    });

    expect(audit.employeeId).toBe(r.ownEmployeeId);
    expect(audit.after).toEqual(response.body);

    const list = await r.admin
      .get(`/employees/${r.ownEmployeeId}/documents`)
      .expect(200);

    expect(list.body.items).toContainEqual(response.body);
    const path = `/employees/${r.ownEmployeeId}/documents/${document.id}/file`;
    const link = await r.admin.get(path).expect(200);
    expect(link.headers['cache-control']).toBe('private, no-store');
    const ttl = Date.parse(link.body.expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300000);
    const downloaded = await fetch(link.body.url);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(png)).toBe(true);
    await r.employee.get(path).expect(200);
    await r.interviewer.get(path).expect(403);
    await r.anonymous().get(path).expect(401);
    await other.admin.get(path).expect(404);
    await r.admin
      .get(`/employees/${r.otherEmployeeId}/documents/${document.id}/file`)
      .expect(404);
    await r.employee
      .get(`/employees/${r.otherEmployeeId}/documents/${document.id}/file`)
      .expect(403);
  });
  it('rejects an upload without a file', async () => {
    await r.admin
      .post(`/employees/${r.ownEmployeeId}/documents`)
      .field('docType', 'Certificate')
      .expect(400);
  });

  it('rejects a file disguised as a PDF', async () => {
    await r.admin
      .post(`/employees/${r.ownEmployeeId}/documents`)
      .field('docType', 'Certificate')
      .attach('file', Buffer.from('This is plain text'), {
        filename: 'certificate.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
  });

  it('restricts uploading to Admins', async () => {
    const path = `/employees/${r.ownEmployeeId}/documents`;

    await r.employee.post(path).field('docType', 'Certificate').expect(403);

    await r.interviewer.post(path).field('docType', 'Certificate').expect(403);

    await r.anonymous().post(path).field('docType', 'Certificate').expect(401);
  });
  it('rejects files larger than the upload limit', async () => {
    const oversized = Buffer.alloc(MAX_FILE_BYTES + 1);
    oversized.write('%PDF-');

    await r.admin
      .post(`/employees/${r.ownEmployeeId}/documents`)
      .field('docType', 'Certificate')
      .attach('file', oversized, {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
  });

  it('rejects uploads to another company’s employee', async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#3961a8',
      },
    })
      .png()
      .toBuffer();

    await other.admin
      .post(`/employees/${r.ownEmployeeId}/documents`)
      .field('docType', 'Certificate')
      .attach('file', png, {
        filename: 'certificate.png',
        contentType: 'image/png',
      })
      .expect(404);
  });

  it('validates document metadata before storing a file', async () => {
    const before = await prisma.document.count({
      where: { companyId: r.companyId },
    });
    for (const fields of [
      { docType: '   ', expiryDate: '' },
      { docType: 'Certificate', expiryDate: '2027-02-30' },
      { docType: 'x'.repeat(101), expiryDate: '' },
    ]) {
      await r.admin
        .post(`/employees/${r.ownEmployeeId}/documents`)
        .field(fields)
        .expect(400);
    }
    expect(
      await prisma.document.count({ where: { companyId: r.companyId } }),
    ).toBe(before);
  });

  it('accepts PDF uploads through the shared signature validator', async () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const response = await r.admin
      .post(`/employees/${r.ownEmployeeId}/documents`)
      .field('docType', 'PDF certificate')
      .attach('file', pdf, {
        filename: 'certificate.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const link = await r.admin
      .get(`/employees/${r.ownEmployeeId}/documents/${response.body.id}/file`)
      .expect(200);
    const downloaded = await fetch(link.body.url);
    expect(downloaded.headers.get('content-type')).toBe('application/pdf');
    expect(downloaded.headers.get('content-disposition')).toBe('attachment');
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(pdf)).toBe(true);
  });

  it('accepts a JPEG without expiry and trims the document type', async () => {
    const jpeg = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#3961a8' },
    })
      .jpeg()
      .toBuffer();
    const response = await r.admin
      .post(`/employees/${r.ownEmployeeId}/documents`)
      .field('docType', ' Certificate ')
      .field('expiryDate', '')
      .attach('file', jpeg, {
        filename: 'certificate.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    expect(response.body.docType).toBe('Certificate');
    expect(response.body.expiryDate).toBeNull();
    expect(response.body).not.toHaveProperty('fileKey');
  });

  it('rolls back a failed upload audit and removes its stored file', async () => {
    const before = await prisma.document.count({
      where: { companyId: r.companyId },
    });
    const uploaded = vi.spyOn(files, 'upload');
    const removed = vi.spyOn(files, 'remove');
    const audit = vi
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('Test audit failure'));
    try {
      const png = await sharp({
        create: { width: 16, height: 16, channels: 3, background: '#3961a8' },
      })
        .png()
        .toBuffer();
      await r.admin
        .post(`/employees/${r.ownEmployeeId}/documents`)
        .field('docType', 'Rollback')
        .attach('file', png, { filename: 'x.png', contentType: 'image/png' })
        .expect(500);
      const key = await uploaded.mock.results[0].value;
      expect(removed).toHaveBeenCalledWith(key);
      expect(
        await prisma.document.count({ where: { companyId: r.companyId } }),
      ).toBe(before);
      await expect(
        runInCompany(r.companyId, () => files.signedDownload(key)),
      ).rejects.toThrow();
    } finally {
      uploaded.mockRestore();
      removed.mockRestore();
      audit.mockRestore();
    }
  });

  it('restricts deletion to Admins and checks the document owner', async () => {
    const document = await prisma.document.findFirstOrThrow({
      where: { employeeId: r.ownEmployeeId },
    });
    const path = `/employees/${r.ownEmployeeId}/documents/${document.id}`;
    await r.employee.delete(path).expect(403);
    await r.interviewer.delete(path).expect(403);
    await r.anonymous().delete(path).expect(401);
    await other.admin.delete(path).expect(404);
    await r.admin
      .delete(`/employees/${r.otherEmployeeId}/documents/${document.id}`)
      .expect(404);
    expect(
      await prisma.document.findUnique({ where: { id: document.id } }),
    ).not.toBeNull();
  });

  it('keeps the document and file when its deletion audit fails', async () => {
    const document = await prisma.document.findFirstOrThrow({
      where: { employeeId: r.ownEmployeeId },
    });
    const audit = vi
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('Test audit failure'));
    try {
      await r.admin
        .delete(`/employees/${r.ownEmployeeId}/documents/${document.id}`)
        .expect(500);
      expect(
        await prisma.document.findUnique({ where: { id: document.id } }),
      ).not.toBeNull();
      await runInCompany(r.companyId, () =>
        files.signedDownload(document.fileKey),
      );
    } finally {
      audit.mockRestore();
    }
  });

  it('deletes a document, audits it, and removes the stored file', async () => {
    const document = await prisma.document.findFirstOrThrow({
      where: { employeeId: r.ownEmployeeId },
    });
    const path = `/employees/${r.ownEmployeeId}/documents/${document.id}`;
    await r.admin.delete(path).expect(204);
    expect(
      await prisma.document.findUnique({ where: { id: document.id } }),
    ).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        entityId: document.id,
        entityType: 'document',
        action: 'delete',
      },
    });
    expect(audit.employeeId).toBe(r.ownEmployeeId);
    expect(audit.before).toMatchObject({ docType: document.docType });
    const list = await r.admin
      .get(`/employees/${r.ownEmployeeId}/documents`)
      .expect(200);
    expect(
      list.body.items.some((row: { id: string }) => row.id === document.id),
    ).toBe(false);
    await r.admin.get(`${path}/file`).expect(404);
    await r.admin.delete(path).expect(404);
    await expect(
      runInCompany(r.companyId, () => files.signedDownload(document.fileKey)),
    ).rejects.toThrow();
  });

  it('rejects malformed ids and missing documents', async () => {
    await r.admin.get('/employees/not-a-uuid/documents').expect(400);
    await r.admin
      .get(`/employees/${r.ownEmployeeId}/documents/not-a-uuid/file`)
      .expect(400);
    await r.admin
      .get(
        `/employees/${r.ownEmployeeId}/documents/00000000-0000-4000-8000-000000000000/file`,
      )
      .expect(404);
  });
});
