// Users and invites (UA-01). Admin only (permissions.md: "Invite an Employee or Interviewer",
// "Invite another Admin").
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from '@mdarj/shared';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // GET /users: list with role and account status (FR-UA-8)
  @Get()
  @Roles('admin')
  list(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQuery,
  ) {
    return this.users.list(query);
  }

  // POST /users: create a user and get the 7-day invite link (FR-UA-1, FR-UA-2, FR-UA-7)
  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
  ) {
    return this.users.create(req.auth!, body);
  }

  // POST /users/:id/invite: a new 7-day link; the old one stops working (UA-02, FR-UA-2, FR-UA-4)
  @Post(':id/invite')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  newInvite(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.newInvite(req.auth!, id);
  }

  // PATCH /users/:id: change the role; never the last Active Admin (UA-07, FR-UA-7, FR-UA-9)
  @Patch(':id')
  @Roles('admin')
  changeRole(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    return this.users.changeRole(req.auth!, id, body);
  }

  // POST /users/:id/deactivate: switch the login off; never the last Active Admin (FR-UA-8, FR-UA-9)
  @Post(':id/deactivate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.users.deactivate(req.auth!, id);
  }

  // POST /users/:id/activate: switch the login back on (FR-UA-8)
  @Post(':id/activate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  activate(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.activate(req.auth!, id);
  }
}
