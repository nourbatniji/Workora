// Employees (SRS 3.3). Admin only for now (permissions.md §1: "Create an employee").
// Employees reading their own profile come with EM-10 (GET /me/profile).
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
  createEmployeeSchema,
  listEmployeesQuerySchema,
  type CreateEmployeeInput,
  type ListEmployeesQuery,
} from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { EmployeesService } from './employees.service.js';

@Controller('employees')
@Roles('admin')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  // GET /employees: search, filters, sort and pages (EM-09, FR-EM-9)
  @Get()
  list(
    @Query(new ZodValidationPipe(listEmployeesQuerySchema))
    query: ListEmployeesQuery,
  ) {
    return this.employees.list(query);
  }

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
