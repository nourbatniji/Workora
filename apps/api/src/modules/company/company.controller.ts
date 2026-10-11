// Company profile (CS-03). Admin only (permissions.md §2: "Edit the company profile").
import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { companyProfileSchema, type CompanyProfileInput } from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CompanyService } from './company.service.js';

@Controller('company')
@Roles('admin')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  // GET /company: the profile (name, logo, address, phone, time zone, currency)
  @Get()
  profile() {
    return this.company.profile();
  }

  // PATCH /company: edit the profile (FR-CS-3)
  @Patch()
  update(
    @Req() req: Request,
    @Body(new ZodValidationPipe(companyProfileSchema))
    body: CompanyProfileInput,
  ) {
    return this.company.updateProfile(req.auth!, body);
  }
}
