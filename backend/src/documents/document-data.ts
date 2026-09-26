import { localParts } from '../common/timezone';
import { DocumentType, Prisma } from '../generated/prisma/client';

export interface DocColumn {
  key: string;
  label: string;
  /** Relative width; the renderer spreads the page width proportionally. */
  width: number;
  align?: 'left' | 'right' | 'center';
}

/**
 * Everything needed to print a document, frozen at issue time. Values are
 * display-ready strings, so a PDF printed years later looks exactly the same.
 */
export interface DocumentData {
  title: string;
  company: {
    name: string;
    lines: string[];
  };
  parties: { label: string; lines: string[] }[];
  meta: { label: string; value: string }[];
  columns: DocColumn[];
  rows: { cells: Record<string, string>; note?: string }[];
  totals: { label: string; value: string; bold?: boolean }[];
  notes: string[];
  signatures: string[];
}

export const NUMBER_PREFIX: Record<DocumentType, string> = {
  INVOICE: 'INV',
  DELIVERY_NOTE: 'DN',
  WARRANTY_CARD: 'WC',
  RECEIVING_NOTE: 'RN',
  TRANSFER_NOTE: 'TN',
  RETURN_NOTE: 'RTN',
  INVENTORY_ACT: 'IA',
};

/** Montenegrin notation: 1.357,90 */
export const money = (value: Prisma.Decimal | number | string) => {
  const [int, frac] = new Prisma.Decimal(value).toFixed(2).split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits},${frac}`;
};

/** Montenegrin notation in local time: 26.09.2026. */
export const day = (d: Date | null | undefined) => {
  if (!d) return '—';
  const { year, month, day: dd } = localParts(d);
  return `${dd}.${month}.${year}.`;
};
