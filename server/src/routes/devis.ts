import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const devisRouter = Router();
devisRouter.use(requireAuth);

const include = { lines: true, photos: true, history: true, client: true };

/** Liste des devis de l'entreprise (métadonnées + lignes). */
devisRouter.get('/', async (req, res) => {
  const devis = await prisma.devis.findMany({
    where: { companyId: req.auth!.companyId },
    include,
    orderBy: { createdAt: 'desc' },
  });
  res.json(devis);
});

devisRouter.get('/:id', async (req, res) => {
  const devis = await prisma.devis.findFirst({
    where: { id: req.params.id, companyId: req.auth!.companyId },
    include,
  });
  if (!devis) {
    res.status(404).json({ error: 'Devis introuvable' });
    return;
  }
  res.json(devis);
});

/**
 * Création d'un devis avec numérotation automatique (compteur entreprise).
 * Body : { clientId, title, validUntil, site, lines[] }.
 */
devisRouter.post('/', async (req, res) => {
  const companyId = req.auth!.companyId;
  const { clientId, title, validUntil, floorArea, ceilingHeight, roundTripKm, volume, lines } =
    req.body;

  const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) {
    res.status(400).json({ error: 'Client invalide' });
    return;
  }

  // Numérotation atomique via le compteur de l'entreprise.
  const devis = await prisma.$transaction(async (tx) => {
    const company = await tx.company.update({
      where: { id: companyId },
      data: { quoteCounter: { increment: 1 } },
    });
    const number = `${company.quotePrefix}${String(company.quoteCounter).padStart(3, '0')}`;
    return tx.devis.create({
      data: {
        number,
        companyId,
        clientId,
        title: title ?? 'Intervention',
        status: 'brouillon',
        validUntil: validUntil ? new Date(validUntil) : new Date(),
        floorArea: floorArea ?? 0,
        ceilingHeight: ceilingHeight ?? 2.5,
        roundTripKm: roundTripKm ?? 0,
        volume: volume ?? 0,
        lines: {
          create: (lines ?? []).map((l: Record<string, unknown>, i: number) => ({
            ...l,
            position: i,
          })),
        },
        history: { create: [{ label: 'Brouillon créé' }] },
      },
      include,
    });
  });

  res.status(201).json(devis);
});

/**
 * Mise à jour d'un devis. Les lignes fournies remplacent l'ensemble existant
 * (approche simple ; un diff fin est possible ultérieurement).
 */
devisRouter.put('/:id', async (req, res) => {
  const companyId = req.auth!.companyId;
  const found = await prisma.devis.findFirst({ where: { id: req.params.id, companyId } });
  if (!found) {
    res.status(404).json({ error: 'Devis introuvable' });
    return;
  }
  if (found.locked) {
    res.status(409).json({ error: 'Devis verrouillé (signé)' });
    return;
  }

  const { lines, client: _client, history: _history, photos: _photos, ...fields } = req.body;
  void _client;
  void _history;
  void _photos;

  const updated = await prisma.$transaction(async (tx) => {
    if (Array.isArray(lines)) {
      await tx.devisLine.deleteMany({ where: { devisId: found.id } });
      await tx.devisLine.createMany({
        data: lines.map((l: Record<string, unknown>, i: number) => ({
          ...l,
          id: undefined,
          devisId: found.id,
          position: i,
        })),
      });
    }
    return tx.devis.update({
      where: { id: found.id },
      data: {
        ...fields,
        validUntil: fields.validUntil ? new Date(fields.validUntil) : undefined,
      },
      include,
    });
  });

  res.json(updated);
});

/** Changement de statut (ajoute une entrée d'historique). */
devisRouter.post('/:id/status', async (req, res) => {
  const companyId = req.auth!.companyId;
  const found = await prisma.devis.findFirst({ where: { id: req.params.id, companyId } });
  if (!found) {
    res.status(404).json({ error: 'Devis introuvable' });
    return;
  }
  const status = String(req.body.status);
  const updated = await prisma.devis.update({
    where: { id: found.id },
    data: {
      status,
      history: { create: [{ label: `Statut : ${status}` }] },
    },
    include,
  });
  res.json(updated);
});

devisRouter.delete('/:id', async (req, res) => {
  await prisma.devis.deleteMany({ where: { id: req.params.id, companyId: req.auth!.companyId } });
  res.status(204).end();
});
