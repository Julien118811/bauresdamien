import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/clients', clientsRouter);
// À compléter : /devis, /prestations, /photos (mêmes patterns que /clients,
// filtrés par companyId, protégés par requireAuth).

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`RFD Devis API en écoute sur http://localhost:${port}`);
});
