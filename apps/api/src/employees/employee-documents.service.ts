import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { EmployeeDocumentList } from '@mdarj/shared';
import type { AuthContext } from '../auth/auth-context.js';
import { assertOwnEmployee } from '../auth/own-data.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service.js';
import { FilesService } from '../common/files/files.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import type { UploadEmployeeDocumentInput } from '@mdarj/shared';
import type { UploadedFile } from '../common/files/file-upload.js';
import { requireCompanyId } from '../common/tenancy/tenant-context.js';

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthContext,
    employeeId: string,
  ): Promise<EmployeeDocumentList> {
    const db = this.tenant.db;

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException({ message: 'notFound' });
    }

    assertOwnEmployee(auth, employee.id);

    const rows = await db.document.findMany({
      where: { employeeId: employee.id },
      select: {
        id: true,
        docType: true,
        expiryDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        docType: row.docType,
        expiryDate: row.expiryDate?.toISOString().slice(0, 10) ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
  async read(auth: AuthContext, employeeId: string, documentId: string) {
    const employee = await this.tenant.db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException({ message: 'notFound' });
    }

    assertOwnEmployee(auth, employee.id);

    const document = await this.tenant.db.document.findFirst({
      where: {
        id: documentId,
        employeeId: employee.id,
      },
      select: { fileKey: true },
    });

    if (!document) {
      throw new NotFoundException({ message: 'notFound' });
    }

    return this.files.signedDownload(document.fileKey);
  }

  async upload(
    auth: AuthContext,
    employeeId: string,
    input: UploadEmployeeDocumentInput,
    file: UploadedFile | undefined,
  ) {
    const employee = await this.tenant.db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException({ message: 'notFound' });
    }

    const fileKey = await this.files.upload(file);

    try {
      return await this.tenant.db.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employee.id,
            docType: input.docType,
            expiryDate: input.expiryDate
              ? new Date(`${input.expiryDate}T00:00:00Z`)
              : null,
            fileKey,
            uploadedById: auth.userId,
          },
        });

        const item = {
          id: document.id,
          docType: document.docType,
          expiryDate: document.expiryDate?.toISOString().slice(0, 10) ?? null,
          createdAt: document.createdAt.toISOString(),
        };

        await this.audit.record(tx, auth.userId, {
          entityType: 'document',
          entityId: document.id,
          employeeId: document.employeeId,
          action: 'create',
          after: item,
        });

        return item;
      });
    } catch (error) {
      try {
        await this.files.remove(fileKey);
      } catch {
        Logger.warn(
          'Document upload cleanup failed.',
          EmployeeDocumentsService.name,
        );
      }
      throw error;
    }
  }

  async remove(auth: AuthContext, employeeId: string, documentId: string) {
    const document = await this.tenant.db.$transaction(async (tx) => {
      const row = await tx.document.findFirst({
        where: { id: documentId, employeeId },
      });
      if (!row) throw new NotFoundException({ message: 'notFound' });
      await tx.document.delete({ where: { id: row.id } });
      await this.audit.record(tx, auth.userId, {
        entityType: 'document',
        entityId: row.id,
        employeeId: row.employeeId,
        action: 'delete',
        before: {
          id: row.id,
          docType: row.docType,
          expiryDate: row.expiryDate?.toISOString().slice(0, 10) ?? null,
          createdAt: row.createdAt.toISOString(),
        },
      });
      return row;
    });
    // Storage cannot join a database transaction; delete the object only after commit.
    try {
      await this.files.remove(document.fileKey);
    } catch {
      Logger.warn(
        'Document deletion cleanup failed.',
        EmployeeDocumentsService.name,
      );
    }
  }
}
