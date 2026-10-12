import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { EducationLevel } from '@prisma/client';

import { Public, Roles } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

class CreateEnquiryDto {
  @IsString() @Length(2, 80) contactName: string;
  @IsString() @Length(2, 40) role: string;
  @IsString() @Length(2, 120) schoolName: string;
  @IsEmail() email: string;
  @Matches(/^\+?[0-9 ]{10,18}$/, { message: 'Enter a valid phone number.' }) phone: string;
  @IsOptional() @IsString() @Length(0, 40) state?: string;
  @IsOptional() @IsString() @Length(0, 20) studentCount?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsEnum(EducationLevel, { each: true }) levels?: EducationLevel[];
  @IsOptional() @IsString() @Length(0, 1000) message?: string;
  /** Honeypot: hidden on the form, so only bots fill it. */
  @IsOptional() @IsString() website?: string;
}

@Controller()
export class EnquiriesController {
  constructor(private readonly prisma: PrismaService) {}

  /** "Book a demo" form on the marketing site. */
  @Public()
  @Post('schools/enquiries')
  async create(@Body() dto: CreateEnquiryDto) {
    const { website, ...data } = dto;
    if (website) return { ok: true }; // pretend success so bots don't retry
    await this.prisma.schoolEnquiry.create({ data: { ...data, phone: data.phone.replace(/\s/g, ''), email: data.email.trim().toLowerCase() } });
    return { ok: true };
  }

  /** Overwatch inbox of demo requests. */
  @Roles('PLATFORM_ADMIN')
  @Get('admin/school-enquiries')
  list(@Query('handled') handled?: string) {
    return this.prisma.schoolEnquiry.findMany({
      where: handled === undefined ? undefined : { handled: handled === 'true' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Roles('PLATFORM_ADMIN')
  @HttpCode(200)
  @Post('admin/school-enquiries/:id/handled')
  markHandled(@Param('id') id: string) {
    return this.prisma.schoolEnquiry.update({ where: { id }, data: { handled: true } });
  }
}
