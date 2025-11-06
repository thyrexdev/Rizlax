import { prisma } from "@rizlax/db-client";
import { generateOtp } from "../utils/generateOtp.ts";
import { sendOtpEmail, OtpEmailType } from "../utils/sendOtpEmail.ts";
import { OTP_CONFIGS } from "../config/otpConfig.ts";
import logger from "@rizlax/logs";

interface CreateAndSendOtpResult {
  message: string;
  expiresAt: Date;
}

interface VerifyOtpResult {
  success: boolean;
  message: string;
}

class OtpService {
  public async createAndSendOtp(email: string, otpType: OtpEmailType) {
    const config = OTP_CONFIGS[otpType];
    const now = new Date();
    
    // 1. Rate Limiting Check (Excellent, keeps same functionality)
    const recentOtp = await prisma.otp.findFirst({
      where: {
        email,
        type: otpType,
        createdAt: {
          gte: new Date(now.getTime() - 2 * 60 * 1000), // 2 minutes ago
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentOtp) {
      throw new Error("Please wait before requesting another OTP");
    }

    // 2. Invalidate Old OTPs (Excellent, keeps same functionality)
    await prisma.otp.updateMany({
      where: {
        email,
        type: otpType,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
      },
    });

    const otp = generateOtp(config.length);
    const expiresAt = new Date(
      now.getTime() + config.expiryMinutes * 60 * 1000
    );

    await prisma.otp.create({
      data: {
        email,
        otp,
        type: otpType,
        expiresAt,
        attempts: 0,
      },
    });

    await sendOtpEmail(email, otp, otpType);

    logger.info(`OTP sent successfully to ${email} for type ${otpType}`);
    return {
      message: "OTP sent successfully",
      expiresAt,
    };
  }

  public async verifyOtp(email: string, otp: string, otpType: OtpEmailType) {
    const config = OTP_CONFIGS[otpType];
    const now = new Date();

    const otpRecord = await prisma.otp.findFirst({
      where: {
        email,
        type: otpType,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 1. Security Check: Mask all errors.
    if (!otpRecord) {
        logger.warn(`Verification failed: No pending record found for ${email} / ${otpType}`);
        throw new Error("Invalid verification code provided."); 
    }

    // 2. Expiration Check & Clean-up (Security Masking applied)
    if (otpRecord.expiresAt < now || otpRecord.attempts >= config.maxAttempts) {
        if (otpRecord.status !== "EXPIRED") {
             await prisma.otp.update({
                where: { id: otpRecord.id },
                data: { status: "EXPIRED" },
             });
        }
        logger.warn(`Verification failed: OTP expired or max attempts reached for ${email}`);
        throw new Error("Invalid verification code provided."); // خطأ عام
    }
    
    // 3. OTP Match Check
    if (otpRecord.otp !== otp) {
        try {
             await prisma.otp.update({
                where: { 
                    id: otpRecord.id, 
                    // نضمن أننا لن نزيد العداد بعد الحد الأقصى (Safe Guard)
                    attempts: { lt: config.maxAttempts - 1 } 
                },
                data: {
                    attempts: { increment: 1 },
                    lastAttempt: now,
                },
            });
        } catch (e) {
        }
       
        logger.warn(`Verification failed: Incorrect OTP for ${email}`);
        throw new Error("Invalid verification code provided."); // خطأ عام
    }

    // 4. Verification Success (Final Atomic Update to VERIFIED)
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: {
        status: "VERIFIED",
        verifiedAt: now,
      },
    });
    
    logger.info(`OTP verified successfully for ${email}`);
    return {
      success: true,
      message: "OTP verified successfully",
    };
  }

  public async cleanupExpiredOtps(): Promise<void> {
    const now = new Date();
    await prisma.otp.updateMany({
      where: {
        expiresAt: {
          lt: now,
        },
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
      },
    });
  }
}

export default OtpService;