import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';

import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { SquadService } from './squad.service.js';

@Global()
@Module({
  imports: [HttpModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SquadService],
  exports: [PaymentsService, SquadService],
})
export class PaymentsModule {}
