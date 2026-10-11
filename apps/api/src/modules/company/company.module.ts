import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller.js';
import { CompanyService } from './company.service.js';
import { CompanySettingsController } from './company-settings.controller.js';
import { CompanySettingsService } from './company-settings.service.js';

@Module({
  controllers: [CompanyController, CompanySettingsController],
  providers: [CompanyService, CompanySettingsService],
  // Payroll and attendance will ask which settings were in force on a day
  exports: [CompanySettingsService],
})
export class CompanyModule {}
