import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ChargeDto {
  @IsUUID() studentId: string;
  @Type(() => Number) @IsInt() @Min(5_000, { message: 'The smallest sale is ₦50.' }) @Max(2_000_000, { message: 'The largest sale is ₦20,000.' }) amountKobo: number;
  /** Only when the school asks for PINs at the counter. */
  @IsOptional() @IsString() @Matches(/^\d{4}$/, { message: 'The PIN is 4 numbers.' }) pin?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) note?: string;
  /** Made by the phone once per sale, so a retry on bad Wi-Fi can never charge twice. */
  @IsUUID() requestId: string;
}

export class PhonepayDto {
  @Type(() => Number) @IsInt() @Min(5_000, { message: 'The smallest payment is ₦50.' }) @Max(2_000_000, { message: 'The largest payment is ₦20,000.' }) amountKobo: number;
  /** Only for a child who isn't in a school on BrainBox. */
  @IsOptional() @IsUUID() schoolId?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 60) note?: string;
  @IsUUID() requestId: string;
}
