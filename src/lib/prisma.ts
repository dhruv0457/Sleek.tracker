import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const log: ("error" | "warn")[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  // ── SQLite (local dev / file-based) ──────────────────────────────────────
  if (dbUrl.startsWith("file:")) {
    // Lazy import to avoid pulling SQLite adapter into the Vercel bundle when
    // running on PostgreSQL (keeps the serverless function cold-start small).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaSqlite } = require("prisma-adapter-sqlite");
    const adapter = new PrismaSqlite({ url: dbUrl.slice(5) });
    return new PrismaClient({ adapter, log });
  }

  // ── PostgreSQL (Vercel / Supabase / Neon production) ─────────────────────
  if (dbUrl.startsWith("postgres")) {
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

  throw new Error(
    "DATABASE_URL must start with 'file:' (SQLite) or 'postgres' (PostgreSQL). " +
    `Got: ${dbUrl.slice(0, 16)}…`
  );
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
