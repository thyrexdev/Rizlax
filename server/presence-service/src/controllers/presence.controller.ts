import type { Request, Response } from 'express';
import  PresenceService  from '../services/presence.service.ts';

interface AuthGuardRequest extends Request {
  userId?: string;
}

class PresenceController {
  private service: PresenceService;

  constructor(presenceServiceInstance: PresenceService) {
    this.service = presenceServiceInstance;
  }

  public async getUserPresence(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const presence = await this.service.getUserPresence(userId);
      if (presence) {
        res.status(200).json({ userId, presence });
      } else {
        res.status(404).json({ error: "Presence not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default PresenceController;