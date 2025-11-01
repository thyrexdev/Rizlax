import type { Request, Response, NextFunction } from "express";
import logger from "logs/index.ts";
import OtpService from "../services/Otp.ts";
import { OtpEmailType } from "../utils/sendOtpEmail.ts";

interface IOtpService {
  createAndSendOtp: typeof OtpService.prototype.createAndSendOtp;
  verifyOtp: typeof OtpService.prototype.verifyOtp;
}

class OtpController {
  private otpService: IOtpService;

  constructor(otpService: IOtpService) {
    this.otpService = otpService;
  }

  public async requestOtp(req: Request, res: Response, next: NextFunction) {
    const { email, type } = req.body;

    if (!email || !type) {
      logger.warn("OTP Request failed: Missing email or type in request body.");
      return res
        .status(400)
        .json({ error: "Email and OTP type are required." });
    }

    try {
      const result = await this.otpService.createAndSendOtp(
        email,
        type as OtpEmailType
      );

      return res.status(200).json({
        message: result.message,
        expiresAt: result.expiresAt,
      });
    } catch (error: any) {
      logger.error(
        `Request OTP error for ${email} (${type}): ${error.message}`
      );

      if (error.message.includes("Please wait before requesting another OTP")) {
        return res.status(429).json({ error: error.message });
      }

      return res.status(500).json({
        error: "Failed to process OTP request. Please try again later.",
      });
    }
  }

  public async verifyOtp(req: Request, res: Response, next: NextFunction) {
    const { email, otp, type } = req.body;

    if (!email || !otp || !type) {
      logger.warn("OTP Verification failed: Missing data in request body.");
      return res
        .status(400)
        .json({ error: "Email, OTP code, and type are required." });
    }

    try {
      await this.otpService.verifyOtp(email, otp, type as OtpEmailType);

      return res
        .status(200)
        .json({ message: "OTP verified successfully. Proceed to next step." });
    } catch (error: any) {
      logger.error(
        `Verify OTP failure for ${email} (${type}): ${error.message}`
      );

      if (error.message.includes("Invalid verification code provided.")) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({
        error: "An unexpected internal error occurred during verification.",
      });
    }
  }
}

export default OtpController;
