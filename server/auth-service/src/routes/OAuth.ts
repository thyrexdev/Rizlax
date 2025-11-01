import { Router } from 'express';
import OAuth from '../controllers/OAuth.ts';

interface IOAuthController {
    googleOAuth: typeof OAuth.prototype.googleOAuth;
    getOAuthConfig: typeof OAuth.prototype.getOAuthConfig;
    unlinkGoogleProvider: typeof OAuth.prototype.unlinkGoogleProvider;
}


export default function createOAuthRouter(oauthController: IOAuthController): Router {
    const router = Router();

    router.get('/config', oauthController.getOAuthConfig.bind(oauthController));
    router.post('/google', oauthController.googleOAuth.bind(oauthController));
    router.post('/unlink/google', oauthController.unlinkGoogleProvider.bind(oauthController));

    return router;
}
