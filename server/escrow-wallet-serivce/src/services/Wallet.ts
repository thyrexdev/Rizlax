import { prisma } from "db-client/index.ts";
import {
  PrismaClient,
  Role,
  UserStatus,
  TransactionType,
} from "@prisma/client";
import type { Wallet } from "@prisma/client";

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

class WalletService {
  /**
  تهيئة سجل المحفظة للمستخدم الجديد.
   يتم استدعاؤها عند تسجيل المستخدم أو عند الحاجة للتأكد من وجود سجل له.
   */
  public async initializeUserWallet(
    userId: string,
    role: Role
  ): Promise<Wallet> {
    try {
      const wallet = await prisma.wallet.upsert({
        where: { userId: userId },
        update: {},
        create: {
          userId: userId,
          availableBalance: 0,
          pendingBalance: 0,
        },
      });
      return wallet;
    } catch (error) {
      console.error("Error initializing user wallet:", error);
      throw new Error("Failed to ensure user wallet existence.");
    }
  }

  /**
   *  تحديث (زيادة) الرصيد المعلق للمستقل.
   * تُستخدم هذه الدالة بشكل خاص *داخل معاملة Escrow* لضمان تحويل الأموال بأمان.
   * @param tx Prisma Transaction Client.
   * @param userId معرف المستقل.
   * @param amount المبلغ المراد إضافته إلى الرصيد المعلق (بالقرش).
   */
  public async updatePendingBalance(
    tx: TransactionClient,
    userId: string,
    amount: number
  ): Promise<void> {
    if (amount <= 0) return;

    const walletUpdate = await tx.wallet.updateMany({
      where: {
        userId: userId,
        user: { role: Role.FREELANCER, status: UserStatus.ACTIVE },
      },
      data: {
        pendingBalance: { increment: amount },
      },
    });

    if (walletUpdate.count === 0) {
      throw new Error(
        `Freelancer ${userId} wallet not found or is inactive. Aborting Escrow transaction.`
      );
    }

    const wallet = await tx.wallet.findUnique({ where: { userId: userId } });
    if (wallet) {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: amount,
          type: TransactionType.RELEASE,
          metadata: { source: "Milestone Completion (Pending)" },
        },
      });
    }
  }

  /**
   تحويل مبلغ من الرصيد المعلق إلى الرصيد القابل للسحب.
   */
  public async movePendingToAvailable(
    userId: string,
    amount: number
  ): Promise<void> {
    if (amount <= 0) return;

    await prisma.$transaction(
      async (tx) => {
        const walletCheck = await tx.wallet.findUnique({
          where: { userId: userId },
        });

        if (!walletCheck || walletCheck.pendingBalance < amount) {
          throw new Error("Insufficient pending balance to move to available.");
        }

        const updatedWallet = await tx.wallet.update({
          where: { userId: userId },
          data: {
            pendingBalance: { decrement: amount },
            availableBalance: { increment: amount },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: updatedWallet.id,
            amount: amount,
            type: TransactionType.ADJUSTMENT,
            metadata: { source: "Pending to Available Move" },
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }

  /**
   سحب مبلغ السحب من الرصيد المتاح.
   */
  public async processPayoutDeduction(
    userId: string,
    amount: number,
    withdrawalId: string
  ): Promise<void> {
    if (amount <= 0) return;

    await prisma.$transaction(
      async (tx) => {
        const walletCheck = await tx.wallet.findUnique({
          where: { userId: userId },
        });

        if (!walletCheck || walletCheck.availableBalance < amount) {
          throw new Error(
            "Insufficient available balance for payout deduction."
          );
        }

        const updatedWallet = await tx.wallet.update({
          where: { userId: userId },
          data: {
            availableBalance: { decrement: amount },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: updatedWallet.id,
            amount: amount,
            type: TransactionType.WITHDRAWAL,
            relatedId: withdrawalId,
            metadata: { source: "Payout Deduction" },
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }

  /**
 جلب رصيد المستخدم بالكامل.
   */
  public async getWallet(userId: string): Promise<{
    availableBalance: number;
    pendingBalance: number;
    totalBalance: number;
  } | null> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: userId },
    });

    if (!wallet) return null;

    const available = wallet.availableBalance / 100;
    const pending = wallet.pendingBalance / 100;

    return {
      availableBalance: available,
      pendingBalance: pending,
      totalBalance: available + pending,
    };
  }
}

export default WalletService;
