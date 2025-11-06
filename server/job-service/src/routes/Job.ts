import { Router } from "express";
import { AuthGuard } from "@rizlax/common-middleware"
import  JobController  from "../controllers/Job.ts"

interface IJobController {
  // Public Methods
  browseJobs: typeof JobController.prototype.browseJobs;
  getJobMarketStats: typeof JobController.prototype.getJobMarketStats;
  getJobByIdPublic: typeof JobController.prototype.getJobByIdPublic;
  getFeaturedJobs: typeof JobController.prototype.getFeaturedJobs;
  // Protected Methods (Client)
  createJob: typeof JobController.prototype.createJob;
  getClientJobs: typeof JobController.prototype.getClientJobs;
  getJobById: typeof JobController.prototype.getJobById;
  updateJob: typeof JobController.prototype.updateJob;
  deleteJob: typeof JobController.prototype.deleteJob;
  getJobStats: typeof JobController.prototype.getJobStats;
  getJobProposals: typeof JobController.prototype.getJobProposals;
  updateJobStatus: typeof JobController.prototype.updateJobStatus;
}

/**
 * دالة إنشاء Router (Factory Function)
 * تتلقى نسخة JobController لربطها بالـ Routes.
 */
export default function createJobRouter(
  jobController: IJobController
): Router {
  const router = Router();

  // =========================================================================
  //                             PUBLIC ROUTES (مسارات عامة)
  // =========================================================================
  
  // GET /api/jobs/browse?filters...
  router.get(
    "/browse",
    jobController.browseJobs.bind(jobController)
  );
  
  // GET /api/jobs/stats/market
  router.get(
    "/stats/market",
    jobController.getJobMarketStats.bind(jobController)
  );

  // GET /api/jobs/featured
  router.get(
    "/featured",
    jobController.getFeaturedJobs.bind(jobController)
  );

  // GET /api/jobs/:jobId/public
  router.get(
    "/:jobId/public",
    jobController.getJobByIdPublic.bind(jobController)
  );

  // =========================================================================
  //                             PROTECTED CLIENT ROUTES (مسارات العميل - تتطلب التوثيق)
  // =========================================================================

  // POST /api/jobs (إنشاء وظيفة جديدة)
  router.post(
    "/",
    AuthGuard,
    jobController.createJob.bind(jobController)
  );

  // GET /api/jobs/client (جلب الوظائف التي نشرها العميل الحالي)
  router.get(
    "/client",
    AuthGuard,
    jobController.getClientJobs.bind(jobController)
  );
  
  // GET /api/jobs/stats (إحصائيات وظائف العميل)
  router.get(
    "/stats",
    AuthGuard,
    jobController.getJobStats.bind(jobController)
  );

  // GET /api/jobs/:jobId/proposals (جلب العروض على وظيفة معينة)
  router.get(
    "/:jobId/proposals",
    AuthGuard,
    jobController.getJobProposals.bind(jobController)
  );
  
  // GET /api/jobs/:jobId (جلب تفاصيل وظيفة معينة للتحرير/المراجعة)
  router.get(
    "/:jobId",
    AuthGuard,
    jobController.getJobById.bind(jobController)
  );

  // PUT /api/jobs/:jobId (تحديث تفاصيل وظيفة)
  router.put(
    "/:jobId",
    AuthGuard,
    jobController.updateJob.bind(jobController)
  );
  
  // PUT /api/jobs/:jobId/status (تحديث حالة الوظيفة)
  router.put(
    "/:jobId/status",
    AuthGuard,
    jobController.updateJobStatus.bind(jobController)
  );

  // DELETE /api/jobs/:jobId (حذف وظيفة)
  router.delete(
    "/:jobId",
    AuthGuard,
    jobController.deleteJob.bind(jobController)
  );

  return router;
}
