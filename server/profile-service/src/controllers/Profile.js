import logger from "logs/index.ts";
class ProfileController {
    profileService;
    constructor(profileService) {
        this.profileService = profileService;
    }
    // =========================================================================
    //                         CLIENT ENDPOINTS
    // =========================================================================
    // GET /api/profile/client (Private)
    async getClientProfile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const clientProfile = await this.profileService.getClientByUserId(userId);
            return res.status(200).json(clientProfile);
        }
        catch (error) {
            logger.error("Error fetching client profile", { error: error.message });
            next(error);
        }
    }
    // PUT /api/profile/client
    async updateClientProfile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const updateData = req.body;
            const updatedProfile = await this.profileService.updateClientProfile(userId, updateData);
            return res.status(200).json(updatedProfile);
        }
        catch (error) {
            logger.error("Error updating client profile", { error: error.message });
            next(error);
        }
    }
    //GET /api/profile/client/stats
    async getClientStats(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const stats = await this.profileService.getClientStats(userId);
            return res.status(200).json(stats);
        }
        catch (error) {
            logger.error("Error fetching client stats", { error: error.message });
            next(error);
        }
    }
    // =========================================================================
    //                       FREELANCER PRIVATE ENDPOINTS
    // =========================================================================
    //  GET /api/profile/freelancer (Private)
    async getFreelancerProfile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const freelancerProfile = await this.profileService.getFreelancerByUserId(userId);
            return res.status(200).json(freelancerProfile);
        }
        catch (error) {
            logger.error("Error fetching freelancer private profile", {
                error: error.message,
            });
            next(error);
        }
    }
    // PUT /api/profile/freelancer - تحديث ملف المستقل
    async updateFreelancerProfile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const updateData = req.body;
            const updatedProfile = await this.profileService.updateFreelancerProfile(userId, updateData);
            return res.status(200).json(updatedProfile);
        }
        catch (error) {
            logger.error("Error updating freelancer profile", {
                error: error.message,
            });
            next(error);
        }
    }
    // PUT /api/profile/freelancer/skills
    async updateSkills(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const updateData = req.body;
            const updatedSkills = await this.profileService.updateSkills(userId, updateData);
            return res.status(200).json(updatedSkills);
        }
        catch (error) {
            logger.error("Error updating freelancer skills", {
                error: error.message,
            });
            next(error);
        }
    }
    // =========================================================================
    //                       PORTFOLIO ENDPOINTS
    // =========================================================================
    // POST /api/profile/freelancer/portfolio - إنشاء مشروع جديد في معرض الأعمال
    async createPortfolioProject(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const projectData = req.body;
            const newProject = await this.profileService.createProject(userId, projectData);
            return res.status(201).json(newProject);
        }
        catch (error) {
            logger.error("Error creating portfolio project", {
                error: error.message,
            });
            next(error);
        }
    }
    // PUT /api/profile/freelancer/portfolio/:projectId - تحديث مشروع موجود
    async updatePortfolioProject(req, res, next) {
        try {
            const userId = req.user?.id;
            const { projectId } = req.params;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const updateData = req.body;
            const updatedProject = await this.profileService.updateProject(userId, projectId, updateData);
            return res.status(200).json(updatedProject);
        }
        catch (error) {
            if (error.message.includes("not found or permission denied")) {
                return res.status(404).json({ message: error.message });
            }
            logger.error("Error updating portfolio project", {
                error: error.message,
            });
            next(error);
        }
    }
    // DELETE /api/profile/freelancer/portfolio/:projectId - حذف مشروع
    async deletePortfolioProject(req, res, next) {
        try {
            const userId = req.user?.id;
            const { projectId } = req.params;
            if (!userId) {
                return res.status(401).json({ message: "Unauthenticated" });
            }
            const result = await this.profileService.deleteProject(userId, projectId);
            return res.status(200).json(result);
        }
        catch (error) {
            if (error.message.includes("not found or permission denied")) {
                return res.status(404).json({ message: error.message });
            }
            logger.error("Error deleting portfolio project", {
                error: error.message,
            });
            next(error);
        }
    }
    // =========================================================================
    //                       PUBLIC ENDPOINTS
    // =========================================================================
    // GET /api/profile/public/:userId - جلب الملف العام للمستقل (متاح للجميع)
    async getFreelancerPublicProfile(req, res, next) {
        try {
            const { userId } = req.params;
            const publicProfile = await this.profileService.getPublicFreelancerProfile(userId);
            return res.status(200).json(publicProfile);
        }
        catch (error) {
            if (error.message.includes("Freelancer profile not found")) {
                return res.status(404).json({ message: error.message });
            }
            logger.error(`Error fetching public profile for user ${req.params.userId}`, { error: error.message });
            next(error);
        }
    }
}
export default ProfileController;
