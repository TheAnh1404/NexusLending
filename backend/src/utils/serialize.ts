import { Prisma } from '@prisma/client';

export const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value instanceof Prisma.Decimal) return value.toString();
      return value;
    })
  ) as T;

