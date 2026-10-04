import { PartialType, PickType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  PickType(CreateUserDto, ['name', 'role']),
  {
    skipNullProperties: false,
  },
) {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  /** A new password set by the admin; it signs the user out everywhere. */
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;
}
