import { OtpEmailType } from "../utils/sendOtpEmail.ts";
export const OTP_CONFIGS = {
    [OtpEmailType.PASSWORD_RESET]: {
        length: 6,
        expiryMinutes: 10,
        maxAttempts: 5,
    },
    [OtpEmailType.EMAIL_VERIFICATION]: {
        length: 6,
        expiryMinutes: 15,
        maxAttempts: 3,
    },
    [OtpEmailType.TWO_FACTOR_AUTH]: {
        length: 6,
        expiryMinutes: 5,
        maxAttempts: 3,
    },
    [OtpEmailType.ACCOUNT_VERIFICATION]: {
        length: 8,
        expiryMinutes: 30,
        maxAttempts: 5,
    },
};
