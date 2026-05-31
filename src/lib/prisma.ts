import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

const connectionString = process.env.DATABASE_URL;

if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  if (!connectionString) {
    console.warn('[Prisma Initialization] WARNING: DATABASE_URL is not defined in environment variables.');
  }

  // In Next.js serverless or dev environments, create a connection pool
  const pool = new pg.Pool({
    connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/license_db',
    max: 10, // reasonable limit for serverless environment
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  const adapter = new PrismaPg(pool);

  prismaInstance = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }
}

export const prisma = prismaInstance;
export { connectionString };
