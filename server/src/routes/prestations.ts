import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const prestationsRouter = Router();
prestationsRouter.use(requireAuth);

/** Bibliothèque de prestations de l'entreprise courante. */
prestationsRouter.get('/', async (req, res) => {
  const prestations = await prisma.prestation.findMany({
    where: { companyId: req.auth!.companyId },
    orderBy: { label: 'asc' },
  });
  res.json(prestations);
});

prestationsRouter.post('/', async (req, res) => {
  const prestation = await prisma.prestation.create({
    data: { ...req.body, companyId: req.auth!.companyId },
  });
  res.status(201).json(prestation);
});

prestationsRouter.put('/:id', async (req, res) => {
  const found = await prisma.prestation.findFirst({
    where: { id: req.params.id, companyId: req.auth!.companyId },
  });
  if (!found) {
    res.status(404).json({ error: 'Prestation introuvable' });
    return;
  }
  const updated = await prisma.prestation.update({ where: { id: found.id }, data: req.body });
  res.json(updated);
});

prestationsRouter.delete('/:id', async (req, res) => {
  await prisma.prestation.deleteMany({
    where: { id: req.params.id, companyId: req.auth!.companyId },
  });
  res.status(204).end();
});
