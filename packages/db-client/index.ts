// packages/db-client/src/index.ts

import { PrismaClient } from '@prisma/client';

// هذا هو الـ Client الوحيد الذي سيتصل بالـ DB
const prisma = new PrismaClient();

// دالة مُشتركة للربط والفصل
async function connectDB() {
    try {
        await prisma.$connect();
        console.log("✅ [DB Client]: Shared Database connected successfully!");
    } catch (error) {
        console.error("❌ [DB Client]: Shared Database connection failed.", error);
        process.exit(1);
    }
}

// تصدير الـ Client والدالة
export { prisma, connectDB };