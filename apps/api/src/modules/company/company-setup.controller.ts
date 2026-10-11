// Setup wizard progress (CS-02). Admin only (permissions.md §2: "Run the setup wizard").
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { setupStepUpdateSchema, type SetupStepUpdate } from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CompanySetupService } from './company-setup.service.js';

@Controller('company/setup')
@Roles('admin')
export class CompanySetupController {
  constructor(private readonly setup: CompanySetupService) {}

  // GET /company/setup: each step's status (todo, done, skipped) and whether setup is complete
  @Get()
  progress() {
    return this.setup.progress();
  }

  // PATCH /company/setup: mark a step done or skipped
  @Patch()
  mark(
    @Body(new ZodValidationPipe(setupStepUpdateSchema)) body: SetupStepUpdate,
  ) {
    return this.setup.mark(body);
  }
}
