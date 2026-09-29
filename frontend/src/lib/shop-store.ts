import { useSyncExternalStore } from "react";

/**
 * Small stores kept in localStorage: the cart, the compare list and a guest's wishlist.
 * They live in the browser only (the server learns about the cart at checkout), and stay
 * in step across tabs through the "storage" event.
 */
function createStore<T>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let value: T | undefined;

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : empty;
    } catch {
      return empty;
    }
  };
  const get = () => (value ??= read());
  const set = (next: T) => {
    value = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private mode or a full disk: the list still works for this page view.
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      value = read();
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };
  return { get, set, subscribe, empty };
}

type Store<T> = ReturnType<typeof createStore<T>>;

/** The store's value; the server (and the first render) sees it empty. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.empty);
}

// ---------- cart ----------

export type CartLine = { productId: string; quantity: number };
/** The API accepts up to 100 per line; a shop cart never needs that many. */
export const MAX_QTY = 20;

export const cartStore = createStore<CartLine[]>("ts_cart", []);

export const cart = {
  add(productId: string, quantity = 1) {
    const lines = cartStore.get();
    const line = lines.find((l) => l.productId === productId);
    cartStore.set(
      line
        ? lines.map((l) => (l === line ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) } : l))
        : [...lines, { productId, quantity: Math.min(MAX_QTY, quantity) }],
    );
  },
  setQuantity(productId: string, quantity: number) {
    if (quantity <= 0) return cart.remove(productId);
    cartStore.set(cartStore.get().map((l) => (l.productId === productId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)));
  },
  remove(productId: string) {
    cartStore.set(cartStore.get().filter((l) => l.productId !== productId));
  },
  /** Drops lines whose product is gone from the shop. */
  keepOnly(productIds: string[]) {
    const keep = new Set(productIds);
    const lines = cartStore.get();
    if (lines.some((l) => !keep.has(l.productId))) cartStore.set(lines.filter((l) => keep.has(l.productId)));
  },
  clear() {
    cartStore.set([]);
  },
};

// ---------- compare ----------

export const MAX_COMPARE = 4;
export const compareStore = createStore<string[]>("ts_compare", []);

/** Adds or removes; a product beyond the limit pushes the oldest out. */
export function toggleCompare(productId: string) {
  const ids = compareStore.get();
  compareStore.set(ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId].slice(-MAX_COMPARE));
}

// ---------- guest wishlist (a customer's lives on the server) ----------

export const guestWishlistStore = createStore<string[]>("ts_wishlist", []);
