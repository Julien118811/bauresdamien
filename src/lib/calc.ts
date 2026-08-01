/**
 * Moteur de calcul RFD.
 *
 * Reproduit la logique du modèle de devis réel :
 *  - total de vente / total de coût / marge nette par ligne ;
 *  - totaux HT, TVA (multi-taux), TTC ;
 *  - simulateur de rentabilité : charges URSSAF, épargne sécurité,
 *    fonds de roulement, « restant dans la poche » (net net).
 *
 * Tous les montants sont en euros. Les arrondis d'affichage sont gérés
 * à la présentation ; ici on garde la précision maximale.
 */

import type { CompanySettings, Devis, DevisLine, SiteParams } from '../types';

export interface LineTotals {
  /** Prix de vente HT après remise. */
  sellHT: number;
  /** Coût de revient HT. */
  costHT: number;
  /** Marge nette HT (vente - coût). */
  marginHT: number;
  /** Montant de TVA sur la vente. */
  vat: number;
}

/** Totaux d'une ligne de devis. */
export function lineTotals(line: DevisLine): LineTotals {
  const gross = line.quantity * line.unitPrice;
  const discount = gross * (line.discountPct / 100);
  const sellHT = gross - discount;
  const costHT = line.quantity * line.unitCost;
  const marginHT = sellHT - costHT;
  const vat = sellHT * (line.vatRate / 100);
  return { sellHT, costHT, marginHT, vat };
}

export interface DevisTotals {
  totalHT: number;
  totalCostHT: number;
  totalMarginHT: number;
  /** TVA agrégée par taux. */
  vatByRate: { rate: number; base: number; amount: number }[];
  totalVat: number;
  totalTTC: number;
  marginPct: number;
}

/** Totaux consolidés d'un devis (TVA éventuellement désactivée). */
export function devisTotals(devis: Devis, settings: CompanySettings): DevisTotals {
  let totalHT = 0;
  let totalCostHT = 0;
  const vatMap = new Map<number, { base: number; amount: number }>();

  for (const line of devis.lines) {
    const t = lineTotals(line);
    totalHT += t.sellHT;
    totalCostHT += t.costHT;

    const rate = settings.vatEnabled ? line.vatRate : 0;
    const entry = vatMap.get(rate) ?? { base: 0, amount: 0 };
    entry.base += t.sellHT;
    entry.amount += settings.vatEnabled ? t.vat : 0;
    vatMap.set(rate, entry);
  }

  const vatByRate = [...vatMap.entries()]
    .map(([rate, v]) => ({ rate, base: v.base, amount: v.amount }))
    .sort((a, b) => a.rate - b.rate);

  const totalVat = vatByRate.reduce((s, v) => s + v.amount, 0);
  const totalMarginHT = totalHT - totalCostHT;

  return {
    totalHT,
    totalCostHT,
    totalMarginHT,
    vatByRate,
    totalVat,
    totalTTC: totalHT + totalVat,
    marginPct: totalHT > 0 ? (totalMarginHT / totalHT) * 100 : 0,
  };
}

export interface Profitability {
  invoiceHT: number;
  variableCosts: number;
  grossMargin: number;
  urssafAmount: number;
  netOperatingProfit: number;
  savings: number;
  workingCapital: number;
  /** « Restant dans la poche » (net net). */
  inPocket: number;
  realMarginPct: number;
}

/**
 * Simulateur de rentabilité (repris du modèle RFD).
 * charges URSSAF sur le CA, puis épargne et fonds de roulement sur le
 * bénéfice net d'exploitation.
 */
export function profitability(devis: Devis, settings: CompanySettings): Profitability {
  const totals = devisTotals(devis, settings);
  const invoiceHT = totals.totalHT;
  const variableCosts = totals.totalCostHT;
  const grossMargin = invoiceHT - variableCosts;
  const urssafAmount = invoiceHT * (settings.urssafRate / 100);
  const netOperatingProfit = grossMargin - urssafAmount;
  const savings = netOperatingProfit * (settings.savingsRate / 100);
  const workingCapital = netOperatingProfit * (settings.workingCapitalRate / 100);
  const inPocket = netOperatingProfit - savings - workingCapital;
  return {
    invoiceHT,
    variableCosts,
    grossMargin,
    urssafAmount,
    netOperatingProfit,
    savings,
    workingCapital,
    inPocket,
    realMarginPct: invoiceHT > 0 ? (grossMargin / invoiceHT) * 100 : 0,
  };
}

/** Volume (m³) dérivé de la surface et de la hauteur sous plafond. */
export function computeVolume(site: Pick<SiteParams, 'floorArea' | 'ceilingHeight'>): number {
  return round2(site.floorArea * site.ceilingHeight);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
