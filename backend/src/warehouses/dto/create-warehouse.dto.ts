import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Customers may collect online orders here; the shop lists it with its contacts. */
  @IsOptional()
  @IsBoolean()
  isPickupPoint?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  /** Free text as the shop shows it, e.g. "Pon–Pet 09–20, Sub 09–15". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  openingHours?: string | null;
}
