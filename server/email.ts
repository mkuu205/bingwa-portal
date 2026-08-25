import nodemailer from "nodemailer";
import { ENV } from "./_core/env";

function getTransport() {
  if (!ENV.smtpHost || !ENV.smtpUser || !ENV.smtpPassword) return null;
  return nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpSecure,
    auth: { user: ENV.smtpUser, pass: ENV.smtpPassword },
  });
}

export async function sendCustomerVerificationEmail(params: {
  email: string;
  name: string;
  token: string;
}) {
  const transport = getTransport();
  if (!transport || !ENV.emailFrom || !ENV.appBaseUrl) {
    if (ENV.isProduction) throw new Error("Email verification delivery is not configured");
    console.warn("[Email] Verification delivery skipped because SMTP is not configured");
    return { sent: false as const };
  }

  const verificationUrl = new URL("/verify-email", ENV.appBaseUrl);
  verificationUrl.searchParams.set("token", params.token);
  await transport.sendMail({
    from: ENV.emailFrom,
    to: params.email,
    subject: "Verify your Bingwa Portal email",
    text: `Hello ${params.name},\n\nVerify your Bingwa Portal email address here:\n${verificationUrl.toString()}\n\nThis link expires in 30 minutes. If you did not create this account, you can ignore this message.`,
  });
  return { sent: true as const };
}
