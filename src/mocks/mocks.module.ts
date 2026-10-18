import { Module } from '@nestjs/common';

import { MocksController } from './mocks.controller.js';
import { MocksService } from './mocks.service.js';

@Module({ controllers: [MocksController], providers: [MocksService], exports: [MocksService] })
export class MocksModule {}
