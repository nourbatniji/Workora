// @Public(): this route needs no login. Every other route is private by default (SCRUM-33, D-61).
// Only for routes a stranger must reach: sign-up, login, and later the set-password and reset links.
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC, true);
