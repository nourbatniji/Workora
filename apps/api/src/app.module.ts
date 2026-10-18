import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { UsersController } from './users/users.controller.js';
import { JobTitlesController } from './job-titles/job-titles.controller.js';
import { CompanyController } from './company/company.controller.js';
import { CompanySettingsController } from './company/company-settings.controller.js';
import { CompanySetupController } from './company/company-setup.controller.js';
import { AuditLogController } from './audit-log/audit-log.controller.js';
import { EmployeesController } from './employees/employees.controller.js';
import { ShiftsController } from './shifts/shifts.controller.js';
import { PrismaService } from './prisma/prisma.service.js';
import { TenantPrismaService } from './prisma/tenant-prisma.service.js';
import { AuditService } from './common/audit/audit.service.js';
import { MailService } from './common/mail/mail.service.js';
import { FilesService } from './common/files/files.service.js';
import { AuthService } from './auth/auth.service.js';
import { UsersService } from './users/users.service.js';
import { JobTitlesService } from './job-titles/job-titles.service.js';
import { CompanyService } from './company/company.service.js';
import { CompanySettingsService } from './company/company-settings.service.js';
import { CompanySetupService } from './company/company-setup.service.js';
import { AuditLogService } from './audit-log/audit-log.service.js';
import { EmployeesService } from './employees/employees.service.js';
import { EmployeePhotoService } from './employees/employee-photo.service.js';
import { EmployeeSalaryService } from './employees/employee-salary.service.js';
import { EmployeeDocumentsService } from './employees/employee-documents.service.js';
import { EmployeeStatusService } from './employees/employee-status.service.js';
import { EmployeeStatusWorker } from './employees/employee-status-worker.service.js';
import { ShiftsService } from './shifts/shifts.service.js';
import { RolesGuard } from './auth/roles.guard.js';
import { SessionGuard } from './auth/session.guard.js';

// One place to register the app's controllers and services.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    JobTitlesController,
    CompanyController,
    CompanySettingsController,
    CompanySetupController,
    AuditLogController,
    EmployeesController,
    ShiftsController,
  ],
  providers: [
    PrismaService,
    TenantPrismaService,
    AuditService,
    MailService,
    FilesService,
    AuthService,
    UsersService,
    JobTitlesService,
    CompanyService,
    CompanySettingsService,
    CompanySetupService,
    AuditLogService,
    EmployeesService,
    EmployeePhotoService,
    EmployeeSalaryService,
    EmployeeDocumentsService,
    EmployeeStatusService,
    EmployeeStatusWorker,
    ShiftsService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
