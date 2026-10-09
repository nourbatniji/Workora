// @Global: every feature module can use AuditService without importing this module (FND-07)
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
