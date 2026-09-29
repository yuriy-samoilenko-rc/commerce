import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  /** Same rule as the phone on an order; empty string clears it. */
  @IsOptional()
  @ValidateIf((o: UpdateProfileDto) => !!o.phone)
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryAddress?: string | null;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
