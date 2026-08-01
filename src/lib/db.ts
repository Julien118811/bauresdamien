/**
 * Stockage local des blobs (photos, documents) dans IndexedDB.
 *
 * Les images peuvent être volumineuses ; les stocker dans le store Zustand
 * (localStorage) saturerait le quota. On garde donc uniquement des métadonnées
 * avec un `blobId` dans le store, et le contenu binaire ici.
 *
 * Cette couche est volontairement isolée : pour évoluer vers un stockage cloud
 * sécurisé (S3, etc.), il suffit de réimplémenter `putBlob` / `getBlobUrl`.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { uid } from './format';

const DB_NAME = 'rfd-devis';
const STORE = 'blobs';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** Enregistre un blob et renvoie sa clé. */
export async function putBlob(blob: Blob): Promise<string> {
  const db = await getDB();
  const id = uid();
  await db.put(STORE, blob, id);
  return id;
}

/** Récupère un blob par sa clé. */
export async function getBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

/** Supprime un blob. */
export async function deleteBlob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

/* ------------------------------------------------------------------ */
/* Cache d'object-URLs                                                  */
/* ------------------------------------------------------------------ */

const urlCache = new Map<string, string>();

/** Renvoie une object-URL (mémoïsée) pour afficher un blob. */
export async function getBlobUrl(id: string): Promise<string | undefined> {
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await getBlob(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

/** Invalide l'URL en cache (après ré-annotation par exemple). */
export function invalidateBlobUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

/** Convertit un blob en data-URL (pour l'export PDF). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getBlobDataUrl(id: string): Promise<string | undefined> {
  const blob = await getBlob(id);
  if (!blob) return undefined;
  return blobToDataUrl(blob);
}
