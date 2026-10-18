import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator.js';

@Controller()
export class AppController {
  // A simple "the API is up" check: no login needed
  @Get()
  @Public()
  getHello(): string {
    return 'Hello World!';
  }
}
