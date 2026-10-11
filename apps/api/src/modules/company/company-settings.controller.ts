// Settings versions (CS-04, CS-08). Admin only (permissions.md §2: settings and their history).
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  settingsChangeSchema,
  settingsDateQuerySchema,
  type SettingsChangeInput,
  type SettingsDateQuery,
} from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CompanySettingsService } from './company-settings.service.js';

@Controller('company/settings')
@Roles('admin')
export class CompanySettingsController {
  constructor(private readonly settings: CompanySettingsService) {}

  // GET /company/settings?date=2026-11-01: the version in force that day (default today)
  @Get()
  settingsOn(
    @Query(new ZodValidationPipe(settingsDateQuerySchema))
    query: SettingsDateQuery,
  ) {
    return this.settings.settingsOn(query.date);
  }

  // GET /company/settings/versions: the history, newest first
  @Get('versions')
  versions() {
    return this.settings.versions();
  }

  // POST /company/settings/versions: change settings from a date (today or later)
  @Post('versions')
  @HttpCode(HttpStatus.CREATED)
  change(
    @Req() req: Request,
    @Body(new ZodValidationPipe(settingsChangeSchema))
    body: SettingsChangeInput,
  ) {
    return this.settings.change(req.auth!, body);
  }
}
