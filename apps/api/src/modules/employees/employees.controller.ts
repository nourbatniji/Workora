// Employees (SRS 3.3). Admin only for now (permissions.md §1: "Create an employee").
// Employees reading their own profile come with EM-10 (GET /me/profile).
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  createEmployeeSchema,
  EMPLOYEE_CODE_PATTERN,
  employeeAccessSchema,
  updateEmployeeSchema,
  exportEmployeesQuerySchema,
  listEmployeesQuerySchema,
  type CreateEmployeeInput,
  type EmployeeAccessInput,
  type UpdateEmployeeInput,
  type ExportEmployeesQuery,
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

  // GET /employees/export: the filtered list as an Excel file (EM-09, FR-EM-9)
  @Get('export')
  async export(
    @Query(new ZodValidationPipe(exportEmployeesQuerySchema))
    query: ExportEmployeesQuery,
  ) {
    const { file, fileName } = await this.employees.export(query);
    return new StreamableFile(file, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  // GET /employees/:key — one employee, by id or by code (EM-08 profile, EM-02)
  @Get(':key')
  profile(@Param('key') key: string) {
    // Anything else can't be an employee: "not found" without asking the database
    if (!EMPLOYEE_CODE_PATTERN.test(key)) {
      throw new NotFoundException({ message: 'notFound' });
    }
    return this.employees.profile(key);
  }

  // PATCH /employees/:id — edit personal and job data (EM-02, EM-03)
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateEmployeeSchema))
    body: UpdateEmployeeInput,
  ) {
    return this.employees.update(req.auth!, id, body);
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

  // POST /employees/:id/access: invite this employee to the app, login connected to the record (D-77)
  @Post(':id/access')
  @HttpCode(HttpStatus.CREATED)
  giveAccess(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(employeeAccessSchema))
    body: EmployeeAccessInput,
  ) {
    return this.employees.giveAccess(req.auth!, id, body);
  }
}
