// Everything the UI shows is in Montenegrin (Latin script); the API speaks in codes.
import type { Role } from "./backend-types";

export const ROLE: Record<Role, string> = {
  ADMIN: "Administrator",
  MANAGER: "Menadžer",
  WAREHOUSE: "Magacioner",
  ACCOUNTANT: "Računovođa",
  CUSTOMER: "Kupac",
};

export const ORDER_STATUS: Record<string, string> = {
  NEW: "Nova",
  CONFIRMED: "Potvrđena",
  PICKING: "U pripremi",
  READY_TO_SHIP: "Spremna za slanje",
  SHIPPED: "Poslata",
  DELIVERED: "Isporučena",
  COMPLETED: "Završena",
  CANCELLED: "Otkazana",
  PARTIALLY_RETURNED: "Djelimično vraćena",
  RETURNED: "Vraćena",
};

export const PAYMENT_STATUS: Record<string, string> = {
  UNPAID: "Neplaćeno",
  PAID: "Plaćeno",
};

export const PAYMENT_METHOD: Record<string, string> = {
  CARD_ONLINE: "Kartica (online)",
  CASH_ON_DELIVERY: "Pouzećem",
  BANK_TRANSFER: "Uplata na račun",
};

export const DELIVERY_METHOD: Record<string, string> = {
  PICKUP: "Lično preuzimanje",
  COURIER: "Kurirska dostava",
};

export const ORDER_CHANNEL: Record<string, string> = {
  ONLINE: "Internet prodavnica",
  MANUAL: "Telefon / prodavnica",
};

export const ORDER_EVENT: Record<string, string> = {
  CREATED: "Narudžba kreirana",
  CONFIRMED: "Potvrđena",
  PAID: "Plaćena",
  CANCELLED: "Otkazana",
  EXPIRED: "Rezervacija istekla",
  PICKING_STARTED: "Početa priprema",
  PICKING_COMPLETED: "Pripremljena",
  SHIPPED: "Poslata",
  DELIVERED: "Isporučena",
  COMPLETED: "Završena",
  RETURN_APPROVED: "Odobren povraćaj",
};

export const DOCUMENT_TYPE: Record<string, string> = {
  INVOICE: "Račun",
  DELIVERY_NOTE: "Otpremnica",
  WARRANTY_CARD: "Garantni list",
  RECEIVING_NOTE: "Prijemnica",
  TRANSFER_NOTE: "Prenosnica",
  RETURN_NOTE: "Povratnica",
  INVENTORY_ACT: "Popisna lista",
};

export const DOCUMENT_STATUS: Record<string, string> = {
  ISSUED: "Važeći",
  CANCELLED: "Stornirani",
};

export const RECEIVING_STATUS: Record<string, string> = {
  DRAFT: "Nacrt",
  CONFIRMED: "Potvrđen",
  CANCELLED: "Otkazan",
};

export const TRANSFER_STATUS: Record<string, string> = {
  DRAFT: "Nacrt",
  IN_TRANSIT: "U prenosu",
  RECEIVED: "Primljen",
  CANCELLED: "Otkazan",
};

export const COUNT_STATUS: Record<string, string> = {
  IN_PROGRESS: "Brojanje u toku",
  COUNTED: "Izbrojano",
  APPROVED: "Odobren",
  CANCELLED: "Otkazan",
};

export const RETURN_STATUS: Record<string, string> = {
  REQUESTED: "Zahtjev primljen",
  RECEIVED: "Roba vraćena",
  APPROVED: "Odobren",
  REJECTED: "Odbijen",
  REFUNDED: "Novac vraćen",
  CANCELLED: "Otkazan",
};

export const RETURN_REASON: Record<string, string> = {
  DEFECTIVE: "Neispravan",
  CHANGED_MIND: "Kupac se predomislio",
  DAMAGED: "Oštećen pri isporuci",
  WRONG_ITEM: "Pogrešan artikal",
  OTHER: "Drugo",
};

export const RETURN_DECISION: Record<string, string> = {
  RESTOCK: "Vraća se na stanje",
  SCRAP: "Otpis",
  REJECT: "Povraćaj odbijen",
};

export const WARRANTY_STATUS: Record<string, string> = {
  OPEN: "Otvoreno",
  RECEIVED: "Uređaj primljen",
  IN_SERVICE: "U servisu",
  REPAIRED: "Popravljeno",
  CLOSED: "Zatvoreno",
  REPLACED: "Zamijenjeno",
  REJECTED: "Odbijeno",
};

export const SERIAL_STATUS: Record<string, string> = {
  IN_STOCK: "Na stanju",
  IN_TRANSIT: "U prenosu",
  WRITTEN_OFF: "Otpisano",
  SOLD: "Prodato",
  RETURNED: "Vraćeno",
  IN_SERVICE: "U servisu",
};

export const STOCK_ALERT: Record<string, string> = {
  OK: "U redu",
  LOW: "Malo robe",
  OUT: "Nema na stanju",
};

export const MOVEMENT_TYPE: Record<string, string> = {
  RECEIPT: "Prijem",
  SALE: "Prodaja",
  RETURN: "Povraćaj",
  TRANSFER_OUT: "Prenos (izlaz)",
  TRANSFER_IN: "Prenos (ulaz)",
  ADJUSTMENT: "Korekcija",
  INVENTORY: "Popis",
  WARRANTY_REPLACEMENT: "Zamjena po garanciji",
};

export const STAFF_ROLES: Role[] = ["ADMIN", "MANAGER", "WAREHOUSE", "ACCOUNTANT"];
export const FINANCE_ROLES: Role[] = ["ADMIN", "MANAGER", "ACCOUNTANT"];

export const REVIEW_STATUS: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "Čeka provjeru",
  APPROVED: "Objavljena",
  REJECTED: "Odbijena",
};
