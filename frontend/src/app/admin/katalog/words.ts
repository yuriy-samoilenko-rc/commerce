import { count } from "@/lib/format";

/** 1 proizvod, 3 proizvoda, 11 proizvoda, 21 proizvod. */
const one = (n: number) => n % 10 === 1 && n % 100 !== 11;
const few = (n: number) => [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);

export const products = (n: number) => `${count(n)} ${one(n) ? "proizvod" : "proizvoda"}`;
export const subcategories = (n: number) =>
  `${count(n)} ${one(n) ? "podkategorija" : few(n) ? "podkategorije" : "podkategorija"}`;
