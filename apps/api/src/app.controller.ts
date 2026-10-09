import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // A simple "the API is up" check: no login needed
  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
}
