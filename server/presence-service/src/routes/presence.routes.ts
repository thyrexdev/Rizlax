import { Router } from 'express';
import { AuthGuard } from '@rizlax/common-middleware';
import PresenceController from '../controllers/presence.controller.ts';

interface IPresenceController {
  // Protected Methods
  getUserPresence: typeof PresenceController.prototype.getUserPresence;
}

export default function createPresenceRouter(
    presenceController: IPresenceController
): Router {
  const router = Router();

  router.get(
    '/:userId/online',
    (req, res) => {
        presenceController.getUserPresence.bind(presenceController)(req, res);
    }
  );


  return router;
}

