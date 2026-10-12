import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested,
} from 'class-validator';
import type { EducationLevel, TeachingMode } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SubjectChoiceDto {
  @IsString() subject: string;
  @IsIn(['PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY']) level: EducationLevel;
}

export class TutorProfileDto {
  @Transform(trim) @IsString() @Length(5, 80) headline: string;
  @Transform(trim) @IsString() @Length(20, 800) bio: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(50) yearsExperience: number;
  @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) qualifications: string[];
  @IsIn(['IN_PERSON', 'ONLINE', 'BOTH']) mode: TeachingMode;
  @Transform(trim) @IsString() @Length(2, 60) state: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) lga?: string;
  @Type(() => Number) @IsInt() @Min(100_000) @Max(10_000_000) rateKobo: number; // ₦1,000 – ₦100,000 per hour
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => SubjectChoiceDto) subjects: SubjectChoiceDto[];
}

export class RefereeDto {
  @Transform(trim) @IsString() @Length(2, 80) name: string;
  @Transform(trim) @Matches(/^\+?[0-9]{10,15}$/, { message: 'Enter a valid phone number for each referee.' }) phone: string;
  @Transform(trim) @IsString() @Length(2, 60) relationship: string;
}

export class IdCheckDto {
  @Matches(/^[0-9]{11}$/, { message: 'Your NIN has 11 digits.' }) ninNumber: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2) @ValidateNested({ each: true }) @Type(() => RefereeDto) referees: RefereeDto[];
}

export class StartTestDto {
  @IsString() subject: string;
  @IsIn(['PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY']) level: EducationLevel;
}

export class SubmitTestDto {
  @IsObject() answers: Record<string, string>;
  @IsOptional() @IsNumber() appSwitches?: number;
}

export class ScheduleDto {
  @IsDateString() scheduledAt: string;
  @Type(() => Number) @IsInt() @Min(30) @Max(180) durationMinutes: number;
}

export class CompleteSessionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @IsString({ each: true }) @Length(2, 80, { each: true }) topics: string[];
  @IsOptional() @Transform(trim) @IsString() @Length(0, 600) notes?: string;
}

export class AvailabilityDto {
  @IsBoolean() accepting: boolean;
}
