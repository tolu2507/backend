import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SupportStatus } from '@prisma/client';

import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const person = { select: { firstName: true, lastName: true } } as const;

/** Help requests from parents and students, and Overwatch's replies. */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  /** The children a user may raise a request about: a parent's confirmed children, or a student themself. */
  private async allowedStudents(userId: string) {
    const [links, own] = await Promise.all([
      this.prisma.guardianship.findMany({ where: { parentId: userId, confirmedAt: { not: null } }, select: { studentId: true } }),
      this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    return new Set([...links.map((l) => l.studentId), ...(own ? [own.id] : [])]);
  }

  private async childName(studentId: string | null) {
    if (!studentId) return null;
    const s = await this.prisma.studentProfile.findUnique({ where: { id: studentId }, select: { user: person } });
    return s ? s.user.firstName : null;
  }

  async mine(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updatedAt, lastMessage: t.messages[0]?.body ?? '', lastFromStaff: t.messages[0]?.fromStaff ?? false }));
  }

  async open(userId: string, dto: { subject: string; body: string; studentId?: string }) {
    if (dto.studentId && !(await this.allowedStudents(userId)).has(dto.studentId)) throw new ForbiddenException('You can only ask about your own children.');
    const t = await this.prisma.supportTicket.create({
      data: { userId, studentId: dto.studentId ?? null, subject: dto.subject, messages: { create: { authorId: userId, fromStaff: false, body: dto.body } } },
    });
    return this.thread(t.id, { userId });
  }

  /** One conversation. `userId` limits it to the requester; omit it for Overwatch. */
  async thread(id: string, who: { userId?: string }) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } }, messages: { orderBy: { createdAt: 'asc' }, include: { author: person } } },
    });
    if (!t || (who.userId && t.userId !== who.userId)) throw new NotFoundException('We couldn’t find that conversation.');
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      child: await this.childName(t.studentId),
      requester: who.userId ? undefined : { name: `${t.user.firstName} ${t.user.lastName}`, email: t.user.email, phone: t.user.phone },
      messages: t.messages.map((m) => ({ id: m.id, body: m.body, fromStaff: m.fromStaff, author: m.fromStaff ? (who.userId ? 'BrainBox support' : `${m.author.firstName} ${m.author.lastName}`) : m.author.firstName, createdAt: m.createdAt })),
    };
  }

  /** The requester adds a message; a resolved conversation opens again. */
  async reply(userId: string, id: string, body: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t || t.userId !== userId) throw new NotFoundException('We couldn’t find that conversation.');
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId: id, authorId: userId, fromStaff: false, body } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: 'OPEN' } }),
    ]);
    return this.thread(id, { userId });
  }

  // ── Overwatch ──────────────────────────────────────────

  async inbox(f: { status?: SupportStatus; page?: number }) {
    const page = f.page ?? 1;
    const pageSize = 25;
    const where = f.status ? { status: f.status } : {};
    const [total, rows, counts] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: person, messages: { orderBy: { createdAt: 'desc' }, take: 1 }, _count: { select: { messages: true } } },
      }),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      total,
      page,
      pageSize,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<SupportStatus, number>>,
      items: rows.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        requester: `${t.user.firstName} ${t.user.lastName}`,
        messages: t._count.messages,
        lastMessage: t.messages[0]?.body ?? '',
        waitingOnUs: t.status === 'OPEN' && !t.messages[0]?.fromStaff,
        updatedAt: t.updatedAt,
      })),
    };
  }

  /** Overwatch replies. By default the conversation then waits on the requester; `resolve` closes it. */
  async staffReply(adminId: string, id: string, body: string, resolve: boolean) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Ticket not found.');
    await this.prisma.$transaction([
      this.prisma.supportMessage.create({ data: { ticketId: id, authorId: adminId, fromStaff: true, body } }),
      this.prisma.supportTicket.update({ where: { id }, data: { status: resolve ? 'RESOLVED' : 'WAITING_ON_USER' } }),
      this.prisma.auditLog.create({ data: { actorId: adminId, action: 'support.reply', entityType: 'SupportTicket', entityId: id, meta: { resolve } } }),
    ]);
    await this.messaging.push([t.userId], { title: 'BrainBox support replied', body: body.length > 120 ? `${body.slice(0, 117)}…` : body, url: `/settings/support/${id}` });
    return this.thread(id, {});
  }

  async setStatus(adminId: string, id: string, status: SupportStatus) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Ticket not found.');
    await this.prisma.$transaction([
      this.prisma.supportTicket.update({ where: { id }, data: { status } }),
      this.prisma.auditLog.create({ data: { actorId: adminId, action: `support.${status.toLowerCase()}`, entityType: 'SupportTicket', entityId: id } }),
    ]);
    return this.thread(id, {});
  }
}
