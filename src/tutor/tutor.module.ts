import { Module } from '@nestjs/common';

import { TutorController } from './tutor.controller.js';
import { TutorService } from './tutor.service.js';

@Module({ controllers: [TutorController], providers: [TutorService] })
export class TutorModule {}
