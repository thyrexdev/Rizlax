import { Router } from "express";
import { AuthGuard } from "common-middleware/src/AuthGuard.ts";
export default function createProfileRouter(ProfileController) {
    const router = Router();
    // =========================================================================
    //                             PUBLIC ROUTES (مسارات عامة)
    // =========================================================================
    router.get("/public/:userId", ProfileController.getFreelancerPublicProfile.bind(ProfileController));
    // =========================================================================
    //                             CLIENT ROUTES (مسارات العميل - تتطلب التوثيق)
    // =========================================================================
    router.get("/client", AuthGuard, ProfileController.getClientProfile.bind(ProfileController));
    router.put("/client", AuthGuard, ProfileController.updateClientProfile.bind(ProfileController));
    router.get("/client/stats", AuthGuard, ProfileController.getClientStats.bind(ProfileController));
    // router.get('/client/jobs', AuthGuard, ProfileController.getClientJobs);
    // =========================================================================
    //                          FREELANCER PRIVATE ROUTES (مسارات المستقل الخاصة)
    // =========================================================================
    router.get("/freelancer", AuthGuard, ProfileController.getFreelancerProfile.bind(ProfileController));
    router.put("/freelancer", AuthGuard, ProfileController.updateFreelancerProfile.bind(ProfileController));
    // Skills
    router.put("/freelancer/skills", AuthGuard, ProfileController.updateSkills.bind(ProfileController));
    // Portfolio
    router.post("/freelancer/portfolio", AuthGuard, ProfileController.createPortfolioProject.bind(ProfileController));
    router.put("/freelancer/portfolio/:projectId", AuthGuard, ProfileController.updatePortfolioProject.bind(ProfileController));
    router.delete("/freelancer/portfolio/:projectId", AuthGuard, ProfileController.deletePortfolioProject.bind(ProfileController));
    return router;
}
