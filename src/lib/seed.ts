/**
 * Données par défaut.
 *
 * La bibliothèque de prestations et les paramètres entreprise sont pré-remplis
 * avec le catalogue et la tarification réels de RFD (extraits du modèle de devis
 * fourni). Tout est modifiable dans l'application.
 */

import type { CompanySettings, Prestation } from '../types';
import { uid } from './format';

export function defaultSettings(): CompanySettings {
  return {
    name: 'RFD',
    legalForm: 'Micro-entreprise',
    siret: '',
    addressLine1: '',
    postalCode: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    logoDataUrl: '',
    iban: '',
    bic: '',
    vatEnabled: true,
    defaultVatRate: 20,
    legalMention:
      'TVA applicable au taux en vigueur. En cas de franchise en base de TVA, ' +
      'la mention « TVA non applicable, art. 293 B du CGI » remplace la TVA.',
    cgv:
      "1. Le présent devis est valable 30 jours à compter de sa date d'émission.\n" +
      "2. Toute intervention débute après acceptation et signature du devis.\n" +
      '3. Un acompte de 30 % peut être demandé à la commande.\n' +
      '4. Les interventions en risque biologique sont réalisées conformément aux ' +
      'protocoles de sécurité et à la réglementation sur les DASRI.\n' +
      "5. L'élimination des déchets est assurée via des filières agréées, " +
      'bordereau de suivi remis sur demande.\n' +
      '6. Règlement à réception de facture, sauf conditions particulières.\n' +
      '7. Pénalités de retard : taux légal en vigueur ; indemnité forfaitaire de ' +
      'recouvrement de 40 €.',
    quotePrefix: 'DEV-2026-',
    quoteCounter: 1,
    defaultValidityDays: 30,
    urssafRate: 11,
    savingsRate: 10,
    workingCapitalRate: 10,
    accentColor: '#ff6a2b',
  };
}

/** Catalogue de prestations RFD (prix de vente / coût de revient réels). */
export function defaultPrestations(): Prestation[] {
  const p = (
    label: string,
    category: Prestation['category'],
    unit: string,
    unitPrice: number,
    unitCost: number,
    opts: Partial<Prestation> = {},
  ): Prestation => ({
    id: uid(),
    label,
    description: opts.description ?? '',
    category,
    unit,
    unitPrice,
    unitCost,
    vatRate: opts.vatRate ?? 20,
    averageTimeH: opts.averageTimeH ?? 0,
    equipment: opts.equipment ?? '',
    products: opts.products ?? '',
  });

  return [
    p('Forfait Risque Bio / Post-Mortem', 'Post-mortem', 'forfait', 1000, 50, {
      description:
        'Prise en charge globale d’une scène post-mortem : sécurisation, ' +
        'protocole biologique, gestion des fluides et des odeurs.',
      averageTimeH: 4,
      equipment: 'Combinaison type 5/6, masque FFP3, gants nitrile, sacs DASRI',
      products: 'Détergent-désinfectant virucide, absorbant, neutralisant d’odeur',
    }),
    p('Bio-nettoyage manuel — zone rouge (m²)', 'Décontamination', 'm²', 15, 2, {
      description: 'Nettoyage et désinfection manuelle des surfaces contaminées.',
      averageTimeH: 0.15,
      equipment: 'Microfibres, pulvérisateur, raclette',
      products: 'Détergent-désinfectant virucide EN 14476',
    }),
    p('Bio-nettoyage manuel (m³)', 'Décontamination', 'm³', 8, 6, {
      description: 'Traitement manuel au volume pour les zones à fort encombrement.',
    }),
    p('Traitement Air — Ozone (m³)', 'Odeurs', 'm³', 3, 0, {
      description: 'Traitement de l’air à l’ozone pour la destruction des odeurs.',
      equipment: 'Générateur d’ozone, détecteur O₃',
    }),
    p('Traitement ULV — Nuisibles (m³)', 'Désinfection', 'm³', 3, 0.1, {
      description: 'Nébulisation à froid (ULV) anti-nuisibles.',
      equipment: 'Nébulisateur ULV',
      products: 'Insecticide agréé',
    }),
    p('Traitement ULV — Bactérien (m³)', 'Désinfection', 'm³', 3, 0.1, {
      description: 'Nébulisation à froid (ULV) désinfection bactérienne.',
      equipment: 'Nébulisateur ULV',
      products: 'Désinfectant bactéricide EN 13697',
    }),
    p('Frais de déplacement (km)', 'Déplacement', 'km', 1, 0.32, {
      description: 'Frais kilométriques aller-retour.',
      vatRate: 20,
    }),
    p('Main-d’œuvre / Temps d’attente (h)', 'Main-d’œuvre', 'h', 200, 0, {
      description: 'Main-d’œuvre supplémentaire ou temps d’attente sur site.',
      averageTimeH: 1,
    }),
    p('Élimination déchets DIB — Forfait 20 kg', 'Déchets', 'forfait', 6, 250, {
      description: 'Déchets industriels banals, forfait d’élimination.',
    }),
    p('Élimination DASRI — Fût rigide 60 L', 'Déchets', 'unité', 140, 140, {
      description:
        'Matières organiques / perforants — fût rigide homologué, filière agréée.',
    }),
    p('Élimination DASRI — Sac souple', 'Déchets', 'unité', 45, 45, {
      description: 'EPI et consommables de bio-nettoyage — filière DASRI agréée.',
    }),
    p('Décontamination biologique complète (m²)', 'Décontamination', 'm²', 25, 4, {
      description: 'Protocole complet de décontamination biologique des surfaces.',
      averageTimeH: 0.2,
    }),
    p('Neutralisation des odeurs — Forfait', 'Odeurs', 'forfait', 250, 30, {
      description: 'Traitement curatif des odeurs persistantes.',
    }),
    p('Nettoyage après sinistre / incendie (m²)', 'Sinistre', 'm²', 18, 5, {
      description: 'Nettoyage des suies et résidus après incendie.',
    }),
    p('Assèchement / nettoyage après inondation (m²)', 'Sinistre', 'm²', 16, 4, {
      description: 'Nettoyage et traitement après dégât des eaux.',
    }),
    p('Nettoyage industriel (h)', 'Industriel', 'h', 60, 8, {
      description: 'Nettoyage industriel technique à l’heure.',
      averageTimeH: 1,
    }),
  ];
}
