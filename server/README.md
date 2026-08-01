# RFD Devis — Backend (scaffold évolutif)

API Node.js pour la **synchronisation cloud, le multi-utilisateurs et la
sauvegarde serveur**. Le frontend fonctionne sans ce backend (mode local-first) ;
celui-ci est la voie d'évolution décrite dans le README racine.

## Stack

- **Node.js + Express** (API REST)
- **PostgreSQL + Prisma** (ORM typé ; le schéma reflète `src/types.ts`)
- **JWT** (authentification par jeton)
- **bcrypt** (hachage des mots de passe)

## Modèle

Le schéma (`prisma/schema.prisma`) couvre `User`, `Company`, `Client`, `Prestation`,
`Devis`, `DevisLine`, `Photo` et `HistoryEntry` — miroir du modèle frontend, avec
isolation des données par entreprise (`companyId`).

## Démarrage

```bash
cd server
cp .env.example .env          # renseigner DATABASE_URL et JWT_SECRET
npm install
npx prisma migrate dev        # crée le schéma
npm run dev                   # http://localhost:4000
```

## Points d'entrée

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/auth/register` | Création de compte + entreprise → JWT |
| `POST` | `/auth/login` | Connexion → JWT |
| `GET/POST/PUT/DELETE` | `/clients` | Clients (isolés par entreprise) |
| `GET/POST/PUT/DELETE` | `/prestations` | Bibliothèque de prestations |
| `GET/POST/PUT/DELETE` | `/devis` | Devis + lignes + historique (numérotation auto) |
| `POST` | `/devis/:id/status` | Changement de statut + historique |
| `POST` | `/photos/analyze` | **Analyse IA d'une photo via Claude Vision** |

Toutes les routes `/*` (hors `/auth`) exigent l'en-tête
`Authorization: Bearer <token>` (voir `src/middleware/auth.ts`).

## Analyse IA — Claude Vision

`POST /photos/analyze` reçoit `{ image (base64), mediaType, site }` et renvoie un
objet **`AiAnalysis`** identique à la sortie du mode heuristique frontend — le
branchement est donc transparent (voir `src/lib/anthropic.ts`).

- Modèle : `claude-opus-5` (configurable via `ANTHROPIC_MODEL`).
- **Sorties structurées** (`output_config.format` + schéma JSON) : la réponse
  respecte exactement la forme `AiAnalysis`, sans post-validation.
- La clé API (`ANTHROPIC_API_KEY`) reste **côté serveur** ; les refus de sécurité
  (`stop_reason: "refusal"`) sont gérés et renvoient une erreur exploitable.

Côté frontend, définir `VITE_ANTHROPIC_PROXY=http://localhost:4000/photos/analyze`
et stocker le JWT dans `localStorage['rfd-api-token']` (ou
`VITE_ANTHROPIC_PROXY_TOKEN`). Sans configuration, le frontend reste en mode
heuristique hors-ligne.

## Synchronisation frontend

Côté frontend, remplacer la persistance `localStorage` de `store/store.ts` par un
storage qui pousse les mutations vers ces routes (avec file d'attente hors-ligne et
résolution par `updatedAt`). Le stockage des photos (`lib/db.ts`) bascule vers
`POST /photos` + URLs signées.
