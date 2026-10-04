import { IsOptional, IsUUID } from 'class-validator';

/** Deleting a used record: where its products (and subcategories) go instead. */
export class MoveToQueryDto {
  @IsOptional()
  @IsUUID()
  moveTo?: string;
}
