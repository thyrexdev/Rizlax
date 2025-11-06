import { redis } from "@rizlax/redis";
import logger from "@rizlax/logs";

class PresenceService {
  
  public async getUserPresence(userId: string): Promise<string | null> {
    try {
      const client = redis.getClient();
      const presence = await client.get(`presence:${userId}`);
      // i want to add last seen time here
      
      return presence;
    } catch (error) {
      logger.error(`Failed to get presence for user ${userId}: ${error}`);
      return null;
    }
  }
}

export default PresenceService;
