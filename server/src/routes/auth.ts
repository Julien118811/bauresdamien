import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { signToken } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
  displayName: z.string().optional(),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, companyName, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email déjà utilisé' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const company = await prisma.company.create({ data: { name: companyName } });
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName: displayName ?? '', companyId: company.id },
  });

  const token = signToken({ userId: user.id, companyId: company.id });
  res.status(201).json({ token, user: { id: user.id, email, companyId: company.id } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Requête invalide' });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Identifiants incorrects' });
    return;
  }
  const token = signToken({ userId: user.id, companyId: user.companyId });
  res.json({ token, user: { id: user.id, email, companyId: user.companyId } });
});
