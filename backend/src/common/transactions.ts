// Documents with hundreds of lines post many rows; Prisma's default 5s would abort them.
export const LONG_TX = { timeout: 30_000 };
