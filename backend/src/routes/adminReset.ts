/**
 * TEMPORARY one-time password reset endpoint.
 * REMOVE THIS FILE AND ITS REFERENCE IN app.ts AFTER USE.
 *
 * Usage:
 *   curl -X POST https://<your-domain>/api/admin/reset-password \
 *     -H "Content-Type: application/json" \
 *     -d '{"token":"<ADMIN_RESET_TOKEN>","email":"user@example.com","newPassword":"newpass"}'
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../db/schema';

const router = Router();

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, email, newPassword } = req.body as {
    token?: string;
    email?: string;
    newPassword?: string;
  };

  const adminToken = process.env.ADMIN_RESET_TOKEN;

  if (!adminToken) {
    return res.status(503).json({ error: 'ADMIN_RESET_TOKEN env var not set — endpoint disabled' });
  }

  if (!token || token !== adminToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'email and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await user.update({ password_hash: hash });

  return res.json({ success: true, message: `Password updated for ${email}` });
});

export default router;
