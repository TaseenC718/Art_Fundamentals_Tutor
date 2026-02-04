const DB_NAME = 'art-tutor-photos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

export interface StoredPhoto {
  id: string;
  imageData: string; // base64
  timestamp: number;
  date: string; // YYYY-MM-DD for grouping
}

export interface PhotosByDate {
  date: string;
  label: string; // "Today", "Yesterday", "Feb 1, 2026"
  photos: StoredPhoto[];
}

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function savePhoto(imageData: string): Promise<StoredPhoto> {
  const db = await getDB();
  const now = new Date();
  const photo: StoredPhoto = {
    id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    imageData,
    timestamp: now.getTime(),
    date: now.toISOString().split('T')[0], // YYYY-MM-DD
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(photo);

    request.onsuccess = () => resolve(photo);
    request.onerror = () => reject(new Error('Failed to save photo'));
  });
}

export async function getPhoto(id: string): Promise<StoredPhoto | null> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get photo'));
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete photo'));
  });
}

export async function getAllPhotos(): Promise<StoredPhoto[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev'); // Newest first

    const photos: StoredPhoto[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        photos.push(cursor.value);
        cursor.continue();
      } else {
        resolve(photos);
      }
    };

    request.onerror = () => reject(new Error('Failed to get all photos'));
  });
}

function getDateLabel(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  // Format as "Feb 1, 2026"
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export async function getPhotosByDate(): Promise<PhotosByDate[]> {
  const photos = await getAllPhotos();

  // Group by date
  const grouped = new Map<string, StoredPhoto[]>();

  for (const photo of photos) {
    const existing = grouped.get(photo.date) || [];
    existing.push(photo);
    grouped.set(photo.date, existing);
  }

  // Convert to array sorted by date (newest first)
  const result: PhotosByDate[] = [];
  const sortedDates = Array.from(grouped.keys()).sort().reverse();

  for (const date of sortedDates) {
    result.push({
      date,
      label: getDateLabel(date),
      photos: grouped.get(date)!,
    });
  }

  return result;
}

export async function getPhotoCount(): Promise<number> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to count photos'));
  });
}
