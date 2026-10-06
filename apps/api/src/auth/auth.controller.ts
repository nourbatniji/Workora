import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { signUpSchema, type SignUpInput } from '@mdarj/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/sign-up (CS-01, FR-CS-1)
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body(new ZodValidationPipe(signUpSchema)) body: SignUpInput) {
    return this.authService.signUp(body);
  }
}
