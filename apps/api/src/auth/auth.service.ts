import { Injectable } from '@nestjs/common';
import type { SignUpInput } from '@mdarj/shared';

@Injectable()
export class AuthService {
  // Step 4: echo the checked data. Step 5 replaces this with the real sign-up.
  signUp(body: SignUpInput) {
    return body;
  }
}
