// @Global: invites (UA-01) and password reset (UA-04) can use MailService without importing this module
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
