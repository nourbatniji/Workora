// Employees (SRS 3.3). Admin only for now (permissions.md §1: "Create an employee").
// Employees reading their own profile come with EM-10 (GET /me/profile).
import {
  Body,
  Delete,
  Header,
  UploadedFile,
  UseInterceptors,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { FILE_UPLOAD_OPTIONS } from '../../common/files/file-upload.js';
import { EmployeePhotoService } from './employee-photo.service.js';
import { EmployeeSalaryService } from './employee-salary.service.js';
import { ShiftsService } from '../shifts/shifts.service.js';
import {
  shiftAssignmentSchema,
  type ShiftAssignmentInput,
} from '@mdarj/shared';
import {
  salaryChangeSchema,
  salaryHistoryQuerySchema,
  type SalaryChangeInput,
} from '@mdarj/shared';
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
import { EmployeeDocumentsService } from './employee-documents.service.js';
import {
  uploadEmployeeDocumentSchema,
  type UploadEmployeeDocumentInput,
} from '@mdarj/shared';

@Controller('employees')
@Roles('admin')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly photos: EmployeePhotoService,
    private readonly salaries: EmployeeSalaryService,
    private readonly shifts: ShiftsService,
    private readonly documents: EmployeeDocumentsService,
  ) {}

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

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_OPTIONS))
  uploadPhoto(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.photos.upload(req.auth!, id, file);
  }

  @Get(':id/salary-history')
  @Roles('admin', 'employee')
  @Header('Cache-Control', 'private, no-store')
  salaryHistory(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(salaryHistoryQuerySchema))
    query: { date?: string },
  ) {
    return this.salaries.history(req.auth!, id, query.date);
  }

  @Get(':id/shift-assignments')
  shiftAssignments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(salaryHistoryQuerySchema))
    query: { date?: string },
  ) {
    return this.shifts.assignments(id, query.date);
  }
  @Post(':id/shift-assignments')
  assignShift(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(shiftAssignmentSchema))
    body: ShiftAssignmentInput,
  ) {
    return this.shifts.assign(req.auth!, id, body);
  }

  @Post(':id/salary-history')
  addSalary(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(salaryChangeSchema)) body: SalaryChangeInput,
  ) {
    return this.salaries.add(req.auth!, id, body);
  }

  @Get(':id/documents')
  @Roles('admin', 'employee')
  @Header('Cache-Control', 'private, no-store')
  listDocuments(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.documents.list(req.auth!, id);
  }

  @Get(':id/documents/:documentId/file')
  @Roles('admin', 'employee')
  @Header('Cache-Control', 'private, no-store')
  documentFile(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.read(req.auth!, id, documentId);
  }

  @Post(':id/documents')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_OPTIONS))
  uploadDocument(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(uploadEmployeeDocumentSchema))
    body: UploadEmployeeDocumentInput,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.documents.upload(req.auth!, id, body, file);
  }

  @Delete(':id/documents/:documentId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.remove(req.auth!, id, documentId);
  }

  @Get(':id/photo')
  @Roles('admin', 'employee')
  @Header('Cache-Control', 'private, no-store')
  photo(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.photos.read(req.auth!, id);
  }

  @Delete(':id/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhoto(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.photos.remove(req.auth!, id);
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
