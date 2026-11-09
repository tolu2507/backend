import { Module } from '@nestjs/common';

import { ExamsModule } from '../exams/exams.module.js';
import { QuestionBankModule } from '../question-bank/question-bank.module.js';
import { AdminUniversityController, MyUniversityController, UniversityController } from './university.controller.js';
import { UniversityService } from './university.service.js';

@Module({
  imports: [ExamsModule, QuestionBankModule],
  controllers: [UniversityController, MyUniversityController, AdminUniversityController],
  providers: [UniversityService],
})
export class UniversityModule {}
