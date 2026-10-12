import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import type { ConsentType, DataRequestType } from '@prisma/client';

import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { MeService } from './me.service.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class ProfileDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName: string;
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail({}, { message: 'Enter a valid email address.' }) email?: string;
  @IsOptional() @Transform(trim) @Matches(/^\+?[0-9]{10,15}$/, { message: 'Enter a valid phone number.' }) phone?: string;
}
class PasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8, { message: 'Use at least 8 characters for your new password.' }) newPassword: string;
}
class PrefsDto {
  @IsOptional() @IsBoolean() weeklyReport?: boolean;
  @IsOptional() @IsBoolean() whatsAppReports?: boolean;
  @IsOptional() @IsBoolean() lessonReminders?: boolean;
  @IsOptional() @IsBoolean() payments?: boolean;
  @IsOptional() @IsBoolean() productNews?: boolean;
}
class RoleDto {
  @IsIn(['PARENT', 'TUTOR']) role: 'PARENT' | 'TUTOR';
}
class ConsentDto {
  @IsIn(['DATA_PROCESSING', 'AI_REPORTS', 'TUTOR_MATCHING']) type: ConsentType;
  @IsBoolean() granted: boolean;
}
class PushTokenDto {
  @IsString() @Matches(/^Expo(nent)?PushToken\[.+\]$/, { message: 'Not an Expo push token.' }) token: string;
  @IsOptional() @IsIn(['android', 'ios']) platform?: string;
}
class DataRequestDto {
  @IsIn(['EXPORT', 'DELETE']) type: DataRequestType;
  @IsOptional() @IsString() studentId?: string;
}

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Patch('profile') profile(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) {
    return this.me.updateProfile(u.id, dto);
  }

  @HttpCode(200) @Post('password') password(@CurrentUser() u: AuthUser, @Body() dto: PasswordDto) {
    return this.me.changePassword(u.id, dto.currentPassword, dto.newPassword);
  }

  @Get('notifications') prefs(@CurrentUser() u: AuthUser) {
    return this.me.prefs(u.id);
  }

  @Put('notifications') setPrefs(@CurrentUser() u: AuthUser, @Body() dto: PrefsDto) {
    return this.me.setPrefs(u.id, dto);
  }

  /** Called by the app after sign-in so this phone gets push notifications. */
  @HttpCode(200) @Post('push-tokens') addPushToken(@CurrentUser() u: AuthUser, @Body() dto: PushTokenDto) {
    return this.me.savePushToken(u.id, dto.token, dto.platform ?? 'android');
  }

  /** Called before sign-out so a shared phone stops getting this person's notifications. */
  @HttpCode(200) @Post('push-tokens/remove') removePushToken(@CurrentUser() u: AuthUser, @Body() dto: PushTokenDto) {
    return this.me.removePushToken(u.id, dto.token);
  }

  @Post('roles') addRole(@CurrentUser() u: AuthUser, @Body() dto: RoleDto) {
    return this.me.addRole(u.id, dto.role);
  }

  @Roles('PARENT') @Get('privacy') privacy(@CurrentUser() u: AuthUser) {
    return this.me.privacy(u.id);
  }

  @Roles('PARENT') @Put('privacy/children/:id') consent(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ConsentDto) {
    return this.me.setConsent(u.id, id, dto.type, dto.granted);
  }

  @Post('data-requests') dataRequest(@CurrentUser() u: AuthUser, @Body() dto: DataRequestDto) {
    return this.me.requestData(u.id, dto.type, dto.studentId);
  }
}
