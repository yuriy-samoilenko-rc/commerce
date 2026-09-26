const format = (prefix: string) => (n: number) => `${prefix}-${String(n).padStart(5, '0')}`;

export const formatReceivingNumber = format('RCV');
export const formatTransferNumber = format('TR');
export const formatCountNumber = format('CNT');
export const formatReturnNumber = format('RET');
export const formatWarrantyNumber = format('WAR');
