import { Module } from '@nestjs/common';

import { ExamsModule } from '../exams/exams.module.js';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';

@Module({ imports: [ExamsModule], controllers: [ProgressController], providers: [ProgressService] })
export class ProgressModule {}
