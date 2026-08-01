/**
 * Analyse d'une photo de chantier par Claude Vision.
 *
 * L'image (base64) est envoyée au modèle avec un schéma de sortie structuré
 * (structured outputs) qui garantit exactement la forme `AiAnalysis` attendue
 * par le frontend — aucune post-validation n'est nécessaire côté client.
 *
 * La clé API reste côté serveur (jamais exposée au navigateur).
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // lit ANTHROPIC_API_KEY dans l'environnement

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

export interface SiteParams {
  floorArea: number;
  ceilingHeight: number;
  roundTripKm: number;
  volume: number;
}

/** Schéma JSON de la sortie (miroir de `AiAnalysis` côté frontend). */
const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    damageDescription: { type: 'string' },
    estimatedAreaM2: { type: 'number' },
    estimatedVolumeM3: { type: 'number' },
    contaminationLevel: { type: 'string', enum: ['Faible', 'Modéré', 'Élevé', 'Critique'] },
    recommendedWork: { type: 'array', items: { type: 'string' } },
    recommendedEquipment: { type: 'array', items: { type: 'string' } },
    estimatedTimeH: { type: 'number' },
    ppe: { type: 'array', items: { type: 'string' } },
    products: { type: 'array', items: { type: 'string' } },
    suggestedPriceHT: { type: 'number' },
    suggestedLines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          unitPrice: { type: 'number' },
          unitCost: { type: 'number' },
          vatRate: { type: 'number' },
          discountPct: { type: 'number' },
        },
        required: ['description', 'quantity', 'unit', 'unitPrice', 'unitCost', 'vatRate', 'discountPct'],
      },
    },
  },
  required: [
    'damageDescription', 'estimatedAreaM2', 'estimatedVolumeM3', 'contaminationLevel',
    'recommendedWork', 'recommendedEquipment', 'estimatedTimeH', 'ppe', 'products',
    'suggestedPriceHT', 'suggestedLines',
  ],
} as const;

function buildPrompt(site: SiteParams): string {
  return [
    "Tu es un expert en décontamination biologique, nettoyage post-mortem et nettoyage extrême (société RFD).",
    "Analyse cette photo d'un chantier et estime les travaux nécessaires.",
    `Paramètres connus du chantier : surface au sol ${site.floorArea || '?'} m², ` +
      `hauteur sous plafond ${site.ceilingHeight || '?'} m, volume ${site.volume || '?'} m³, ` +
      `trajet aller-retour ${site.roundTripKm || '?'} km.`,
    'Renseigne :',
    "- une description des dégâts observés (damageDescription) ;",
    '- surface et volume estimés (estimatedAreaM2, estimatedVolumeM3) — utilise les paramètres connus si fournis ;',
    "- le niveau de contamination (contaminationLevel) ;",
    '- les travaux recommandés, le matériel, les EPI et les produits ;',
    "- le temps estimé en heures (estimatedTimeH) ;",
    '- un prix conseillé HT (suggestedPriceHT) ;',
    '- des lignes de devis pré-remplies (suggestedLines) avec quantités et prix cohérents ' +
      "(bio-nettoyage m², traitement ULV/ozone m³, forfait risque bio, déplacement km, élimination DASRI…).",
    'Sois réaliste et prudent : ces estimations seront validées sur site.',
  ].join('\n');
}

export async function analyzePhoto(
  imageBase64: string,
  mediaType: string,
  site: SiteParams,
): Promise<unknown> {
  // `output_config` (structured outputs + effort) n'est pas encore typé dans
  // cette version du SDK — on passe le corps tel quel (le SDK relaie les champs
  // inconnus). La réponse reste typée `Anthropic.Message`.
  const params = {
    model: MODEL,
    max_tokens: 8000,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: ANALYSIS_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/jpeg',
              data: imageBase64,
            },
          },
          { type: 'text', text: buildPrompt(site) },
        ],
      },
    ],
  };
  const response = (await client.messages.create(
    params as unknown as Anthropic.MessageCreateParamsNonStreaming,
  )) as Anthropic.Message;

  // Les classifieurs de sécurité peuvent refuser (HTTP 200, stop_reason "refusal").
  if (response.stop_reason === 'refusal') {
    throw new Error('Analyse refusée par les filtres de sécurité.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Réponse du modèle vide.');
  }
  return JSON.parse(textBlock.text);
}
