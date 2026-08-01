/** Utilitaires de formatage (localisation française). */

const eur = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eur0 = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const formatEUR = (n: number): string => eur.format(isFinite(n) ? n : 0);
export const formatEUR0 = (n: number): string => eur0.format(isFinite(n) ? n : 0);
export const formatNum = (n: number): string => num.format(isFinite(n) ? n : 0);
export const formatPct = (n: number): string => `${num.format(isFinite(n) ? n : 0)} %`;

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Date au format input[type=date] (YYYY-MM-DD). */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Génère un identifiant court unique. */
export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}
