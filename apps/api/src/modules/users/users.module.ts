import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  // Employees use it to give an employee app access (D-77)
  exports: [UsersService],
})
export class UsersModule {}
