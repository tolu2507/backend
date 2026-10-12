import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { lagosTime } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessagingService } from './messaging.service.js';

const HOUR = 60 * 60_000;

/** Lesson reminders to the parent, the child and the tutor: the day before and an hour before. */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run() {
    const now = Date.now();
    await this.send('reminderDayAt', new Date(now + HOUR), new Date(now + 24 * HOUR), 'Lesson coming up');
    await this.send('reminderHourAt', new Date(now), new Date(now + HOUR + 5 * 60_000), 'Lesson in about an hour');
  }

  private async send(field: 'reminderDayAt' | 'reminderHourAt', from: Date, to: Date, title: string) {
    const due = await this.prisma.tutorSession.findMany({
      where: { status: 'SCHEDULED', [field]: null, scheduledAt: { gt: from, lte: to }, escrowStatus: { in: ['FREE', 'HELD'] } },
      include: { booking: { include: { tutor: { include: { user: true } }, student: { include: { user: true } } } } },
    });
    for (const s of due) {
      // Claim first so two servers never send the same reminder twice.
      const claimed = await this.prisma.tutorSession.updateMany({ where: { id: s.id, [field]: null }, data: { [field]: new Date() } });
      if (!claimed.count) continue;
      const { booking } = s;
      const when = lagosTime(s.scheduledAt);
      const child = booking.student.user.firstName;
      const tutor = `${booking.tutor.user.firstName} ${booking.tutor.user.lastName[0]}.`;
      this.messaging.notify([booking.parentId], 'lessonReminders', { title, body: `${child} with ${tutor}, ${when}.`, url: '/parent/teachers' });
      this.messaging.notify([booking.student.userId], 'lessonReminders', { title, body: `With ${tutor}, ${when}. Have your books ready!`, url: '/student' });
      this.messaging.notify([booking.tutor.userId], 'lessonReminders', { title, body: `${child}, ${when}.`, url: `/tutor/booking/${booking.id}` });
    }
    if (due.length) this.logger.log(`Sent ${field === 'reminderDayAt' ? 'day' : 'hour'} reminders for ${due.length} lessons`);
  }
}
