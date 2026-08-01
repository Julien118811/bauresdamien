import { PrismaClient } from '@prisma/client';

/** Instance Prisma partagée. */
export const prisma = new PrismaClient();
