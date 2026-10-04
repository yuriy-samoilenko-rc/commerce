import { BadRequestException } from '@nestjs/common';
import { warrantyUntil } from '../common/dates';
import {
  formatCountNumber,
  formatReceivingNumber,
  formatReturnNumber,
  formatTransferNumber,
} from '../common/document-numbers';
import {
  CompanySettings,
  DeliveryMethod,
  PaymentMethod,
  Prisma,
  ReturnDecision,
  ReturnReason,
  SerialUnitStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { Tx } from '../stock/stock-ledger.service';
import { day, DocumentData, money } from './document-data';

// Printed documents are in Montenegrin, Latin script.

export interface BuiltDocument {
  data: DocumentData;
  counterpartyName?: string | null;
  total?: Prisma.Decimal | null;
  links: {
    orderId?: string;
    receivingId?: string;
    transferId?: string;
    returnId?: string;
    inventoryCountId?: string;
    warehouseId?: string;
    supplierId?: string;
    customerId?: string | null;
  };
}

const PAYMENT: Record<PaymentMethod, string> = {
  CARD_ONLINE: 'Kartica (online)',
  CASH_ON_DELIVERY: 'Pouzećem',
  BANK_TRANSFER: 'Uplata na račun',
};
const DELIVERY: Record<DeliveryMethod, string> = {
  PICKUP: 'Lično preuzimanje',
  COURIER: 'Kurirska služba',
};
const REASON: Record<ReturnReason, string> = {
  DEFECTIVE: 'neispravno',
  CHANGED_MIND: 'odustanak od kupovine',
  DAMAGED: 'oštećeno',
  WRONG_ITEM: 'pogrešan artikal',
  OTHER: 'drugo',
};
const DECISION: Record<ReturnDecision, string> = {
  RESTOCK: 'Vraćeno na stanje',
  SCRAP: 'Otpisano',
  REJECT: 'Odbijeno',
};

const compact = (lines: (string | null | undefined | false)[]) =>
  lines.filter((l): l is string => !!l);

export function companyBlock(c: CompanySettings): DocumentData['company'] {
  return {
    name: c.legalName || c.name,
    lines: compact([
      c.address,
      c.taxId && `PIB: ${c.taxId}`,
      c.registrationNumber && `Matični broj: ${c.registrationNumber}`,
      c.bankAccount && `Žiro račun: ${c.bankAccount}`,
      compact([c.phone, c.email, c.website]).join(' · ') || null,
    ]),
  };
}

function customerParty(o: {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string | null;
}) {
  return {
    label: 'Kupac',
    lines: compact([
      o.customerName,
      o.customerPhone,
      o.customerEmail,
      o.deliveryAddress,
    ]),
  };
}

const person = (u: { name: string } | null | undefined) => u?.name ?? '—';
const serialNote = (serials: string[]) =>
  serials.length ? `Serijski broj: ${serials.join(', ')}` : undefined;
const itemName = (name: string, sku: string) => `${name}\nŠifra ${sku}`;
const orderNo = (n: number) => `br. ${n}`;

/** Prices include VAT (retail); the invoice shows how much of each amount is VAT. */
function splitVat(gross: Prisma.Decimal, ratePercent: Prisma.Decimal) {
  const net = gross.div(ratePercent.div(100).add(1)).toDecimalPlaces(2);
  return { net, vat: gross.sub(net) };
}

// ---------------------------------------------------------------------------

export async function buildInvoice(
  tx: Tx,
  orderId: string,
  company: CompanySettings,
): Promise<BuiltDocument> {
  const o = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { orderBy: { productName: 'asc' } },
      promoCode: { select: { code: true } },
    },
  });
  const byRate = new Map<
    string,
    { net: Prisma.Decimal; vat: Prisma.Decimal }
  >();
  const add = (
    rate: Prisma.Decimal,
    net: Prisma.Decimal,
    vat: Prisma.Decimal,
  ) => {
    const key = rate.toString();
    const cur = byRate.get(key) ?? {
      net: new Prisma.Decimal(0),
      vat: new Prisma.Decimal(0),
    };
    byRate.set(key, { net: cur.net.add(net), vat: cur.vat.add(vat) });
  };

  const rows: DocumentData['rows'] = o.items.map((i, n) => {
    const { net, vat } = splitVat(i.lineTotal, i.vatPercent);
    add(i.vatPercent, net, vat);
    return {
      cells: {
        n: String(n + 1),
        item: itemName(i.productName, i.sku),
        qty: String(i.quantity),
        price: money(i.unitPrice),
        rate: `${i.vatPercent.toString()}%`,
        net: money(net),
        vat: money(vat),
        total: money(i.lineTotal),
      },
    };
  });
  if (o.deliveryFee.gt(0)) {
    const rate = company.defaultVatPercent;
    const { net, vat } = splitVat(o.deliveryFee, rate);
    add(rate, net, vat);
    rows.push({
      cells: {
        n: String(rows.length + 1),
        item: `Dostava (${DELIVERY[o.deliveryMethod].toLowerCase()})`,
        qty: '1',
        price: money(o.deliveryFee),
        rate: `${rate.toString()}%`,
        net: money(net),
        vat: money(vat),
        total: money(o.deliveryFee),
      },
    });
  }

  const netTotal = [...byRate.values()].reduce(
    (s, r) => s.add(r.net),
    new Prisma.Decimal(0),
  );
  const cur = company.currency;
  return {
    data: {
      title: 'Račun',
      company: companyBlock(company),
      parties: [customerParty(o)],
      meta: [
        { label: 'Narudžba', value: orderNo(o.number) },
        { label: 'Datum narudžbe', value: day(o.createdAt) },
        { label: 'Plaćanje', value: PAYMENT[o.paymentMethod] },
        { label: 'Isporuka', value: DELIVERY[o.deliveryMethod] },
        ...(o.promoCode
          ? [
              {
                label: 'Promo kod',
                value: `${o.promoCode.code} (popust ${money(o.discountTotal)} ${company.currency}, uračunat u cijene)`,
              },
            ]
          : []),
      ],
      columns: [
        { key: 'n', label: 'Rb.', width: 4, align: 'right' },
        { key: 'item', label: 'Naziv', width: 27 },
        { key: 'qty', label: 'Kol.', width: 5, align: 'right' },
        { key: 'price', label: `Cijena, ${cur}`, width: 10, align: 'right' },
        { key: 'rate', label: 'PDV', width: 6, align: 'right' },
        { key: 'net', label: 'Osnovica', width: 10, align: 'right' },
        { key: 'vat', label: 'Iznos PDV', width: 10, align: 'right' },
        { key: 'total', label: `Ukupno, ${cur}`, width: 11, align: 'right' },
      ],
      rows,
      totals: [
        { label: 'Ukupno bez PDV-a', value: money(netTotal) },
        ...[...byRate].map(([rate, r]) => ({
          label: `PDV ${rate}%`,
          value: money(r.vat),
        })),
        {
          label: `Ukupno za uplatu, ${cur}`,
          value: money(o.total),
          bold: true,
        },
      ],
      notes: compact([
        o.paymentMethod === PaymentMethod.BANK_TRANSFER &&
          company.bankAccount &&
          `Molimo uplatite na žiro račun ${company.bankAccount}, poziv na broj: narudžba ${o.number}.`,
        'Cijene su sa uračunatim PDV-om.',
      ]),
      signatures: ['Izdao'],
    },
    counterpartyName: o.customerName,
    total: o.total,
    links: { orderId: o.id, customerId: o.userId },
  };
}

export async function buildDeliveryNote(
  tx: Tx,
  orderId: string,
  company: CompanySettings,
  issuedBy: string,
): Promise<BuiltDocument> {
  const o = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        orderBy: { productName: 'asc' },
        include: {
          serialUnits: {
            where: { status: SerialUnitStatus.SOLD },
            select: { serialNumber: true },
          },
        },
      },
      movements: {
        where: { type: StockMovementType.SALE },
        select: { warehouse: { select: { id: true, name: true } } },
      },
    },
  });
  const warehouses = [
    ...new Map(o.movements.map((m) => [m.warehouse.id, m.warehouse])).values(),
  ];
  const cur = company.currency;
  return {
    data: {
      title: 'Otpremnica',
      company: companyBlock(company),
      parties: [customerParty(o)],
      meta: [
        { label: 'Narudžba', value: orderNo(o.number) },
        { label: 'Datum otpreme', value: day(o.shippedAt) },
        { label: 'Isporuka', value: DELIVERY[o.deliveryMethod] },
        ...(o.carrier ? [{ label: 'Prevoznik', value: o.carrier }] : []),
        ...(o.trackingNumber
          ? [{ label: 'Broj pošiljke', value: o.trackingNumber }]
          : []),
        {
          label: 'Iz skladišta',
          value: warehouses.map((w) => w.name).join(', ') || '—',
        },
      ],
      columns: [
        { key: 'n', label: 'Rb.', width: 4, align: 'right' },
        { key: 'item', label: 'Naziv', width: 39 },
        { key: 'qty', label: 'Kol.', width: 6, align: 'right' },
        { key: 'price', label: `Cijena, ${cur}`, width: 12, align: 'right' },
        { key: 'total', label: `Ukupno, ${cur}`, width: 12, align: 'right' },
      ],
      rows: o.items.map((i, n) => ({
        cells: {
          n: String(n + 1),
          item: itemName(i.productName, i.sku),
          qty: String(i.quantity),
          price: money(i.unitPrice),
          total: money(i.lineTotal),
        },
        note: serialNote(i.serialUnits.map((u) => u.serialNumber)),
      })),
      totals: [
        { label: 'Roba', value: money(o.subtotal) },
        { label: 'Dostava', value: money(o.deliveryFee) },
        { label: `Ukupno, ${cur}`, value: money(o.total), bold: true },
      ],
      notes: [],
      signatures: [`Izdao: ${issuedBy}`, 'Primio'],
    },
    counterpartyName: o.customerName,
    total: o.total,
    links: {
      orderId: o.id,
      customerId: o.userId,
      warehouseId: warehouses[0]?.id,
    },
  };
}

/** Returns null when nothing in the order carries a warranty. */
export async function buildWarrantyCard(
  tx: Tx,
  orderId: string,
  company: CompanySettings,
): Promise<BuiltDocument | null> {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const units = await tx.serialUnit.findMany({
    where: { orderItem: { orderId }, status: SerialUnitStatus.SOLD },
    select: {
      serialNumber: true,
      soldAt: true,
      product: { select: { name: true, sku: true, warrantyMonths: true } },
    },
    orderBy: [{ product: { name: 'asc' } }, { serialNumber: 'asc' }],
  });
  const covered = units.filter((u) => u.product.warrantyMonths);
  if (!covered.length) return null;
  return {
    data: {
      title: 'Garantni list',
      company: companyBlock(company),
      parties: [customerParty(o)],
      meta: [
        { label: 'Narudžba', value: orderNo(o.number) },
        { label: 'Datum prodaje', value: day(covered[0].soldAt) },
      ],
      columns: [
        { key: 'n', label: 'Rb.', width: 4, align: 'right' },
        { key: 'item', label: 'Proizvod', width: 33 },
        { key: 'serial', label: 'Serijski broj', width: 20 },
        { key: 'months', label: 'Mjeseci', width: 7, align: 'right' },
        { key: 'until', label: 'Važi do', width: 11, align: 'right' },
      ],
      rows: covered.map((u, n) => ({
        cells: {
          n: String(n + 1),
          item: itemName(u.product.name, u.product.sku),
          serial: u.serialNumber,
          months: String(u.product.warrantyMonths),
          until: day(warrantyUntil(u.soldAt, u.product.warrantyMonths)),
        },
      })),
      totals: [],
      notes: [
        'Garancija pokriva fabričke nedostatke. Ne pokriva fizička oštećenja, oštećenja tečnošću niti nestručnu popravku.',
        'Sačuvajte garantni list: serijski broj se provjerava prilikom reklamacije.',
      ],
      signatures: ['Prodavac'],
    },
    counterpartyName: o.customerName,
    total: null,
    links: { orderId: o.id, customerId: o.userId },
  };
}

export async function buildReceivingNote(
  tx: Tx,
  receivingId: string,
  company: CompanySettings,
): Promise<BuiltDocument> {
  const r = await tx.receiving.findUniqueOrThrow({
    where: { id: receivingId },
    include: {
      supplier: true,
      warehouse: true,
      confirmedBy: { select: { name: true } },
      items: {
        orderBy: { id: 'asc' },
        include: { product: { select: { name: true, sku: true } } },
      },
    },
  });
  const total = r.items.reduce(
    (s, i) => s.add(i.purchasePrice.mul(i.quantity)),
    new Prisma.Decimal(0),
  );
  const cur = company.currency;
  return {
    data: {
      title: 'Prijemnica',
      company: companyBlock(company),
      parties: [
        {
          label: 'Dobavljač',
          lines: compact([
            r.supplier.name,
            r.supplier.address,
            r.supplier.taxId && `PIB: ${r.supplier.taxId}`,
            r.supplier.phone,
          ]),
        },
      ],
      meta: [
        { label: 'Prijem', value: formatReceivingNumber(r.number) },
        {
          label: 'Dokument dobavljača',
          value:
            compact([
              r.supplierDocNumber,
              r.supplierDocDate && day(r.supplierDocDate),
            ]).join(' od ') || '—',
        },
        { label: 'Skladište', value: r.warehouse.name },
        { label: 'Datum prijema', value: day(r.confirmedAt) },
      ],
      columns: [
        { key: 'n', label: 'Rb.', width: 4, align: 'right' },
        { key: 'item', label: 'Naziv', width: 39 },
        { key: 'qty', label: 'Kol.', width: 6, align: 'right' },
        {
          key: 'price',
          label: `Nabavna cijena, ${cur}`,
          width: 13,
          align: 'right',
        },
        { key: 'total', label: `Ukupno, ${cur}`, width: 12, align: 'right' },
      ],
      rows: r.items.map((i, n) => ({
        cells: {
          n: String(n + 1),
          item: itemName(i.product.name, i.product.sku),
          qty: String(i.quantity),
          price: money(i.purchasePrice),
          total: money(i.purchasePrice.mul(i.quantity)),
        },
        note: serialNote(i.serialNumbers),
      })),
      totals: [{ label: `Ukupno, ${cur}`, value: money(total), bold: true }],
      notes: compact([r.notes]),
      signatures: [`Primio: ${person(r.confirmedBy)}`, 'Predao (dobavljač)'],
    },
    counterpartyName: r.supplier.name,
    total,
    links: {
      receivingId: r.id,
      supplierId: r.supplierId,
      warehouseId: r.warehouseId,
    },
  };
}

export async function buildTransferNote(
  tx: Tx,
  transferId: string,
  company: CompanySettings,
): Promise<BuiltDocument> {
  const t = await tx.transfer.findUniqueOrThrow({
    where: { id: transferId },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      sentBy: { select: { name: true } },
      items: {
        orderBy: { id: 'asc' },
        include: { product: { select: { name: true, sku: true } } },
      },
    },
  });
  const units = t.items.reduce((s, i) => s + i.quantity, 0);
  return {
    data: {
      title: 'Međuskladišnica',
      company: companyBlock(company),
      parties: [
        {
          label: 'Iz skladišta',
          lines: compact([t.fromWarehouse.name, t.fromWarehouse.address]),
        },
        {
          label: 'U skladište',
          lines: compact([t.toWarehouse.name, t.toWarehouse.address]),
        },
      ],
      meta: [
        { label: 'Prenos', value: formatTransferNumber(t.number) },
        { label: 'Datum slanja', value: day(t.sentAt) },
      ],
      columns: [
        { key: 'n', label: 'Rb.', width: 4, align: 'right' },
        { key: 'item', label: 'Naziv', width: 54 },
        { key: 'qty', label: 'Kol.', width: 8, align: 'right' },
      ],
      rows: t.items.map((i, n) => ({
        cells: {
          n: String(n + 1),
          item: itemName(i.product.name, i.product.sku),
          qty: String(i.quantity),
        },
        note: serialNote(i.serialNumbers),
      })),
      totals: [{ label: 'Ukupno komada', value: String(units), bold: true }],
      notes: compact([t.notes]),
      signatures: [`Poslao: ${person(t.sentBy)}`, 'Primio'],
    },
    counterpartyName: t.toWarehouse.name,
    total: null,
    links: { transferId: t.id, warehouseId: t.fromWarehouseId },
  };
}

export async function buildReturnNote(
  tx: Tx,
  returnId: string,
  company: CompanySettings,
): Promise<BuiltDocument> {
  const r = await tx.return.findUniqueOrThrow({
    where: { id: returnId },
    include: {
      order: true,
      warehouse: { select: { name: true } },
      decidedBy: { select: { name: true } },
      items: { orderBy: { id: 'asc' }, include: { orderItem: true } },
    },
  });
  if (!r.refundAmount)
    throw new BadRequestException('Only approved returns get a return note');
  const cur = company.currency;
  return {
    data: {
      title: 'Povratnica',
      company: companyBlock(company),
      parties: [customerParty(r.order)],
      meta: [
        { label: 'Povraćaj', value: formatReturnNumber(r.number) },
        { label: 'Narudžba', value: orderNo(r.order.number) },
        { label: 'Primljeno u', value: r.warehouse?.name ?? '—' },
        { label: 'Datum odluke', value: day(r.decidedAt) },
      ],
      columns: [
        { key: 'n', label: 'Rb.', width: 4, align: 'right' },
        { key: 'item', label: 'Naziv', width: 29 },
        { key: 'qty', label: 'Kol.', width: 5, align: 'right' },
        { key: 'reason', label: 'Razlog', width: 13 },
        { key: 'decision', label: 'Odluka', width: 12 },
        {
          key: 'refund',
          label: `Za povraćaj, ${cur}`,
          width: 11,
          align: 'right',
        },
      ],
      rows: r.items.map((i, n) => ({
        cells: {
          n: String(n + 1),
          item: itemName(i.orderItem.productName, i.orderItem.sku),
          qty: String(i.quantity),
          reason: REASON[i.reason],
          decision: i.decision ? DECISION[i.decision] : '—',
          refund:
            i.decision === ReturnDecision.REJECT
              ? money(0)
              : money(i.orderItem.unitPrice.mul(i.quantity)),
        },
        note: serialNote(i.serialNumbers),
      })),
      totals: [
        {
          label: `Za povraćaj, ${cur}`,
          value: money(r.refundAmount),
          bold: true,
        },
      ],
      notes: compact([r.note]),
      signatures: [`Odobrio: ${person(r.decidedBy)}`, 'Kupac'],
    },
    counterpartyName: r.order.customerName,
    total: r.refundAmount,
    links: { returnId: r.id, orderId: r.orderId, customerId: r.order.userId },
  };
}

export async function buildInventoryAct(
  tx: Tx,
  countId: string,
  company: CompanySettings,
): Promise<BuiltDocument> {
  const c = await tx.inventoryCount.findUniqueOrThrow({
    where: { id: countId },
    include: {
      warehouse: true,
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      lines: {
        orderBy: { product: { name: 'asc' } },
        include: {
          product: { select: { name: true, sku: true, purchasePrice: true } },
        },
      },
    },
  });
  const category = c.categoryId
    ? await tx.category.findUnique({
        where: { id: c.categoryId },
        select: { name: true },
      })
    : null;
  let shortage = 0;
  let surplus = 0;
  let value = new Prisma.Decimal(0);
  const rows = c.lines.map((l, n) => {
    const expected = l.expectedQuantity ?? 0;
    const diff = l.countedQuantity - expected;
    if (diff < 0) shortage -= diff;
    else surplus += diff;
    const diffValue = l.product.purchasePrice.mul(diff);
    value = value.add(diffValue);
    return {
      cells: {
        n: String(n + 1),
        item: itemName(l.product.name, l.product.sku),
        expected: String(expected),
        counted: String(l.countedQuantity),
        diff: diff > 0 ? `+${diff}` : String(diff),
        value: money(diffValue),
      },
    };
  });
  const cur = company.currency;
  return {
    data: {
      title: 'Popisna lista',
      company: companyBlock(company),
      parties: [
        {
          label: 'Skladište',
          lines: compact([c.warehouse.name, c.warehouse.address]),
        },
      ],
      meta: [
        { label: 'Popis', value: formatCountNumber(c.number) },
        {
          label: 'Obuhvat',
          value: category ? `Kategorija: ${category.name}` : 'Cijelo skladište',
        },
        { label: 'Početak', value: day(c.createdAt) },
        { label: 'Odobreno', value: day(c.approvedAt) },
      ],
      columns: [
        { key: 'n', label: 'Rb.', width: 4, align: 'right' },
        { key: 'item', label: 'Naziv', width: 31 },
        { key: 'expected', label: 'Knjižno', width: 8, align: 'right' },
        { key: 'counted', label: 'Popisano', width: 8, align: 'right' },
        { key: 'diff', label: 'Razlika', width: 8, align: 'right' },
        {
          key: 'value',
          label: `Po nabavnoj cijeni, ${cur}`,
          width: 13,
          align: 'right',
        },
      ],
      rows,
      totals: [
        { label: 'Manjak, kom.', value: String(shortage) },
        { label: 'Višak, kom.', value: String(surplus) },
        {
          label: `Neto razlika po nabavnoj cijeni, ${cur}`,
          value: money(value),
          bold: true,
        },
      ],
      notes: compact([c.notes]),
      signatures: [
        `Popisao: ${person(c.createdBy)}`,
        `Odobrio: ${person(c.approvedBy)}`,
      ],
    },
    counterpartyName: c.warehouse.name,
    total: value,
    links: { inventoryCountId: c.id, warehouseId: c.warehouseId },
  };
}
