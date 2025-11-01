import { prisma } from "db-client/index.ts";
import { EscrowTransactionType, TransactionType } from "@prisma/client";
import type { Contract, EscrowAccount } from "@prisma/client";
import type { TransactionClient } from "./Wallet.ts";
import WalletService from "./Wallet.ts";

const walletService = new WalletService();

type ContractWithEscrow = Contract & {
  escrow: EscrowAccount | null;
};

/**
 * خدمة EscrowService: إدارة جميع المعاملات المالية التي تتم تحت الضمان (Escrow).
 */
class EscrowService {
  /**
   * دالة مساعدة للحصول على العقد والـ EscrowAccount الخاص به.
   * يتم استخدام اسم العلاقة "escrow" كما في مخطط Prisma، ثم إعادة تسميته داخلياً إلى "escrowAccount".
   */
  private async _getContractWithEscrow(
    contractId: string
  ): Promise<Contract & { escrowAccount: EscrowAccount }> {
    const contract = (await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        escrow: true,
      },
    })) as ContractWithEscrow | null;

    if (!contract) {
      throw new Error("Contract not found.");
    }

    if (!contract.escrow) {
      throw new Error("Escrow account is not initialized for this contract.");
    }

    // إرجاع الكائن مع حقل escrowAccount ليتوافق مع باقي تسميات الخدمة
    return {
      ...contract,
      escrowAccount: contract.escrow,
    };
  }

  /**
    إيداع مبلغ من رصيد العميل المتاح في حساب الضمان (Escrow).
    يتم استخدامها عند دفع أول دفعة أو دفعة مرحلية جديدة.
    يتم استدعاؤها من FinanceController.
   * @param userId معرف العميل الذي يقوم بالإيداع.
   * @param contractId معرف العقد.
   * @param amount المبلغ المراد إيداعه (بالقرش - Minor Units).
   */
  public async depositFunds(
    userId: string,
    contractId: string,
    amount: number
  ): Promise<void> {
    if (amount <= 0) {
      throw new Error("Deposit amount must be positive.");
    }

    // 1. جلب بيانات العقد والتحقق من صلاحية العميل
    const contractWithEscrow = await this._getContractWithEscrow(contractId);
    const { escrowAccount } = contractWithEscrow;

    if (contractWithEscrow.clientId !== userId) {
      throw new Error(
        "Unauthorized: Only the contract client can deposit funds."
      );
    }

    await prisma.$transaction(
      async (tx: TransactionClient) => {
        // 2. التحقق من رصيد العميل المتاح (في Wallet)
        const clientWallet = await tx.wallet.findUnique({
          where: { userId: userId },
        });

        if (!clientWallet || clientWallet.availableBalance < amount) {
          throw new Error("Insufficient available balance in client wallet.");
        }

        // 3. خصم المبلغ من رصيد العميل المتاح (DEDUCTION)
        await tx.wallet.update({
          where: { userId: userId },
          data: { availableBalance: { decrement: amount } },
        });

        // 4. زيادة المبلغ المحجوز في EscrowAccount
        await tx.escrowAccount.update({
          where: { id: escrowAccount.id },
          data: { heldAmount: { increment: amount } },
        });

        // 5. تسجيل المعاملة في EscrowTransaction
        await tx.escrowTransaction.create({
          data: {
            escrowAccountId: escrowAccount.id,
            amount: amount,
            type: EscrowTransactionType.DEPOSIT,
            sourceWalletId: clientWallet.id,
            description: `Deposit for contract ${contractId}`,
          },
        });

        // 6. تسجيل المعاملة في WalletTransaction للعميل (HOLD)
        await tx.walletTransaction.create({
          data: {
            walletId: clientWallet.id,
            amount: amount,
            // استخدام DEPOSIT أو HOLD - بما أن الأموال تخرج من محفظة العميل فهي HOLD فعلياً
            type: TransactionType.HOLD,
            metadata: { source: `Escrow Deposit for Contract ${contractId}` },
            relatedId: contractId,
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * [B] تحرير مبلغ من الضمان إلى الرصيد المعلق للمستقل.
   * تُستخدم عند موافقة العميل على المرحلة أو عند نهاية العقد.
   *
   * @param userId معرف العميل الذي يحرر الأموال.
   * @param contractId معرف العقد.
   * @param amount المبلغ المراد تحريره (بالقرش - Minor Units).
   */
  public async releaseFunds(
    userId: string,
    contractId: string,
    amount: number
  ): Promise<void> {
    if (amount <= 0) {
      throw new Error("Release amount must be positive.");
    }

    // 1. جلب بيانات العقد والتحقق من صلاحية العميل
    const contractWithEscrow = await this._getContractWithEscrow(contractId);
    if (contractWithEscrow.clientId !== userId) {
      throw new Error(
        "Unauthorized: Only the contract client can release funds."
      );
    }

    await prisma.$transaction(
      async (tx: TransactionClient) => {
        const { escrowAccount } = contractWithEscrow;

        // 2. التحقق من كفاية المبلغ المحجوز في EscrowAccount
        const currentEscrow = await tx.escrowAccount.findUnique({
          where: { id: escrowAccount.id },
        });

        // تم تحديث التحقق لاستخدام حقل heldAmount الصحيح
        if (!currentEscrow || currentEscrow.heldAmount < amount) {
          throw new Error(
            `Insufficient funds (${currentEscrow?.heldAmount}) held in escrow for release of ${amount}.`
          );
        }

        // 3. خصم المبلغ من EscrowAccount
        await tx.escrowAccount.update({
          where: { id: escrowAccount.id },
          data: { heldAmount: { decrement: amount } },
        });

        // 4. إضافة المبلغ إلى الرصيد المعلق للمستقل (RELEASE)
        // يتم تمرير tx إلى خدمة المحفظة لضمان بقائها ضمن المعاملة
        await walletService.updatePendingBalance(
          tx,
          contractWithEscrow.freelancerId,
          amount
        );

        // 5. تسجيل المعاملة في EscrowTransaction (RELEASE)
        const freelancerWallet = await tx.wallet.findUnique({
          where: { userId: contractWithEscrow.freelancerId },
        });

        if (freelancerWallet) {
          await tx.escrowTransaction.create({
            data: {
              escrowAccountId: escrowAccount.id,
              amount: amount,
              type: EscrowTransactionType.RELEASE,
              destinationWalletId: freelancerWallet.id,
              description: `Funds released for Contract ${contractId} milestone`,
            },
          });
        }
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
    إعادة مبلغ من الضمان إلى الرصيد المتاح للعميل.
    تُستخدم عند إلغاء العقد أو النزاعات التي تنتهي بإرجاع الأموال للعميل.
   * @param contractId معرف العقد.
   * @param amount المبلغ المراد إعادته (بالقرش - Minor Units).
   * @param isSystemRefund لتحديد ما إذا كانت العملية ناتجة عن إلغاء أو نزاع (قد تحتاج صلاحيات مشرف).
   */
  public async refundFunds(
    contractId: string,
    amount: number,
    isSystemRefund: boolean = true
  ): Promise<void> {
    if (amount <= 0) {
      throw new Error("Refund amount must be positive.");
    }

    // 1. جلب بيانات العقد
    const contractWithEscrow = await this._getContractWithEscrow(contractId);

    await prisma.$transaction(
      async (tx: TransactionClient) => {
        const { escrowAccount } = contractWithEscrow;

        // 2. التحقق من كفاية المبلغ المحجوز
        const currentEscrow = await tx.escrowAccount.findUnique({
          where: { id: escrowAccount.id },
        });

        // تم تحديث التحقق لاستخدام حقل heldAmount الصحيح
        if (!currentEscrow || currentEscrow.heldAmount < amount) {
          throw new Error(
            `Insufficient funds (${currentEscrow?.heldAmount}) held in escrow for refund of ${amount}.`
          );
        }

        // 3. خصم المبلغ من EscrowAccount
        await tx.escrowAccount.update({
          where: { id: escrowAccount.id },
          data: { heldAmount: { decrement: amount } },
        });

        // 4. إضافة المبلغ إلى الرصيد المتاح للعميل (REFUND)
        const clientWallet = await tx.wallet.update({
          where: { userId: contractWithEscrow.clientId },
          data: { availableBalance: { increment: amount } },
        });

        // 5. تسجيل المعاملة في EscrowTransaction
        await tx.escrowTransaction.create({
          data: {
            escrowAccountId: escrowAccount.id,
            amount: amount,
            type: EscrowTransactionType.REFUND,
            destinationWalletId: clientWallet.id,
            description: `Refund for contract ${contractId} (System: ${isSystemRefund})`,
          },
        });

        // 6. تسجيل المعاملة في WalletTransaction للعميل (REFUND)
        await tx.walletTransaction.create({
          data: {
            walletId: clientWallet.id,
            amount: amount,
            type: TransactionType.ADJUSTMENT,
            metadata: { source: `Escrow Refund from Contract ${contractId}` },
            relatedId: contractId,
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * [D] جلب حالة حساب الضمان ورصيده.
   * @param contractId معرف العقد.
   */
  public async getEscrowAccountStatus(
    contractId: string
  ): Promise<{ heldAmount: number; initialAmount: number } | null> {
    const escrow = await prisma.escrowAccount.findUnique({
      where: { contractId: contractId },
    });

    if (!escrow) return null;

    return {
      // تحويل من قرش إلى دولار للعرض
      heldAmount: escrow.heldAmount / 100,
      initialAmount: escrow.initialAmount / 100,
    };
  }
}

export default EscrowService;
