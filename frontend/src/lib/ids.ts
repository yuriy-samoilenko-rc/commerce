const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are UUIDs; anything else is a 404 without asking the API. */
export const isUuid = (id: string) => UUID.test(id);
