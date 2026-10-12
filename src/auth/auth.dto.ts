import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @Transform(trim) @IsString() @Length(1, 60) firstName: string;
  @Transform(trim) @IsString() @Length(1, 60) lastName: string;
  @Transform(lower) @IsEmail({}, { message: 'Enter a valid email address.' }) email: string;
  @IsOptional() @Transform(trim) @Matches(/^\+?[0-9]{10,15}$/, { message: 'Enter a valid phone number.' }) phone?: string;
  @IsString() @MinLength(8, { message: 'Use at least 8 characters for your password.' }) password: string;
  @IsIn(['PARENT', 'TUTOR']) role: 'PARENT' | 'TUTOR';
}

export class LoginDto {
  @Transform(lower) @IsString() @Length(3, 120) identifier: string; // email or phone
  @IsString() @Length(1, 200) password: string;
}

export class StudentLoginDto {
  @Transform(lower) @IsString() @Length(3, 30) username: string;
  @Matches(/^[0-9]{4}$/, { message: 'Your PIN has 4 numbers.' }) pin: string;
}

export class RefreshDto {
  @IsString() refreshToken: string;
}

export class ForgotPasswordDto {
  @Transform(lower) @IsString() @Length(3, 120) identifier: string;
}

export class ResetPasswordDto {
  @Transform(lower) @IsString() identifier: string;
  @Matches(/^[0-9]{6}$/, { message: 'Enter the 6-digit code.' }) code: string;
  @IsString() @MinLength(8, { message: 'Use at least 8 characters for your password.' }) password: string;
}
