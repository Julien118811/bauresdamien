/**
 * Analyse IA des photos de chantier.
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │  Deux modes :                                                       │
 * │  1. HEURISTIQUE (par défaut, hors-ligne) — analyse locale de        │
 * │     l'image (dimensions, dominante colorimétrique) croisée avec les │
 * │     paramètres du chantier pour proposer un devis cohérent.         │
 * │  2. CLAUDE VISION (en ligne) — si `VITE_ANTHROPIC_PROXY` est défini,│
 * │     l'image est envoyée à un endpoint qui relaie vers l'API Claude. │
 * │     Le JSON de sortie a exactement la même forme (`AiAnalysis`),    │
 * │     ce qui rend le remplacement transparent.                        │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * L'utilisateur peut toujours modifier chaque valeur proposée : l'IA
 * n'est qu'une aide à la saisie.
 */

import type { AiAnalysis, DevisLine, Prestation, SiteParams } from '../types';
import { round2 } from './calc';

interface AnalyzeInput {
  imageBlob: Blob;
  site: SiteParams;
  prestations: Prestation[];
  category?: string;
}

/** Point d'entrée : choisit le mode disponible. */
export async function analyzePhoto(input: AnalyzeInput): Promise<AiAnalysis> {
  const proxy = import.meta.env.VITE_ANTHROPIC_PROXY as string | undefined;
  if (proxy) {
    try {
      return await analyzeWithClaude(proxy, input);
    } catch (err) {
      console.warn('Analyse Claude indisponible, repli heuristique.', err);
    }
  }
  return heuristicAnalysis(input);
}

/* ------------------------------------------------------------------ */
/* Mode Claude Vision (branchement futur)                              */
/* ------------------------------------------------------------------ */

async function analyzeWithClaude(proxy: string, input: AnalyzeInput): Promise<AiAnalysis> {
  const b64 = await blobToBase64(input.imageBlob);
  const res = await fetch(proxy, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: b64,
      mediaType: input.imageBlob.type || 'image/jpeg',
      site: input.site,
      // Le prompt côté serveur demande à Claude de renvoyer un objet AiAnalysis.
    }),
  });
  if (!res.ok) throw new Error(`Proxy IA: ${res.status}`);
  return (await res.json()) as AiAnalysis;
}

/* ------------------------------------------------------------------ */
/* Mode heuristique (hors-ligne, par défaut)                           */
/* ------------------------------------------------------------------ */

async function heuristicAnalysis(input: AnalyzeInput): Promise<AiAnalysis> {
  const { site, prestations } = input;
  const meta = await analyzeImage(input.imageBlob);

  // Estimation de surface/volume : priorité aux paramètres du chantier saisis,
  // sinon estimation par défaut modulée par la « charge visuelle » de l'image.
  const area = site.floorArea > 0 ? site.floorArea : round2(15 + meta.busyness * 60);
  const volume =
    site.volume > 0
      ? site.volume
      : round2(area * (site.ceilingHeight > 0 ? site.ceilingHeight : 2.5));

  // Niveau de contamination déduit de la dominante sombre/rouge de l'image.
  const score = meta.darkness * 0.6 + meta.redness * 0.4;
  const level =
    score > 0.6 ? 'Critique' : score > 0.4 ? 'Élevé' : score > 0.22 ? 'Modéré' : 'Faible';

  const time = round2(area * 0.15 + volume * 0.02 + 2);

  const find = (needle: string) =>
    prestations.find((p) => p.label.toLowerCase().includes(needle.toLowerCase()));

  const suggestedLines: Omit<DevisLine, 'id'>[] = [];
  const push = (p: Prestation | undefined, quantity: number) => {
    if (!p || quantity <= 0) return;
    suggestedLines.push({
      prestationId: p.id,
      description: p.label,
      quantity: round2(quantity),
      unit: p.unit,
      unitPrice: p.unitPrice,
      unitCost: p.unitCost,
      vatRate: p.vatRate,
      discountPct: 0,
    });
  };

  // Forfait de base selon la gravité.
  if (level === 'Critique' || level === 'Élevé') push(find('Forfait Risque Bio'), 1);
  push(find('zone rouge'), area);
  push(find('Traitement Air'), volume);
  if (level !== 'Faible') push(find('ULV — Bactérien'), volume);
  if (site.roundTripKm > 0) push(find('déplacement'), site.roundTripKm);
  if (level === 'Critique') push(find('DASRI — Fût rigide'), 1);

  const suggestedPriceHT = round2(
    suggestedLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
  );

  return {
    damageDescription: describeDamage(level, meta),
    estimatedAreaM2: area,
    estimatedVolumeM3: volume,
    contaminationLevel: level,
    recommendedWork: recommendedWork(level),
    recommendedEquipment: [
      'Nébulisateur ULV',
      'Générateur d’ozone',
      'Pulvérisateur basse pression',
      'Aspirateur à filtration HEPA',
    ],
    estimatedTimeH: time,
    ppe: [
      'Combinaison type 5/6',
      'Masque FFP3 ou masque à cartouche',
      'Gants nitrile double épaisseur',
      'Lunettes de protection',
      'Surchaussures',
    ],
    products: [
      'Détergent-désinfectant virucide (EN 14476)',
      'Bactéricide (EN 13697)',
      'Neutralisant d’odeurs enzymatique',
      'Absorbant pour fluides biologiques',
    ],
    suggestedPriceHT,
    suggestedLines,
  };
}

function describeDamage(level: string, meta: ImageMeta): string {
  const density = meta.busyness > 0.5 ? 'importante' : meta.busyness > 0.3 ? 'modérée' : 'localisée';
  return (
    `Contamination ${level.toLowerCase()} détectée sur une zone d’ampleur ${density}. ` +
    'Présence probable de résidus biologiques et de souillures sur les surfaces. ' +
    'Traitement des surfaces, désinfection du volume et neutralisation des odeurs recommandés. ' +
    '(Estimation à valider sur site.)'
  );
}

function recommendedWork(level: string): string[] {
  const base = [
    'Sécurisation et balisage de la zone',
    'Bio-nettoyage manuel des surfaces contaminées',
    'Désinfection du volume par nébulisation ULV',
    'Neutralisation des odeurs',
    'Conditionnement et élimination des déchets (filière DASRI/DIB)',
  ];
  if (level === 'Critique' || level === 'Élevé') {
    base.splice(1, 0, 'Retrait des matériaux imprégnés non récupérables');
    base.push('Contrôle final et remise en état');
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Analyse d'image bas niveau (canvas)                                 */
/* ------------------------------------------------------------------ */

interface ImageMeta {
  width: number;
  height: number;
  darkness: number; // 0..1
  redness: number; // 0..1
  busyness: number; // 0..1 (variance / « désordre » visuel)
}

async function analyzeImage(blob: Blob): Promise<ImageMeta> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const w = 64;
    const h = Math.max(1, Math.round((img.height / img.width) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: img.width, height: img.height, darkness: 0.3, redness: 0.2, busyness: 0.3 };
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    let sumLum = 0;
    let sumRed = 0;
    let sumLum2 = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      sumLum += lum;
      sumLum2 += lum * lum;
      // « rougeur » : dominante rouge par rapport au vert/bleu.
      sumRed += Math.max(0, r - (g + b) / 2) / 255;
    }
    const meanLum = sumLum / n;
    const variance = Math.max(0, sumLum2 / n - meanLum * meanLum);
    return {
      width: img.width,
      height: img.height,
      darkness: clamp01(1 - meanLum),
      redness: clamp01((sumRed / n) * 2.2),
      busyness: clamp01(Math.sqrt(variance) * 2.4),
    };
  } catch {
    return { width: 0, height: 0, darkness: 0.3, redness: 0.2, busyness: 0.3 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
