// Photos kept with reflections. They live in IndexedDB, not in the localStorage
// save: a few photos would fill its few megabytes, and the save is rewritten on
// every change. A log keeps only the photos' ids (SelfCareLog.images).

const DB_NAME = 'littleworld:images';
const STORE = 'images';
/** Photos are shrunk so their longest side is at most this many pixels before they are kept. */
const MAX_SIDE = 1024;

let opened: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

/** Runs one request in its own transaction; writes resolve once the transaction has committed. */
async function run<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = use(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** A photo as a JPEG no bigger than MAX_SIDE; small images are only re-encoded. */
export async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d')!;
  // JPEG has no transparency: put see-through pixels on the page colour instead of black.
  ctx.fillStyle = '#fbf3dc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))), 'image/jpeg', 0.85));
}

/** Shrinks and keeps a photo; resolves with the id to store on the log. */
export async function saveImage(file: Blob): Promise<string> {
  const blob = await shrinkImage(file);
  const id = crypto.randomUUID();
  await run('readwrite', store => store.put(blob, id));
  return id;
}

/** A kept photo, or null when it is missing (another browser, or cleared site data). */
export async function loadImage(id: string): Promise<Blob | null> {
  const blob = await run<unknown>('readonly', store => store.get(id));
  return blob instanceof Blob ? blob : null;
}

/** Forgets one photo (taken off its reflection). */
export async function deleteImage(id: string): Promise<void> {
  await run('readwrite', store => store.delete(id));
}

/** Forgets every photo: a reset save has no reflections left to keep them for. */
export async function clearImages(): Promise<void> {
  await run('readwrite', store => store.clear());
}
