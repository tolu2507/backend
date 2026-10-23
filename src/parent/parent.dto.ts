import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import type { EducationLevel, TeachingMode } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const LEVELS = ['NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'];
const MODES = ['IN_PERSON', 'ONLINE', 'BOTH'];

export class CreateChildDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName: string;
  @IsIn(LEVELS) level: EducationLevel;
  @Transform(trim) @IsString() @Length(2, 20) gradeName: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9_.]{3,20}$/, { message: 'Usernames use 3–20 lowercase letters, numbers, dots or underscores.' })
  username: string;
  @Matches(/^[0-9]{4}$/, { message: 'The PIN must be 4 numbers.' }) pin: string;
  @IsBoolean() consentDataProcessing: boolean;
  @IsBoolean() consentAiReports: boolean;
  @IsOptional() @IsBoolean() consentTutorMatching?: boolean; // tutor matching is paused; the app no longer asks
}

export class ChangePinDto {
  @Matches(/^[0-9]{4}$/, { message: 'The PIN must be 4 numbers.' }) pin: string;
}

export class TutorRequestDto {
  @IsString() studentId: string;
  @Transform(trim) @IsString() subject: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 300) goals?: string;
  @IsIn(MODES) mode: TeachingMode;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) state?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) lga?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_00) budgetMaxKobo?: number;
  @IsArray() @ArrayMaxSize(7) @IsIn(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { each: true }) days: string[];
  @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) preferences: string[];
}

export class BookDto {
  @IsString() matchId: string;
}

export class TopupDto {
  @Type(() => Number) @IsInt() @Min(10_000) @Max(10_000_000) amountKobo: number;
}

export class ArenaSettingsDto {
  @IsOptional() @IsBoolean() arenaAllowed?: boolean;
  @IsOptional() @IsBoolean() chatAllowed?: boolean;
}

export class DailyLimitDto {
  /** Kobo per Lagos day, ₦100 to ₦100,000; null removes the limit. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(10_000, { message: 'Set at least ₦100 a day, or no limit.' }) @Max(10_000_000, { message: 'The most you can set is ₦100,000 a day.' }) dailyLimitKobo: number | null;
}

export class DisputeDto {
  @Transform(trim) @IsString() @Length(5, 500) reason: string;
}

export class PayInvoiceDto {
  /** Leave out to pay the whole balance. */
  @IsOptional() @IsInt() @Min(100) amountKobo?: number;
}
