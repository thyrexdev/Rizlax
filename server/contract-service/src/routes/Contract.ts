import { Router } from "express";
import ContractController from "../controllers/Contract.ts";
import { AuthGuard } from "common-middleware/src/AuthGuard.ts";

export const createContractRouter = (
  contractController: ContractController
): Router => {
  const router = Router();

  router.use(AuthGuard);

  const bindHandler = (handler: Function) => handler.bind(contractController);

  router.post("/", bindHandler(contractController.createContract));
  router.get("/:contractId", bindHandler(contractController.getContractById));

  router.post(
    "/:contractId/start",
    bindHandler(contractController.startContract)
  );

  router.post(
    "/:contractId/submit-work",
    bindHandler(contractController.submitWork)
  );

  router.post(
    "/:contractId/complete",
    bindHandler(contractController.completeContract)
  );

  router.post(
    "/:contractId/dispute",
    bindHandler(contractController.disputeContract)
  );

  router.post(
    "/:contractId/terminate",
    bindHandler(contractController.terminateContract)
  );

  return router;
};
