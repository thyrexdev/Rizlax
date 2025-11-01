import { Router } from 'express';
import MilestoneController from '../controllers/Milestone.ts';
import { AuthGuard } from 'common-middleware/src/AuthGuard.ts';

export const createMilestoneRouter = (
  milestoneController: MilestoneController
): Router => {
  const router = Router();

  router.use(AuthGuard);

  const bindHandler = (handler: Function) => handler.bind(milestoneController);

  router.post('/', bindHandler(milestoneController.createMilestone));
  router.get('/:contractId', bindHandler(milestoneController.getMilestones));
  router.get('/:milestoneId/detail', bindHandler(milestoneController.getMilestoneById));
  router.put('/:milestoneId', bindHandler(milestoneController.updateMilestone));
  router.post('/:milestoneId/approve-by-freelancer', bindHandler(milestoneController.markMilestoneAsApprovedByFreelancer));
  router.post('/:milestoneId/reject', bindHandler(milestoneController.rejectMilestone));
  router.post('/:milestoneId/submit', bindHandler(milestoneController.submitMilestone));
  router.post('/:milestoneId/dispute', bindHandler(milestoneController.disputeMilestone));
  router.post('/:milestoneId/approve-by-client', bindHandler(milestoneController.approveWorkByClient));
  router.post('/:milestoneId/request-deletion', bindHandler(milestoneController.requestDeletion));
  router.post('/:milestoneId/accept-deletion', bindHandler(milestoneController.acceptRequestDeletion));

  return router;
};