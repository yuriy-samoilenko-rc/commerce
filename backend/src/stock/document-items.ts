import { BadRequestException } from '@nestjs/common';
import { badRequest } from '../common/errors';
import { Tx } from './stock-ledger.service';

export interface DocumentItemInput {
  productId: string;
  quantity: number;
  serialNumbers?: string[];
}

export const cleanSerials = (serials?: string[]) =>
  (serials ?? []).map((s) => s.trim());

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
    if (!product)
      throw new BadRequestException(`Product ${item.productId} not found`);
    if (product.isArchived && !opts.allowArchived) {
      throw badRequest(
        'PRODUCT_ARCHIVED',
        `Product "${product.name}" is archived`,
        {
          product: product.name,
        },
      );
    }

    const serials = cleanSerials(item.serialNumbers);
    if (serials.length && !product.trackSerial) {
      throw badRequest(
        'SERIALS_NOT_TRACKED',
        `Product "${product.name}" is not tracked by serial number`,
        { product: product.name },
      );
    }
    if (serials.length > item.quantity) {
      throw badRequest(
        'SERIALS_COUNT_MISMATCH',
        `Product "${product.name}": ${serials.length} serial numbers for quantity ${item.quantity}`,
        { product: product.name, expected: item.quantity, got: serials.length },
      );
    }
    allSerials.push(...serials);
  }

  const duplicates = allSerials.filter((s, i) => allSerials.indexOf(s) !== i);
  if (duplicates.length) {
    const list = [...new Set(duplicates)].join(', ');
    throw badRequest('SERIALS_DUPLICATE', `Duplicate serial numbers: ${list}`, {
      serials: list,
    });
  }
}
