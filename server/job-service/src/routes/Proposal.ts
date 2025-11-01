import { Router } from "express";
import { AuthGuard } from "common-middleware/src/AuthGuard.ts"; 
import ProposalController from "../controllers/Proposal.ts";

interface IProposalController {
  createProposal: typeof ProposalController.prototype.createProposal;
  getProposalById: typeof ProposalController.prototype.getProposalById;
  updateProposalStatus: typeof ProposalController.prototype.updateProposalStatus;
  deleteProposal: typeof ProposalController.prototype.deleteProposal;
  getProposals: typeof ProposalController.prototype.getProposals;
  getProposalsByJobId: typeof ProposalController.prototype.getProposalsByJobId;
  getFreelancerProposals: typeof ProposalController.prototype.getFreelancerProposals;
}


export default function createProposalRouter(
  proposalController: IProposalController
): Router {
  const router = Router();

  // =========================================================================
  //                             PROTECTED ROUTES (مسارات تتطلب التوثيق)
  // =========================================================================
  
  // POST /api/proposals/ (إنشاء عرض جديد - للمستقل)
  router.post(
    "/",
    AuthGuard,
    proposalController.createProposal.bind(proposalController)
  );

  // GET /api/proposals/ (جلب قائمة العروض الخاصة بالمستخدم الحالي - عميل/مستقل)
  // يمكن تمرير فلاتر مثل ?status=PENDING
  router.get(
    "/",
    AuthGuard,
    proposalController.getProposals.bind(proposalController)
  );
  
  // GET /api/proposals/freelancer (جلب جميع العروض التي قدمها المستقل الحالي)
  router.get(
    "/freelancer",
    AuthGuard,
    proposalController.getFreelancerProposals.bind(proposalController)
  );

  // GET /api/proposals/job/:jobId (جلب جميع العروض لوظيفة معينة - للعميل الذي نشر الوظيفة فقط)
  router.get(
    "/job/:jobId",
    AuthGuard,
    proposalController.getProposalsByJobId.bind(proposalController)
  );

  // GET /api/proposals/:proposalId (جلب تفاصيل عرض معين)
  router.get(
    "/:proposalId",
    AuthGuard,
    proposalController.getProposalById.bind(proposalController)
  );

  // PUT /api/proposals/:proposalId/status (تحديث حالة العرض - للعميل فقط)
  router.put(
    "/:proposalId/status",
    AuthGuard,
    proposalController.updateProposalStatus.bind(proposalController)
  );

  // DELETE /api/proposals/:proposalId (حذف/سحب عرض - للمستقل فقط)
  router.delete(
    "/:proposalId",
    AuthGuard,
    proposalController.deleteProposal.bind(proposalController)
  );

  return router;
}
