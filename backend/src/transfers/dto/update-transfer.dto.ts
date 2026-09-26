import { PartialType } from '@nestjs/mapped-types';
import { CreateTransferDto } from './create-transfer.dto';

// Sending `items` replaces the whole item list of the draft.
export class UpdateTransferDto extends PartialType(CreateTransferDto, { skipNullProperties: false }) {}
