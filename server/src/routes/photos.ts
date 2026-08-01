import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { analyzePhoto } from '../lib/anthropic.js';

export const photosRouter = Router();
photosRouter.use(requireAuth);

const analyzeSchema = z.object({
  image: z.string().min(1), // base64 (sans préfixe data:)
  mediaType: z.string().default('image/jpeg'),
  site: z
    .object({
      floorArea: z.number().default(0),
      ceilingHeight: z.number().default(2.5),
      roundTripKm: z.number().default(0),
      volume: z.number().default(0),
    })
    .default({ floorArea: 0, ceilingHeight: 2.5, roundTripKm: 0, volume: 0 }),
});

/**
 * POST /photos/analyze — analyse une photo via Claude Vision.
 * Renvoie un objet `AiAnalysis` (même forme que le mode heuristique frontend),
 * ce qui rend le branchement transparent côté client (VITE_ANTHROPIC_PROXY).
 */
photosRouter.post('/analyze', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Requête invalide' });
    return;
  }
  try {
    const analysis = await analyzePhoto(parsed.data.image, parsed.data.mediaType, parsed.data.site);
    res.json(analysis);
  } catch (err) {
    // Le frontend bascule automatiquement sur le mode heuristique en cas d'échec.
    res.status(502).json({ error: (err as Error).message });
  }
});
