# RFD Devis — Logiciel professionnel de devis avec photos

Application web moderne pour créer des devis professionnels **directement chez le
client**, sur ordinateur, tablette ou smartphone. Conçue pour **RFD**
(décontamination biologique, nettoyage post-mortem et extrême), avec un moteur de
calcul et une bibliothèque de prestations calqués sur le fonctionnement réel de
l'entreprise (marge ligne par ligne, simulateur de rentabilité micro-entreprise).

> **Rapide, simple, tactile, hors-ligne.** L'application fonctionne intégralement
> sans connexion : les données sont sauvegardées sur l'appareil et les PDF sont
> générés localement. Idéal pour établir un devis sur le terrain, même sans réseau.

---

## ✨ Fonctionnalités

| Domaine | Détails |
|---|---|
| **Tableau de bord** | Nombre de devis, acceptés / refusés, CA signé et potentiel, graphiques mensuels (CA + volume), répartition, historique des interventions. |
| **Clients** | Fiche complète (coordonnées, notes), historique des devis/factures, photos & documents joints, recherche. |
| **Création de devis** | Numérotation automatique, dates, validité, TVA multi-taux, remises, logo, coordonnées, lignes illimitées avec **calcul automatique** (total HT, TVA, marge). |
| **Paramètres du chantier** | Surface, hauteur, **volume calculé automatiquement**, distance A/R — repris du modèle RFD. |
| **Photos** | Prise de photo (appareil), import multiple, catégories (Avant/Après/Zone rouge…), **galerie**, insertion automatique dans le PDF. |
| **Annotation** | Flèches, cercles, rectangles, dessin libre, **mesures**, texte, choix de couleur et d'épaisseur, annotations vectorielles ré-éditables. |
| **IA** | Analyse d'une photo → description des dégâts, surface/volume estimés, niveau de contamination, travaux, matériel, temps, **EPI**, produits, prix conseillé et **lignes de devis pré-remplies**. Tout est modifiable. |
| **Bibliothèque de prestations** | Base pré-remplie (post-mortem, décontamination, désinfection, odeurs, sinistre, déchets DASRI/DIB…), avec prix de vente, coût de revient, temps, matériel, produits, catégorie. |
| **Rentabilité** | Main-d'œuvre, déplacement, kilométrage, consommables, marge, TVA, **Total HT / TTC**, bénéfice estimé, charges URSSAF, épargne, fonds de roulement, **« restant dans la poche »**. |
| **PDF pro** | Logo, coordonnées, tableau, TVA, CGV, zone de signature, **QR code**, **annexe photos**, pagination. |
| **Signature électronique** | Signature tactile ; le devis est **verrouillé** après signature. |
| **Envoi** | Email, SMS, WhatsApp, lien sécurisé, téléchargement PDF. |
| **Suivi** | Tableau Kanban (brouillon → envoyé → accepté / refusé → facturé → payé), relances automatiques sur validité. |
| **Personnalisation** | Logo, couleur d'accent, police, mentions légales, TVA, CGV, modèle de numérotation. |
| **Sauvegarde** | Automatique (hors-ligne), export `.json`. Prête pour la synchronisation cloud (voir *Évolution*). |
| **Interface** | Design épuré, grandes icônes, **mode sombre & clair**, navigation tactile, temps de réponse < 1 s. |

---

## 🛠️ Stack technique

- **Frontend :** React 18 + TypeScript + Vite
- **État & persistance :** Zustand (+ `persist` localStorage) — hors-ligne par défaut
- **Stockage des photos :** IndexedDB (`idb`) — les blobs restent hors du store
- **Graphiques :** Recharts
- **PDF :** jsPDF + jspdf-autotable (100 % côté client)
- **QR code :** `qrcode`
- **Annotation & signature :** Canvas HTML5 (aucune dépendance)
- **PWA :** manifeste + design responsive (installable sur mobile/tablette)

Le code est **strictement typé** (TypeScript `strict`), commenté et organisé par
responsabilités (`lib/` métier, `store/` état, `components/` UI, `pages/` écrans).

---

## 🚀 Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production (dist/)
npm run preview    # sert le build
npm run lint       # vérification TypeScript
```

Aucune configuration n'est requise : l'application démarre avec la bibliothèque de
prestations et les paramètres RFD pré-remplis.

---

## 🧠 Moteur de calcul (modèle RFD)

Chaque ligne porte un **prix de vente** *et* un **coût de revient**, ce qui permet
de calculer la **marge nette ligne par ligne** puis, au niveau du devis :

```
Total HT ── TVA (par taux) ── Total TTC
Marge brute = Total HT − Coûts variables
Bénéfice net = Marge brute − URSSAF(%)
Restant dans la poche = Bénéfice net − Épargne(%) − Fonds de roulement(%)
```

Ces paramètres (URSSAF, épargne, fonds de roulement) sont configurables dans
**Paramètres → Rentabilité**. Voir `src/lib/calc.ts`.

---

## 🤖 Fonction IA

`src/lib/ai.ts` fonctionne en deux modes, avec **exactement la même sortie**
(`AiAnalysis`) :

1. **Heuristique (hors-ligne, par défaut)** — analyse locale de l'image (dominante
   colorimétrique, « charge visuelle ») croisée avec les paramètres du chantier
   pour proposer un devis cohérent.
2. **Claude Vision (en ligne)** — si la variable `VITE_ANTHROPIC_PROXY` pointe vers
   un endpoint relayant vers l'API Claude, l'image y est envoyée et l'analyse
   provient du modèle. Le branchement est transparent (aucun changement d'UI).

```bash
# .env.local
VITE_ANTHROPIC_PROXY=https://votre-endpoint/analyse-photo
```

L'utilisateur peut **modifier chaque valeur** proposée : l'IA n'est qu'une aide à
la saisie.

---

## ☁️ Évolution : synchronisation cloud & multi-utilisateurs

L'application est **local-first** par choix (usage terrain, hors-ligne). L'ajout
d'un backend est prévu sans refonte :

- La persistance passe par une seule couche (`store/store.ts` + `lib/db.ts`) :
  remplacer `persist(localStorage)` par un storage synchronisant vers l'API.
- Un **scaffold backend** (Node.js + Express + Prisma + PostgreSQL + JWT) est fourni
  dans [`server/`](server/README.md). Le schéma Prisma reflète `src/types.ts`.
- Le stockage des photos (`lib/db.ts`) est isolé : brancher un bucket cloud
  sécurisé (S3/GCS) revient à réimplémenter `putBlob` / `getBlobUrl`.

---

## 📁 Structure

```
src/
├── types.ts              Modèle de données (source de vérité)
├── lib/
│   ├── calc.ts           Moteur de calcul (marge, TVA, rentabilité)
│   ├── ai.ts             Analyse IA (heuristique + Claude Vision)
│   ├── pdf.ts            Génération PDF professionnelle
│   ├── db.ts             Stockage des blobs (IndexedDB)
│   ├── seed.ts           Prestations & paramètres RFD par défaut
│   └── format.ts         Formatage (€, dates, FR)
├── store/store.ts        État global (Zustand + persistance)
├── components/           Icon, Modal/Toast, BlobImage, PhotoAnnotator, SignaturePad
└── pages/                Dashboard, Clients, ClientDetail, DevisList, DevisEditor,
                          Prestations, Settings
server/                   Scaffold backend évolutif (Express + Prisma + JWT)
```

---

## 🔐 Sécurité & données

- Données stockées **localement** sur l'appareil (aucune fuite réseau en mode
  hors-ligne). Exportez une sauvegarde `.json` depuis **Paramètres**.
- Le devis signé est **verrouillé** (non modifiable).
- Historique des changements de statut conservé par devis.
- Le scaffold backend ajoute comptes utilisateurs (JWT), sauvegarde serveur et
  historique — voir `server/`.

---

*Développé pour RFD — décontamination, nettoyage post-mortem et extrême.*
