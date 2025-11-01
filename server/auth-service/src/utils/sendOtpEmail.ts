import { transporter } from "../config/nodemailer.ts";

export const OtpEmailType = {
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  TWO_FACTOR_AUTH: 'TWO_FACTOR_AUTH',
  ACCOUNT_VERIFICATION: 'ACCOUNT_VERIFICATION'
} as const; 

export type OtpEmailType = (typeof OtpEmailType)[keyof typeof OtpEmailType];


const getEmailTemplate = (type: OtpEmailType, otp: string) => {
  const templates = {
    [OtpEmailType.PASSWORD_RESET]: {
      subject: "Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You have requested to reset your password. Use the code below to proceed:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    },
    [OtpEmailType.EMAIL_VERIFICATION]: {
      subject: "Verify Your Email Address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Please verify your email address using the code below:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #28a745; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code will expire in 15 minutes.</p>
        </div>
      `
    },
    [OtpEmailType.TWO_FACTOR_AUTH]: {
      subject: "Two-Factor Authentication Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Two-Factor Authentication</h2>
          <p>Your two-factor authentication code is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #ffc107; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code will expire in 5 minutes.</p>
        </div>
      `
    },
    [OtpEmailType.ACCOUNT_VERIFICATION]: {
      subject: "Account Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Account Verification</h2>
          <p>Welcome to Skillzaar! Please verify your account using the code below:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #17a2b8; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code will expire in 30 minutes.</p>
        </div>
      `
    }
  };

  return templates[type];
};

export const sendOtpEmail = async (to: string, otp: string, type: OtpEmailType = OtpEmailType.PASSWORD_RESET) => {
  const template = getEmailTemplate(type, otp);

  await transporter.sendMail({
    from: `"Vync" <${process.env.EMAIL_FROM}>`,
    to,
    subject: template.subject,
    html: template.html,
  });
};