import { Router } from "express";
import FinanceController from "../controllers/Finance.ts";
import { AuthGuard } from "common-middleware/src/AuthGuard.ts"; 


export const createFinanceRouter = (
    financeController: FinanceController 
): Router => {
  const router = Router();

  router.use(AuthGuard); 
  

  const bindHandler = (handler: Function) => handler.bind(financeController);

  // 1. Wallet Routes

  router.get("/wallet", bindHandler(financeController.getWallet));
  router.post("/pending/move", bindHandler(financeController.movePendingToAvailable));
  router.post("/payout/request", bindHandler(financeController.initiatePayout));

  // 2. Escrow Routes
  router.post(
    "/escrow/deposit/:contractId",
    bindHandler(financeController.depositFundsToEscrow)
  );
  router.post(
    "/escrow/release/:contractId",
    bindHandler(financeController.releaseFundsFromEscrow)
  );

  return router;
};
