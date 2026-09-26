import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CustomerQueryDto extends PaginationQueryDto {
  /** Name or email. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
