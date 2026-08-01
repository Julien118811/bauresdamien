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

## Points d'entrée (extrait)

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/auth/register` | Création de compte + entreprise |
| `POST` | `/auth/login` | Connexion → JWT |
| `GET/POST` | `/clients` | Liste / création (protégé) |
| `GET/POST/PUT` | `/devis` | Devis (protégé) |
| `GET/POST` | `/prestations` | Bibliothèque (protégé) |
| `POST` | `/photos` | Upload vers bucket sécurisé |

Toutes les routes `/*` (hors `/auth`) exigent l'en-tête
`Authorization: Bearer <token>` (voir `src/middleware/auth.ts`).

## Synchronisation frontend

Côté frontend, remplacer la persistance `localStorage` de `store/store.ts` par un
storage qui pousse les mutations vers ces routes (avec file d'attente hors-ligne et
résolution par `updatedAt`). Le stockage des photos (`lib/db.ts`) bascule vers
`POST /photos` + URLs signées.
