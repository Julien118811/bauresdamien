import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { prestationsRouter } from './routes/prestations.js';
import { devisRouter } from './routes/devis.js';
import { photosRouter } from './routes/photos.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '12mb' })); // marge pour les photos base64

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/clients', clientsRouter);
app.use('/prestations', prestationsRouter);
app.use('/devis', devisRouter);
app.use('/photos', photosRouter); // dont POST /photos/analyze (Claude Vision)

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`RFD Devis API en écoute sur http://localhost:${port}`);
});
