import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string | null;
}

export class ReorderImagesDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  ids: string[];
}
