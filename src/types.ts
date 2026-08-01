/**
 * Modèle de données RFD Devis.
 *
 * Le modèle métier est directement inspiré du fonctionnement réel de RFD
 * (décontamination biologique / nettoyage extrême, micro-entreprise) :
 *  - chaque ligne de devis porte un PRIX DE VENTE **et** un COÛT DE REVIENT,
 *    ce qui permet de calculer la marge nette ligne par ligne ;
 *  - un simulateur de rentabilité (URSSAF, épargne, fonds de roulement)
 *    calcule le « restant dans la poche ».
 *
 * Toutes les entités sont sérialisables en JSON (persistance locale / cloud).
 * Les blobs photo sont stockés séparément dans IndexedDB (voir lib/db.ts) ;
 * seules les métadonnées (avec un `photoId`) vivent dans le store.
 */

export type ID = string;

/* ------------------------------------------------------------------ */
/* Entreprise & paramétrage                                            */
/* ------------------------------------------------------------------ */

export interface CompanySettings {
  name: string;
  legalForm: string; // ex. "Micro-entreprise"
  siret: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  /** Logo encodé en data-URL (image importée) ou vide pour utiliser le logo par défaut. */
  logoDataUrl: string;
  iban: string;
  bic: string;
  /** Assujetti à la TVA ? Les micro-entreprises sont souvent en franchise. */
  vatEnabled: boolean;
  defaultVatRate: number; // %
  /** Mention légale bas de devis (ex. franchise TVA art. 293 B du CGI). */
  legalMention: string;
  /** Conditions générales de vente (texte multi-ligne). */
  cgv: string;
  /** Préfixe et compteur de numérotation automatique. */
  quotePrefix: string; // ex. "DEV-2026-"
  quoteCounter: number;
  /** Validité par défaut d'un devis, en jours. */
  defaultValidityDays: number;
  /** Paramètres du simulateur de rentabilité. */
  urssafRate: number; // %
  savingsRate: number; // % épargne sécurité
  workingCapitalRate: number; // % fonds de roulement / matériel
  /** Couleur d'accent de la marque (personnalisable). */
  accentColor: string;
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export interface Client {
  id: ID;
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string; // ISO
  /** Documents joints (métadonnées ; contenu dans IndexedDB). */
  documents: AttachedDocument[];
}

export interface AttachedDocument {
  id: ID;
  name: string;
  mime: string;
  /** Clé du blob dans IndexedDB. */
  blobId: string;
  addedAt: string;
}

/* ------------------------------------------------------------------ */
/* Bibliothèque de prestations                                         */
/* ------------------------------------------------------------------ */

export type PrestationCategory =
  | 'Post-mortem'
  | 'Décontamination'
  | 'Désinfection'
  | 'Odeurs'
  | 'Industriel'
  | 'Sinistre'
  | 'Déchets'
  | 'Déplacement'
  | 'Main-d’œuvre'
  | 'Divers';

export interface Prestation {
  id: ID;
  label: string;
  description: string;
  category: PrestationCategory;
  unit: string; // m², m³, km, h, forfait, kg…
  /** Prix de vente unitaire HT. */
  unitPrice: number;
  /** Coût de revient unitaire HT (chimie, EPI, sous-traitance…). */
  unitCost: number;
  vatRate: number; // %
  /** Temps moyen indicatif (heures) pour la planification. */
  averageTimeH: number;
  /** Matériel & produits conseillés (texte libre). */
  equipment: string;
  products: string;
}

/* ------------------------------------------------------------------ */
/* Devis                                                               */
/* ------------------------------------------------------------------ */

export type DevisStatus =
  | 'brouillon'
  | 'envoye'
  | 'accepte'
  | 'refuse'
  | 'facture'
  | 'paye';

export interface DevisLine {
  id: ID;
  /** Référence facultative vers la prestation d'origine. */
  prestationId?: ID;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number; // PU Vente HT
  unitCost: number; // Coût Revient HT
  vatRate: number; // %
  discountPct: number; // remise ligne en %
}

/** Paramètres du chantier (repris du modèle RFD). */
export interface SiteParams {
  floorArea: number; // Surface au sol (m²)
  ceilingHeight: number; // Hauteur sous plafond (m)
  roundTripKm: number; // Distance aller-retour (km)
  /** Volume total calculé (m³) — dérivé mais stocké pour référence. */
  volume: number;
}

export interface DevisPhoto {
  id: ID;
  /** Clé du blob (image d'origine) dans IndexedDB. */
  blobId: string;
  /** Clé du blob annoté (aplati) dans IndexedDB, si annotée. */
  annotatedBlobId?: string;
  caption: string;
  category: string; // ex. "Avant", "Après", "Zone rouge"…
  /** Annotations vectorielles ré-éditables. */
  annotations: Annotation[];
  createdAt: string;
}

export type AnnotationTool = 'arrow' | 'circle' | 'rect' | 'text' | 'measure' | 'free';

export interface Annotation {
  id: ID;
  tool: AnnotationTool;
  color: string;
  /** Points normalisés (0..1) relatifs à la taille de l'image. */
  points: { x: number; y: number }[];
  text?: string;
  /** Valeur de mesure saisie (ex. "2,5 m"). */
  measure?: string;
  strokeWidth: number;
}

export interface Signature {
  /** Image de la signature (data-URL PNG). */
  dataUrl: string;
  signedAt: string; // ISO
  signerName: string;
  /** Verrouille le devis (empêche l'édition). */
  locked: boolean;
}

export interface Devis {
  id: ID;
  number: string; // numérotation automatique
  clientId: ID;
  status: DevisStatus;
  createdAt: string;
  updatedAt: string;
  validUntil: string; // date de validité
  title: string;
  site: SiteParams;
  lines: DevisLine[];
  photos: DevisPhoto[];
  /** Notes internes / conditions particulières affichées sur le devis. */
  notes: string;
  signature?: Signature;
  /** Historique de suivi (changements de statut, envois…). */
  history: HistoryEntry[];
  /** Rappel automatique planifié (date ISO) ou null. */
  reminderAt?: string | null;
}

export interface HistoryEntry {
  at: string; // ISO
  label: string;
}

/* ------------------------------------------------------------------ */
/* Résultat de l'analyse IA d'une photo                                */
/* ------------------------------------------------------------------ */

export interface AiAnalysis {
  damageDescription: string;
  estimatedAreaM2: number;
  estimatedVolumeM3: number;
  contaminationLevel: 'Faible' | 'Modéré' | 'Élevé' | 'Critique';
  recommendedWork: string[];
  recommendedEquipment: string[];
  estimatedTimeH: number;
  ppe: string[]; // EPI
  products: string[];
  suggestedPriceHT: number;
  /** Lignes de devis pré-remplies proposées par l'IA. */
  suggestedLines: Omit<DevisLine, 'id'>[];
}
