import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT = 'skipAudit';
/** For routes that write their own, more precise audit entries (e.g. login). */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT, true);
