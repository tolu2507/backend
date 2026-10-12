import { Global, Module } from '@nestjs/common';

import { MessagingService } from './messaging.service.js';
import { RemindersService } from './reminders.service.js';

@Global()
@Module({ providers: [MessagingService, RemindersService], exports: [MessagingService] })
export class MessagingModule {}
