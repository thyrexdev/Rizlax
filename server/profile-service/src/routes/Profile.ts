import { Router } from "express";
import ProfileController from "../controllers/Profile.ts";
import { AuthGuard } from "common-middleware/src/AuthGuard.ts";

interface IProfileController {
  getFreelancerPublicProfile: typeof ProfileController.prototype.getFreelancerPublicProfile;
  getClientProfile: typeof ProfileController.prototype.getClientProfile;
  updateClientProfile: typeof ProfileController.prototype.updateClientProfile;
  getClientStats: typeof ProfileController.prototype.getClientStats;
  getFreelancerProfile: typeof ProfileController.prototype.getFreelancerProfile;
  updateFreelancerProfile: typeof ProfileController.prototype.updateFreelancerProfile;
  updateSkills: typeof ProfileController.prototype.updateSkills;
  createPortfolioProject: typeof ProfileController.prototype.createPortfolioProject;
  updatePortfolioProject: typeof ProfileController.prototype.updatePortfolioProject;
  deletePortfolioProject: typeof ProfileController.prototype.deletePortfolioProject;
}

export default function createProfileRouter(
  ProfileController: IProfileController
): Router {
  const router = Router();

  // =========================================================================
  //                             PUBLIC ROUTES (مسارات عامة)
  // =========================================================================

  router.get(
    "/public/:userId",
    ProfileController.getFreelancerPublicProfile.bind(ProfileController)
  );

  // =========================================================================
  //                             CLIENT ROUTES (مسارات العميل - تتطلب التوثيق)
  // =========================================================================
  router.get(
    "/client",
    AuthGuard,
    ProfileController.getClientProfile.bind(ProfileController)
  );
  router.put(
    "/client",
    AuthGuard,
    ProfileController.updateClientProfile.bind(ProfileController)
  );
  router.get(
    "/client/stats",
    AuthGuard,
    ProfileController.getClientStats.bind(ProfileController)
  );
  // router.get('/client/jobs', AuthGuard, ProfileController.getClientJobs);

  // =========================================================================
  //                          FREELANCER PRIVATE ROUTES (مسارات المستقل الخاصة)
  // =========================================================================
  router.get(
    "/freelancer",
    AuthGuard,
    ProfileController.getFreelancerProfile.bind(ProfileController)
  );
  router.put(
    "/freelancer",
    AuthGuard,
    ProfileController.updateFreelancerProfile.bind(ProfileController)
  );

  // Skills
  router.put(
    "/freelancer/skills",
    AuthGuard,
    ProfileController.updateSkills.bind(ProfileController)
  );

  // Portfolio
  router.post(
    "/freelancer/portfolio",
    AuthGuard,
    ProfileController.createPortfolioProject.bind(ProfileController)
  );
  router.put(
    "/freelancer/portfolio/:projectId",
    AuthGuard,
    ProfileController.updatePortfolioProject.bind(ProfileController)
  );
  router.delete(
    "/freelancer/portfolio/:projectId",
    AuthGuard,
    ProfileController.deletePortfolioProject.bind(ProfileController)
  );

  return router;
}
