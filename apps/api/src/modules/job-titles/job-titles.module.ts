import { Module } from '@nestjs/common';
import { JobTitlesController } from './job-titles.controller.js';
import { JobTitlesService } from './job-titles.service.js';

@Module({
  controllers: [JobTitlesController],
  providers: [JobTitlesService],
})
export class JobTitlesModule {}
