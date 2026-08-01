import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

/** Liste des clients de l'entreprise courante. */
clientsRouter.get('/', async (req, res) => {
  const clients = await prisma.client.findMany({
    where: { companyId: req.auth!.companyId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(clients);
});

/** Création d'un client. */
clientsRouter.post('/', async (req, res) => {
  const client = await prisma.client.create({
    data: { ...req.body, companyId: req.auth!.companyId },
  });
  res.status(201).json(client);
});

/** Mise à jour d'un client (vérifie l'appartenance). */
clientsRouter.put('/:id', async (req, res) => {
  const found = await prisma.client.findFirst({
    where: { id: req.params.id, companyId: req.auth!.companyId },
  });
  if (!found) {
    res.status(404).json({ error: 'Client introuvable' });
    return;
  }
  const updated = await prisma.client.update({ where: { id: found.id }, data: req.body });
  res.json(updated);
});

clientsRouter.delete('/:id', async (req, res) => {
  await prisma.client.deleteMany({
    where: { id: req.params.id, companyId: req.auth!.companyId },
  });
  res.status(204).end();
});
