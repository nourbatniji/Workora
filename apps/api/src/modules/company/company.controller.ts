// Company profile (CS-03) and compliance mode (CS-06). Admin only (permissions.md §2).
import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { companyUpdateSchema, type CompanyUpdateInput } from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CompanyService } from './company.service.js';

@Controller('company')
@Roles('admin')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  // GET /company: profile (name, logo, address, phone, time zone, currency) and compliance mode
  @Get()
  profile() {
    return this.company.profile();
  }

  // PATCH /company: edit the profile (FR-CS-3) and/or compliance mode (FR-CS-6); send only what changes
  @Patch()
  update(
    @Req() req: Request,
    @Body(new ZodValidationPipe(companyUpdateSchema)) body: CompanyUpdateInput,
  ) {
    return this.company.update(req.auth!, body);
  }
}
