/**
 * État applicatif global (Zustand + persistance locale).
 *
 * Tout est sauvegardé automatiquement dans `localStorage` → l'application
 * fonctionne hors-ligne et conserve les données entre les sessions.
 * Les blobs (photos/documents) vivent dans IndexedDB (voir lib/db.ts).
 *
 * Évolution cloud : la couche `persist` peut être remplacée par un storage
 * synchronisant vers l'API (JWT), sans changer les composants.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Client,
  CompanySettings,
  Devis,
  DevisLine,
  DevisStatus,
  Prestation,
} from '../types';
import { defaultPrestations, defaultSettings } from '../lib/seed';
import { computeVolume } from '../lib/calc';
import { uid } from '../lib/format';

export type Theme = 'dark' | 'light';

interface AppState {
  theme: Theme;
  settings: CompanySettings;
  clients: Client[];
  prestations: Prestation[];
  devis: Devis[];

  toggleTheme: () => void;
  setSettings: (patch: Partial<CompanySettings>) => void;

  // Clients
  addClient: (c: Omit<Client, 'id' | 'createdAt' | 'documents'>) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Prestations
  addPrestation: (p: Omit<Prestation, 'id'>) => Prestation;
  updatePrestation: (id: string, patch: Partial<Prestation>) => void;
  deletePrestation: (id: string) => void;

  // Devis
  createDevis: (clientId: string) => Devis;
  updateDevis: (id: string, patch: Partial<Devis>) => void;
  deleteDevis: (id: string) => void;
  setDevisStatus: (id: string, status: DevisStatus) => void;
  duplicateDevis: (id: string) => Devis | undefined;
}

function newLine(partial: Partial<DevisLine> = {}): DevisLine {
  return {
    id: uid(),
    description: '',
    quantity: 1,
    unit: 'forfait',
    unitPrice: 0,
    unitCost: 0,
    vatRate: 20,
    discountPct: 0,
    ...partial,
  };
}

const STATUS_LABELS: Record<DevisStatus, string> = {
  brouillon: 'Brouillon créé',
  envoye: 'Devis envoyé au client',
  accepte: 'Devis accepté',
  refuse: 'Devis refusé',
  facture: 'Devis facturé',
  paye: 'Facture payée',
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      settings: defaultSettings(),
      clients: [],
      prestations: defaultPrestations(),
      devis: [],

      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addClient: (c) => {
        const client: Client = {
          ...c,
          id: uid(),
          createdAt: new Date().toISOString(),
          documents: [],
        };
        set((s) => ({ clients: [client, ...s.clients] }));
        return client;
      },
      updateClient: (id, patch) =>
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          devis: s.devis.filter((d) => d.clientId !== id),
        })),

      addPrestation: (p) => {
        const prestation: Prestation = { ...p, id: uid() };
        set((s) => ({ prestations: [prestation, ...s.prestations] }));
        return prestation;
      },
      updatePrestation: (id, patch) =>
        set((s) => ({
          prestations: s.prestations.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deletePrestation: (id) =>
        set((s) => ({ prestations: s.prestations.filter((p) => p.id !== id) })),

      createDevis: (clientId) => {
        const { settings } = get();
        const now = new Date();
        const valid = new Date(now);
        valid.setDate(valid.getDate() + settings.defaultValidityDays);
        const number = `${settings.quotePrefix}${String(settings.quoteCounter).padStart(3, '0')}`;
        const devis: Devis = {
          id: uid(),
          number,
          clientId,
          status: 'brouillon',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          validUntil: valid.toISOString(),
          title: 'Intervention de décontamination',
          site: { floorArea: 0, ceilingHeight: 2.5, roundTripKm: 0, volume: 0 },
          lines: [newLine({ description: '', unit: 'forfait' })],
          photos: [],
          notes: '',
          history: [{ at: now.toISOString(), label: STATUS_LABELS.brouillon }],
          reminderAt: null,
        };
        set((s) => ({
          devis: [devis, ...s.devis],
          settings: { ...s.settings, quoteCounter: s.settings.quoteCounter + 1 },
        }));
        return devis;
      },

      updateDevis: (id, patch) =>
        set((s) => ({
          devis: s.devis.map((d) => {
            if (d.id !== id) return d;
            const next = { ...d, ...patch, updatedAt: new Date().toISOString() };
            // Maintient le volume dérivé à jour si les paramètres du site changent.
            if (patch.site) {
              next.site = { ...next.site, volume: computeVolume(next.site) };
            }
            return next;
          }),
        })),

      deleteDevis: (id) => set((s) => ({ devis: s.devis.filter((d) => d.id !== id) })),

      setDevisStatus: (id, status) =>
        set((s) => ({
          devis: s.devis.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status,
                  updatedAt: new Date().toISOString(),
                  history: [
                    ...d.history,
                    { at: new Date().toISOString(), label: STATUS_LABELS[status] },
                  ],
                }
              : d,
          ),
        })),

      duplicateDevis: (id) => {
        const src = get().devis.find((d) => d.id === id);
        if (!src) return undefined;
        const { settings } = get();
        const now = new Date();
        const valid = new Date(now);
        valid.setDate(valid.getDate() + settings.defaultValidityDays);
        const copy: Devis = {
          ...src,
          id: uid(),
          number: `${settings.quotePrefix}${String(settings.quoteCounter).padStart(3, '0')}`,
          status: 'brouillon',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          validUntil: valid.toISOString(),
          signature: undefined,
          lines: src.lines.map((l) => ({ ...l, id: uid() })),
          photos: src.photos.map((p) => ({ ...p, id: uid() })),
          history: [{ at: now.toISOString(), label: 'Dupliqué depuis ' + src.number }],
          reminderAt: null,
        };
        set((s) => ({
          devis: [copy, ...s.devis],
          settings: { ...s.settings, quoteCounter: s.settings.quoteCounter + 1 },
        }));
        return copy;
      },
    }),
    {
      name: 'rfd-devis-store',
      version: 1,
    },
  ),
);

export { newLine, STATUS_LABELS };
