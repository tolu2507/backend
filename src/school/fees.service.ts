import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { formatNaira } from '../common/money.js';
import { lagosDay } from '../common/dates.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireAdmin, type SchoolActor } from './school.context.js';
import type { BulkInvoiceDto, RecordPaymentDto } from './school.dto.js';
import { SchoolService } from './school.service.js';

/** School fee invoices: the bursar bills a term; parents pay in the app or the school records cash. */
@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly school: SchoolService,
    private readonly ledger: LedgerService,
    private readonly messaging: MessagingService,
  ) {}

  async list(a: SchoolActor, q: { termId?: string; classId?: string; status?: string }) {
    requireAdmin(a);
    const termId = q.termId ?? (await this.school.currentTerm(a.schoolId)).term?.id;
    if (!termId) return { termId: null, totals: null, invoices: [] };
    const term = await this.prisma.term.findFirst({ where: { id: termId, academicYear: { schoolId: a.schoolId } }, include: { academicYear: true } });
    if (!term) throw new NotFoundException('Term not found.');
    const invoices = await this.prisma.feeInvoice.findMany({
      where: {
        schoolId: a.schoolId,
        termId,
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.classId ? { student: { enrollments: { some: { classId: q.classId, academicYearId: term.academicYearId } } } } : {}),
      },
      include: { student: { include: { user: true, enrollments: { where: { academicYearId: term.academicYearId }, include: { class: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const live = invoices.filter((i) => i.status !== 'VOID');
    return {
      termId,
      termLabel: `${term.academicYear.name} · ${term.name.toLowerCase()} term`,
      totals: {
        billedKobo: live.reduce((n, i) => n + i.totalKobo, 0n),
        paidKobo: live.reduce((n, i) => n + i.paidKobo, 0n),
        count: live.length,
        paid: live.filter((i) => i.status === 'PAID').length,
        partPaid: live.filter((i) => i.status === 'PART_PAID').length,
        unpaid: live.filter((i) => i.status === 'UNPAID').length,
      },
      invoices: invoices.map((i) => {
        const cls = i.student.enrollments[0]?.class;
        return {
          id: i.id,
          studentId: i.studentId,
          studentName: `${i.student.user.firstName} ${i.student.user.lastName}`,
          admissionNo: i.student.admissionNo,
          className: cls ? (cls.armName ? `${cls.gradeName} ${cls.armName}` : cls.gradeName) : '—',
          items: i.items as { label: string; amountKobo: string }[],
          totalKobo: i.totalKobo,
          paidKobo: i.paidKobo,
          status: i.status,
          dueDate: i.dueDate,
        };
      }),
    };
  }

  /** Bills every student in the chosen classes for the term. Students who already have an invoice are skipped. */
  async bulkCreate(a: SchoolActor, dto: BulkInvoiceDto) {
    requireAdmin(a);
    const term = await this.prisma.term.findFirst({ where: { id: dto.termId, academicYear: { schoolId: a.schoolId } } });
    if (!term) throw new BadRequestException('Choose a term from your current session.');
    const classes = await this.prisma.class.count({ where: { id: { in: dto.classIds }, schoolId: a.schoolId } });
    if (classes !== dto.classIds.length) throw new BadRequestException('One of those classes isn’t yours.');
    const enrolments = await this.prisma.enrollment.findMany({ where: { classId: { in: dto.classIds }, academicYearId: term.academicYearId } });
    const items = dto.items.map((i) => ({ label: i.label, amountKobo: String(i.amountKobo) }));
    const total = dto.items.reduce((n, i) => n + BigInt(i.amountKobo), 0n);
    const created = await this.prisma.feeInvoice.createMany({
      data: enrolments.map((e) => ({ schoolId: a.schoolId, studentId: e.studentId, termId: term.id, items, totalKobo: total, dueDate: lagosDay(new Date(dto.dueDate)) })),
      skipDuplicates: true,
    });

    // Tell parents a bill is waiting (push, if they allow payment notifications).
    const parents = await this.prisma.guardianship.findMany({ where: { studentId: { in: enrolments.map((e) => e.studentId) } }, select: { parentId: true } });
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: a.schoolId } });
    if (created.count) this.messaging.notify([...new Set(parents.map((p) => p.parentId))], 'payments', { title: `${school.name} school fees`, body: `This term’s fees (${formatNaira(total)}) are ready. Pay in the app.`, url: '/parent/wallet' });

    return { created: created.count, skipped: enrolments.length - created.count, totalKobo: total };
  }

  /** Cash, transfer or POS paid straight to the school. Only the invoice changes; no money moves through Nexus. */
  async recordPayment(a: SchoolActor, invoiceId: string, dto: RecordPaymentDto) {
    requireAdmin(a);
    const inv = await this.prisma.feeInvoice.findFirst({ where: { id: invoiceId, schoolId: a.schoolId } });
    if (!inv) throw new NotFoundException('Invoice not found.');
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await this.ledger.payInvoice(tx, { invoiceId, amountKobo: BigInt(dto.amountKobo), actorId: a.userId, description: `${dto.method} payment` });
      await tx.auditLog.create({
        data: { actorId: a.userId, action: 'fee.record_payment', entityType: 'FeeInvoice', entityId: invoiceId, schoolId: a.schoolId, meta: { amountKobo: String(dto.amountKobo), method: dto.method, reference: dto.reference ?? null } },
      });
      return r;
    });
    return result;
  }

  async void(a: SchoolActor, invoiceId: string) {
    requireAdmin(a);
    const inv = await this.prisma.feeInvoice.findFirst({ where: { id: invoiceId, schoolId: a.schoolId } });
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.paidKobo > 0n) throw new BadRequestException('This invoice has payments on it, so it can’t be cancelled.');
    await this.prisma.$transaction([
      this.prisma.feeInvoice.update({ where: { id: invoiceId }, data: { status: 'VOID' } }),
      this.prisma.auditLog.create({ data: { actorId: a.userId, action: 'fee.void', entityType: 'FeeInvoice', entityId: invoiceId, schoolId: a.schoolId } }),
    ]);
    return { ok: true };
  }
}
