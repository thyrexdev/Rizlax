import { Router } from 'express';
import otp from '../controllers/Otp.ts';

interface IOtpController {
    requestOtp: typeof otp.prototype.requestOtp;
    verifyOtp: typeof otp.prototype.verifyOtp;
}

export default function createOtpRouter(otpController: IOtpController): Router {
    const router = Router();
    
    router.post('/request', otpController.requestOtp.bind(otpController));
    router.post('/verify', otpController.verifyOtp.bind(otpController));

    return router;
}
