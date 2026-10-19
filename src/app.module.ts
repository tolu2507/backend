import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AdminModule } from './admin/admin.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ActivityLogInterceptor } from './common/activity.interceptor.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { EnquiriesController } from './enquiries/enquiries.controller.js';
import { ExamsModule } from './exams/exams.module.js';
import { GamificationModule } from './gamification/gamification.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { MeModule } from './me/me.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { MocksModule } from './mocks/mocks.module.js';
import { ParentModule } from './parent/parent.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { RankingsModule } from './rankings/rankings.module.js';
import { QuestionBankModule } from './question-bank/question-bank.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SchoolModule } from './school/school.module.js';
import { StudentModule } from './student/student.module.js';
import { SupportModule } from './support/support.module.js';
import { TuckShopModule } from './tuckshop/tuckshop.module.js';
import { TutorModule } from './tutor/tutor.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    MessagingModule,
    AuthModule,
    AiModule,
    LedgerModule,
    GamificationModule,
    PaymentsModule,
    ReportsModule,
    MeModule,
    StudentModule,
    ExamsModule,
    QuestionBankModule,
    MocksModule,
    ProgressModule,
    ParentModule,
    TutorModule,
    AdminModule,
    SchoolModule,
    TuckShopModule,
    SupportModule,
    RankingsModule,
  ],
  controllers: [CatalogController, EnquiriesController, HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor }],
})
export class AppModule {}
