// محاكاة لأنواع Express.js القياسية في بيئة TypeScript
import type { Request, Response, NextFunction } from "express";

// افتراض أن مسارات الاستيراد لخدماتك هي ".."
import WalletService from "../services/Wallet.ts";
import EscrowService from "../services/Escrow.ts";

interface IWalletService {
  initializeUserWallet: typeof WalletService.prototype.initializeUserWallet;
  updatePendingBalance: typeof WalletService.prototype.updatePendingBalance;
  movePendingToAvailable: typeof WalletService.prototype.movePendingToAvailable;
  processPayoutDeduction: typeof WalletService.prototype.processPayoutDeduction;
  getWallet: typeof WalletService.prototype.getWallet;
}

interface IEscrowService {
  depositFunds: typeof EscrowService.prototype.depositFunds;
  releaseFunds: typeof EscrowService.prototype.releaseFunds;
  refundFunds: typeof EscrowService.prototype.refundFunds;
}

interface AuthRequest extends Request {
  user: {
    id: string;
  };
  params: { [key: string]: string };
}

/**
  FinanceController: يتحكم بجميع مسارات API المتعلقة بأرصدة المستخدمين وحسابات الضمان (Escrow).
 */
class FinanceController {
  private walletService: IWalletService;
  private escrowService: IEscrowService;

  constructor(walletService: IWalletService, escrowService: IEscrowService) {
    this.walletService = walletService;
    this.escrowService = escrowService;
  }

  // دالة مساعدة لتحويل مبالغ الدولار (Float) إلى وحدات أصغر (Integer/Cents)
  private _toMinorUnits(amount: number): number {
    // يجب ضرب المبلغ في 100 وتقريبه لضمان عدم وجود كسور عشرية في قاعدة البيانات (Prisma)
    return Math.round(amount * 100);
  }

  /**
   * [GET] /api/finance/wallet
   * يجلب الرصيد المتاح والمعلق للمستخدم المصدق.
   */
  public async getWallet(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user.id;

    try {
      const wallet = await this.walletService.getWallet(userId);

      if (!wallet) {
        res.status(404).json({ message: "Wallet not found for this user." });
        return;
      }

      // يتم إرجاع الأرصدة مقسومة على 100 للعرض
      res.status(200).json(wallet);
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res
        .status(500)
        .json({ message: "Failed to retrieve wallet information." });
    }
  }

  /**
   * [POST] /api/finance/pending/move
   * ينقل مبلغًا من الرصيد المعلق إلى الرصيد القابل للسحب (بعد انتهاء فترة الحجز).
   */
  public async movePendingToAvailable(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user.id;
    const { amount: dollarAmount } = req.body;

    if (typeof dollarAmount !== "number" || dollarAmount <= 0) {
      res.status(400).json({ message: "Invalid or missing amount." });
      return;
    }

    const amountInCents = this._toMinorUnits(dollarAmount);

    try {
      await this.walletService.movePendingToAvailable(userId, amountInCents);
      res.status(200).json({
        message: `Successfully moved $${dollarAmount.toFixed(
          2
        )} to available balance.`,
      });
    } catch (error) {
      console.error("Error moving pending funds:", error);
      // FIX: استخدام التحقق من النوع قبل الوصول إلى message
      const errorMessage = error instanceof Error ? error.message : "Failed to move pending funds due to an unknown error.";
      const statusCode = errorMessage.includes("Insufficient") ? 400 : 500;
      res.status(statusCode).json({ message: errorMessage });
    }
  }

  /**
   * [POST] /api/finance/payout/request
   * يشرع في عملية سحب الأموال (خصم المبلغ من الرصيد المتاح).
   */
  public async initiatePayout(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user.id;
    const { amount: dollarAmount, withdrawalId } = req.body;

    if (
      typeof dollarAmount !== "number" ||
      dollarAmount <= 0 ||
      !withdrawalId
    ) {
      res
        .status(400)
        .json({ message: "Invalid amount or missing withdrawal ID." });
      return;
    }

    const amountInCents = this._toMinorUnits(dollarAmount);

    try {
      await this.walletService.processPayoutDeduction(
        userId,
        amountInCents,
        withdrawalId
      );

      res.status(200).json({
        message: `Payout request of $${dollarAmount.toFixed(
          2
        )} accepted and funds deducted.`,
      });
    } catch (error) {
      console.error("Error processing payout:", error);
      // FIX: استخدام التحقق من النوع قبل الوصول إلى message
      const errorMessage = error instanceof Error ? error.message : "Failed to process payout due to an unknown error.";
      const statusCode = errorMessage.includes("Insufficient") ? 400 : 500;
      res.status(statusCode).json({ message: errorMessage });
    }
  }

  /**
   * [POST] /api/finance/escrow/deposit/:contractId
   * العميل يودع أموالاً في حساب الضمان الخاص بالعقد.
   */
  public async depositFundsToEscrow(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user.id; // يجب أن يكون عميل
    const { contractId } = req.params;
    const { amount: dollarAmount } = req.body;

    if (typeof dollarAmount !== "number" || dollarAmount <= 0) {
      res.status(400).json({ message: "Invalid deposit amount." });
      return;
    }

    const amountInCents = this._toMinorUnits(dollarAmount);

    try {
      await this.escrowService.depositFunds(userId, contractId, amountInCents);

      res.status(200).json({
        message: `Successfully deposited $${dollarAmount.toFixed(
          2
        )} into escrow for contract ${contractId}.`,
      });
    } catch (error) {
      // FIX: استخدام التحقق من النوع قبل الوصول إلى message
      const errorMessage = error instanceof Error ? error.message : "Failed to deposit funds due to an unknown error.";
      console.error("Error depositing funds to escrow:", error);
      // التعامل مع أخطاء الصلاحيات أو عدم كفاية رصيد العميل
      const statusCode =
        errorMessage.includes("Insufficient") ||
        errorMessage.includes("Unauthorized")
          ? 403
          : 500;
      res.status(statusCode).json({ message: errorMessage });
    }
  }

  /**
   * [POST] /api/finance/escrow/release/:contractId
   * العميل يحرر الأموال من الضمان إلى الرصيد المعلق للمستقل.
   */
  public async releaseFundsFromEscrow(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user.id; // يجب أن يكون عميل
    const { contractId } = req.params;
    const { amount: dollarAmount } = req.body;

    if (typeof dollarAmount !== "number" || dollarAmount <= 0) {
      res.status(400).json({ message: "Invalid release amount." });
      return;
    }

    const amountInCents = this._toMinorUnits(dollarAmount);

    try {
      await this.escrowService.releaseFunds(userId, contractId, amountInCents);

      res.status(200).json({
        message: `Successfully released $${dollarAmount.toFixed(
          2
        )} to freelancer's pending balance for contract ${contractId}.`,
      });
    } catch (error) {
      // FIX: استخدام التحقق من النوع قبل الوصول إلى message
      const errorMessage = error instanceof Error ? error.message : "Failed to release funds due to an unknown error.";
      console.error("Error releasing funds from escrow:", error);
      // التعامل مع أخطاء الصلاحيات أو عدم كفاية رصيد Escrow
      const statusCode =
        errorMessage.includes("Insufficient") ||
        errorMessage.includes("Unauthorized")
          ? 403
          : 500;
      res.status(statusCode).json({ message: errorMessage });
    }
  }

  // يمكن إضافة دالة refundFundsFromEscrow هنا أيضاً إذا لزم الأمر.
}

export default FinanceController;
