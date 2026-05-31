import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

/**
 * Sends the license token to the buyer's email.
 * Supports Resend, Nodemailer (SMTP), and logs to a local file in development mode.
 * 
 * @param email The recipient email address
 * @param token The raw license token (16-character string)
 * @returns Promise<boolean> True if successfully handled
 */
export async function sendLicenseEmail(email: string, token: string): Promise<boolean> {
  const subject = 'Your License Token';
  const body = `Thank you for your purchase.

Your license token:
${token}

This token can only be activated once.`;

  console.log(`[Email Service] Attempting to send email to: ${email}`);

  // 1. Resend API Integration
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
      const response = await resend.emails.send({
        from: emailFrom,
        to: email,
        subject: subject,
        text: body,
      });

      if (response.error) {
        console.error('[Email Service] Resend error details:', response.error);
      } else {
        console.log('[Email Service] Email sent successfully via Resend. ID:', response.data?.id);
        return true;
      }
    } catch (err) {
      console.error('[Email Service] Resend exception occurred:', err);
    }
  }

  // 2. Nodemailer SMTP Integration
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const emailFrom = process.env.EMAIL_FROM || 'no-reply@example.com';
      const info = await transporter.sendMail({
        from: emailFrom,
        to: email,
        subject: subject,
        text: body,
      });

      console.log('[Email Service] Email sent successfully via SMTP. Message ID:', info.messageId);
      return true;
    } catch (err) {
      console.error('[Email Service] SMTP exception occurred:', err);
    }
  }

  // 3. Fallback: Log to console and local file (Dev / Local Testing Mode)
  console.log('==================================================');
  console.log('[DEV FALLBACK] EMAIL SENT:');
  console.log(`To: ${email}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log('==================================================');

  try {
    const logDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'sent-emails.log');
    const logEntry = `[${new Date().toISOString()}] To: ${email}\nSubject: ${subject}\nBody:\n${body}\n--------------------------------------------------\n\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
    console.log(`[Email Service] Logged email to local debug file: ${logPath}`);
  } catch (logErr) {
    console.error('[Email Service] Failed to write to dev fallback log file:', logErr);
  }

  return true;
}
