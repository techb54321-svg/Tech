import { PrismaClient } from "@prisma/client";

import "./env";

// One client per process. The globalThis cache exists because Next.js reloads
// modules in development and would otherwise open a new connection per edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
