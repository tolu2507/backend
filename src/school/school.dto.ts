import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AssessmentType, AttendanceStatus, EducationLevel } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const PHONE = /^\+?[0-9]{10,15}$/;
const LEVELS = ['NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'];

export class SchoolProfileDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 120) name?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 200) address?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 40) state?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) lga?: string;
  @IsOptional() @Transform(lower) @IsEmail() email?: string;
  @IsOptional() @Transform(trim) @Matches(PHONE, { message: 'Enter a valid phone number.' }) phone?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Use a colour like #5B3DF5.' }) brandColor?: string;
}

export class TermDatesDto {
  @IsIn(['FIRST', 'SECOND', 'THIRD']) name: 'FIRST' | 'SECOND' | 'THIRD';
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

export class AcademicYearDto {
  @Matches(/^\d{4}\/\d{4}$/, { message: 'Write the session like 2026/2027.' }) name: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => TermDatesDto) terms: TermDatesDto[];
  @IsOptional() @IsBoolean() makeCurrent?: boolean;
}

export class SubjectsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @IsString({ each: true }) @Length(2, 60, { each: true }) names: string[];
}

export class ClassDto {
  @IsIn(LEVELS) level: EducationLevel;
  @Transform(trim) @IsString() @Length(1, 30) gradeName: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 20) armName?: string;
  @IsOptional() @IsUUID() formTeacherId?: string | null;
}

export class ClassSubjectDto {
  @IsUUID() subjectId: string;
  @IsOptional() @IsUUID() teacherId?: string | null;
}
export class ClassSubjectsDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ClassSubjectDto) subjects: ClassSubjectDto[];
}

export class InviteStaffDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName: string;
  @Transform(lower) @IsEmail({}, { message: 'Enter a valid email. The invite is sent there.' }) email: string;
  @IsOptional() @Transform(trim) @Matches(PHONE, { message: 'Enter a valid phone number.' }) phone?: string;
  @IsIn(['SCHOOL_ADMIN', 'TEACHER']) role: 'SCHOOL_ADMIN' | 'TEACHER';
}

export class ParentInputDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName: string;
  @IsOptional() @Transform(lower) @IsEmail() email?: string;
  @IsOptional() @Transform(trim) @Matches(PHONE, { message: 'Enter a valid parent phone number.' }) phone?: string;
  @IsOptional() @IsIn(['MOTHER', 'FATHER', 'GUARDIAN']) relationship?: string;
}

export class StudentDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) otherNames?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 30) admissionNo?: string;
  @IsUUID() classId: string;
  @IsOptional() @ValidateNested() @Type(() => ParentInputDto) parent?: ParentInputDto;
}

export class ImportStudentsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => StudentDto) students: StudentDto[];
}

export class UpdateStudentDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 60) firstName?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 60) lastName?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 30) admissionNo?: string;
  @IsOptional() @IsUUID() classId?: string;
}

export class AttendanceEntryDto {
  @IsUUID() studentId: string;
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) status: AttendanceStatus;
  @IsOptional() @IsString() @Length(0, 200) note?: string;
}
export class AttendanceDto {
  @IsDateString() date: string;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => AttendanceEntryDto) entries: AttendanceEntryDto[];
}

export class AssessmentDto {
  @IsUUID() classSubjectId: string;
  @Transform(trim) @IsString() @Length(2, 80) title: string;
  @IsIn(['CLASSWORK', 'ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM']) type: AssessmentType;
  @IsNumber() @Min(1) @Max(1000) maxScore: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) weight?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) topics?: string[];
  @IsDateString() heldOn: string;
}

export class ResultEntryDto {
  @IsUUID() studentId: string;
  @IsNumber() @Min(0) score: number;
  @IsOptional() @IsString() @Length(0, 200) remark?: string;
}
export class ResultsDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ResultEntryDto) results: ResultEntryDto[];
}

export class NoteDto {
  @IsIn(['BEHAVIOUR', 'EFFORT', 'WELLBEING', 'ACHIEVEMENT']) category: string;
  @Transform(trim) @IsString() @Length(3, 1000) body: string;
  @IsOptional() @IsBoolean() visibleToParent?: boolean;
}

export class FeeItemDto {
  @Transform(trim) @IsString() @Length(2, 60) label: string;
  @IsInt() @Min(100) @Max(100_000_000_00) amountKobo: number;
}
export class BulkInvoiceDto {
  @IsUUID() termId: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) classIds: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(15) @ValidateNested({ each: true }) @Type(() => FeeItemDto) items: FeeItemDto[];
  @IsDateString() dueDate: string;
}
export class RecordPaymentDto {
  @IsInt() @Min(100) amountKobo: number;
  @IsIn(['CASH', 'TRANSFER', 'POS']) method: string;
  @IsOptional() @IsString() @Length(0, 100) reference?: string;
}
