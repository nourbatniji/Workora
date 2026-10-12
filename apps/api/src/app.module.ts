import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './common/audit/audit.module.js';
import { MailModule } from './common/mail/mail.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { JobTitlesModule } from './modules/job-titles/job-titles.module.js';
import { CompanyModule } from './modules/company/company.module.js';
import { AuditLogModule } from './modules/audit-log/audit-log.module.js';
import { RolesGuard } from './auth/roles.guard.js';
import { SessionGuard } from './auth/session.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    JobTitlesModule,
    CompanyModule,
    AuditLogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Every route, in this order (SCRUM-33): 1. logged in? (401)  2. right role? (403)
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
