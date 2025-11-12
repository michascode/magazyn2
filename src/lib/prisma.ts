// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// trzymamy instancję w globalThis w dev, żeby nie tworzyć wielu klientów przy hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"] // jak chcesz, dodaj "query"
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// >>> to jest kluczowe dla Twojego importu:
export default prisma;

// (opcjonalnie) typ przydaje się czasem:
export type Prisma = typeof prisma;
