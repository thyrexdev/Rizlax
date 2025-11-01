import type { Request, Response } from 'express'; // استخدام Express Types
import axios from 'axios'; 
import OAuthService from '../services/OAuth.ts'; 
import logger from 'logs/index.ts'; 

interface AuthenticatedRequest extends Request {
  user?: {
    id: string; 
    email: string;
    role: string;
  };
}

interface IOAuthService {
    handleOAuthCallback: typeof OAuthService.prototype.handleOAuthCallback;
    unlinkGoogleProvider: typeof OAuthService.prototype.unlinkGoogleProvider;
}

class GoogleAuthController {
  private oauthService: IOAuthService;

  constructor(oauthService: IOAuthService) {
    this.oauthService = oauthService;
  }

  public googleOAuth = async (req: Request, res: Response) => {
    try {
      const { code, role } = req.body;
      
      if (!code || !role) {
        return res.status(400).json({ error: 'Code and role are required' });
      }

      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.CLIENT_URL) {
        return res.status(500).json({ error: 'Google OAuth environment variables are not configured correctly' });
      }
      
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.CLIENT_URL}/auth/google/callback`
      });

      const { access_token } = tokenResponse.data;

      const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const googleProfile = profileResponse.data;
      
      const profile: any = { 
        id: googleProfile.id,
        email: googleProfile.email,
        name: googleProfile.name,
        profilePicture: googleProfile.picture,
        provider: 'GOOGLE'
      };

      const result = await this.oauthService.handleOAuthCallback(profile, role.toUpperCase() as "CLIENT" | "FREELANCER");
      
      return res.status(200).json(result);
    } catch (error: any) {
      logger.error(`Google OAuth error in controller: ${error.message}`, { details: error.response?.data || error.stack });
      return res.status(400).json({ error: 'Google authentication failed' });
    }
  }

  public getOAuthConfig = async (req: Request, res: Response) => {
    const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    return res.status(200).json({
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        enabled: googleEnabled
      },
      redirectUri: {
        google: `${process.env.CLIENT_URL}/auth/google/callback`
      }
    });
  };

  public unlinkGoogleProvider = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updatedUser = await this.oauthService.unlinkGoogleProvider(userId);
      
      return res.status(200).json({ 
          message: 'Google account unlinked successfully',
          user: updatedUser
      });
    } catch (error: any) {
      logger.error(`Unlink Google provider error in controller: ${error.message}`);
      return res.status(400).json({ error: error.message }); 
    }
  };
}

export default GoogleAuthController; 