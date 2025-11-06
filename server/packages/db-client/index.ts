
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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