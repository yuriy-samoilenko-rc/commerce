import { PartialType } from '@nestjs/mapped-types';
import { CreateReceivingDto } from './create-receiving.dto';

// Sending `items` replaces the whole item list of the draft.
export class UpdateReceivingDto extends PartialType(CreateReceivingDto, { skipNullProperties: false }) {}
