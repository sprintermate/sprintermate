import { Resend } from 'resend';
import { childLogger } from '../utils/logger';

const log = childLogger('email');

const resend = new Resend(process.env.RESEND_API_KEY ?? '');
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'Sprintermate AI <noreply@sprintermate.com>';

export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Sprintermate AI — Password Reset Code',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
        
        <!-- Header -->
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <div style="display:inline-block;width:48px;height:48px;background:#4f46e5;border-radius:12px;line-height:48px;text-align:center;">
            <span style="color:#fff;font-weight:bold;font-size:16px;">SP</span>
          </div>
          <h1 style="color:#f8fafc;font-size:22px;margin:16px 0 8px;">Password Reset</h1>
          <p style="color:#94a3b8;font-size:14px;margin:0;">Use the code below to reset your password</p>
        </td></tr>
        
        <!-- Code -->
        <tr><td style="padding:0 32px 24px;text-align:center;">
          <div style="background:#0f172a;border:2px solid #6366f1;border-radius:12px;padding:20px;letter-spacing:8px;">
            <span style="color:#a5b4fc;font-size:36px;font-weight:bold;font-family:monospace;">${code}</span>
          </div>
        </td></tr>
        
        <!-- Warning -->
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <p style="color:#f59e0b;font-size:13px;margin:0 0 8px;">⏱ This code expires in <strong>3 minutes</strong></p>
          <p style="color:#64748b;font-size:12px;margin:0;">If you didn't request a password reset, you can safely ignore this email.</p>
        </td></tr>
        
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#0f172a;border-top:1px solid #334155;text-align:center;">
          <p style="color:#475569;font-size:11px;margin:0;">Sprintermate AI — AI-Powered Agile</p>
        </td></tr>
        
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (error) {
      log.error('failed to send password reset email', { error });
      return false;
    }

    log.info('password reset email sent', { email });
    return true;
  } catch (err) {
    log.error('email service error', { err });
    return false;
  }
}
