import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Query-string values arrive as strings; @Type converts them before validation.
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export function pageArgs(q: PaginationQueryDto) {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}
