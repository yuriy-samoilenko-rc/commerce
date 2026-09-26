import { BadRequestException } from '@nestjs/common';
import { Tx } from './stock-ledger.service';

export interface DocumentItemInput {
  productId: string;
  quantity: number;
  serialNumbers?: string[];
}

export const cleanSerials = (serials?: string[]) => (serials ?? []).map((s) => s.trim());

/**
 * Draft-level checks shared by stock documents (receivings, transfers).
 * Serial lists may still be incomplete in a draft; the ledger demands the full
 * count when the document is posted.
 */
export async function validateDocumentItems(
  tx: Tx,
  items: DocumentItemInput[],
  opts: { allowArchived: boolean },
) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, trackSerial: true, isArchived: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const allSerials: string[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
    if (product.isArchived && !opts.allowArchived) {
      throw new BadRequestException(`Product "${product.name}" is archived`);
    }

    const serials = cleanSerials(item.serialNumbers);
    if (serials.length && !product.trackSerial) {
      throw new BadRequestException(`Product "${product.name}" is not tracked by serial number`);
    }
    if (serials.length > item.quantity) {
      throw new BadRequestException(
        `Product "${product.name}": ${serials.length} serial numbers for quantity ${item.quantity}`,
      );
    }
    allSerials.push(...serials);
  }

  const duplicates = allSerials.filter((s, i) => allSerials.indexOf(s) !== i);
  if (duplicates.length) {
    throw new BadRequestException(`Duplicate serial numbers: ${[...new Set(duplicates)].join(', ')}`);
  }
}
