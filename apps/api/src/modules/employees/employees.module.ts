import { EmployeePhotoService } from './employee-photo.service.js';
import { EmployeeSalaryService } from './employee-salary.service.js';
import { ShiftsModule } from '../shifts/shifts.module.js';
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [UsersModule, ShiftsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeePhotoService, EmployeeSalaryService],
})
export class EmployeesModule {}
