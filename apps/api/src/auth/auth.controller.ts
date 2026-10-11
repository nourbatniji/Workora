import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  acceptInviteSchema,
  loginSchema,
  signUpSchema,
  type AcceptInviteInput,
  type LoginInput,
  type SignUpInput,
} from '@mdarj/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import { ALL_ROLES, Roles } from './roles.decorator.js';
import { SESSION_COOKIE } from './session-token.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/sign-up (CS-01, FR-CS-1)
  @Post('sign-up')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body(new ZodValidationPipe(signUpSchema)) body: SignUpInput) {
    return this.authService.signUp(body);
  }

  // POST /auth/login (UA-03, FR-UA-3)
  @Post('login')
  @Public()
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

    setSessionCookie(res, token);
    return { user };
  }

  // GET /auth/invites/:token: is the invite link still good? (UA-01, FR-UA-1)
  @Get('invites/:token')
  @Public()
  checkInvite(@Param('token') token: string) {
    return this.authService.checkInvite(token);
  }

  // POST /auth/invites/:token/accept: set the password; the account becomes Active and logs in (UA-01)
  @Post('invites/:token/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token: sessionToken, user } = await this.authService.acceptInvite(
      token,
      body,
      { ip: req.ip, userAgent: req.get('user-agent') },
    );
    setSessionCookie(res, sessionToken);
    return { user };
  }

  // GET /auth/me: who is logged in
  @Get('me')
  @Roles(...ALL_ROLES)
  me(@Req() req: Request) {
    return this.authService.me(req.auth!.userId);
  }

  // POST /auth/logout: end this session and remove the cookie
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ALL_ROLES)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.auth!.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}

/** D-24: httpOnly (page scripts can't read it), SameSite, Secure in production (HTTPS only) */
function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
