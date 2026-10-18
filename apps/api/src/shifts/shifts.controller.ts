import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { shiftTemplateSchema, type ShiftTemplateInput } from '@mdarj/shared';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ShiftsService } from './shifts.service.js';

@Controller('shift-templates')
@Roles('admin')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}
  @Get() list() {
    return this.shifts.templates();
  }
  @Post() create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(shiftTemplateSchema)) input: ShiftTemplateInput,
  ) {
    return this.shifts.create(req.auth!, input);
  }
}
