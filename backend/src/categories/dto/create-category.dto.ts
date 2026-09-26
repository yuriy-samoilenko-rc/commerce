import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  // null (on update) moves the category to the top level
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
