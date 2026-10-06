import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  loginSchema,
  signUpSchema,
  type LoginInput,
  type SignUpInput,
} from '@mdarj/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { SESSION_COOKIE } from './session-token.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/sign-up (CS-01, FR-CS-1)
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body(new ZodValidationPipe(signUpSchema)) body: SignUpInput) {
    return this.authService.signUp(body);
  }

  // POST /auth/login (UA-03, FR-UA-3)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    // passthrough: we set a cookie but Nest still sends the returned object as JSON
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.login(body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // D-24: httpOnly (page scripts can't read it), SameSite, Secure in production (HTTPS only)
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return { user };
  }

  // GET /auth/me: who is logged in
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: Request) {
    return this.authService.me(req.auth!.userId);
  }

  // POST /auth/logout: end this session and remove the cookie
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.auth!.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
