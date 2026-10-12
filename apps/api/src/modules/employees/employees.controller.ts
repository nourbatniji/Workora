// Employees (SRS 3.3). Admin only for now (permissions.md §1: "Create an employee").
// Employees reading their own profile come with EM-10 (GET /me/profile).
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { createEmployeeSchema, type CreateEmployeeInput } from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { EmployeesService } from './employees.service.js';

@Controller('employees')
@Roles('admin')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  // POST /employees: create an employee; the system assigns the code (EM-01, FR-EM-1)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createEmployeeSchema))
    body: CreateEmployeeInput,
  ) {
    return this.employees.create(req.auth!, body);
  }
}
