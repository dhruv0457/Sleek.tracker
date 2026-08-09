import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const log: ("error" | "warn")[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  // PostgreSQL (Supabase / Neon / Vercel Postgres) - both local dev and production
  if (!dbUrl.startsWith("postgres")) {
    throw new Error(
      "DATABASE_URL must start with 'postgres://' or 'postgresql://' (PostgreSQL). " +
      `Got: ${dbUrl.slice(0, 16)}…`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: dbUrl,
    // Vercel serverless: cap pool so each lambda doesn't blow the
    // connection ceiling. Supabase's free pool typically allows 60
    // simultaneous connections — be conservative.
    max: process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : 5,
    // Idle-lambda connections time out so warm lambdas don't hold them.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;