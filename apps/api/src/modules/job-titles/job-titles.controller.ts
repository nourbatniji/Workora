// Job titles (CS-09). Admin only (permissions.md §2: "Add, rename or remove a job title").
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { jobTitleSchema, type JobTitleInput } from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { JobTitlesService } from './job-titles.service.js';

@Controller('job-titles')
@Roles('admin')
export class JobTitlesController {
  constructor(private readonly jobTitles: JobTitlesService) {}

  @Get()
  list() {
    return this.jobTitles.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(jobTitleSchema)) body: JobTitleInput) {
    return this.jobTitles.create(body);
  }

  @Patch(':id')
  rename(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(jobTitleSchema)) body: JobTitleInput,
  ) {
    return this.jobTitles.rename(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.jobTitles.remove(id);
  }
}
