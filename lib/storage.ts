import { validatePageNumber, type TranslatedPage } from './book-structure';
import { SEED_TRANSLATIONS } from './seed-translations';

const DB_NAME = 'galitsky_hy_book_db';
const DB_VERSION = 1;
const STORE_NAME = 'pages';
const FALLBACK_LS_KEY = 'galitsky_hy_book_pages_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'pageNumber' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function getSeedMap(): Record<number, TranslatedPage> {
  const map: Record<number, TranslatedPage> = {};
  for (const key of Object.keys(SEED_TRANSLATIONS)) {
    const p = Number(key);
    map[p] = { ...SEED_TRANSLATIONS[p] };
  }
  return map;
}

export async function loadAllPages(): Promise<Record<number, TranslatedPage>> {
  const base = getSeedMap();

  if (typeof window === 'undefined') {
    return base;
  }

  try {
    const res = await fetch('/translated-book-272.json', { cache: 'no-store' });
    if (res.ok) {
      const bundled = (await res.json()) as Record<string, TranslatedPage>;
      for (const [k, v] of Object.entries(bundled)) {
        const p = Number(k);
        if (!Number.isNaN(p) && v?.translatedMarkdown?.trim()) {
          base[p] = v;
        }
      }
    }
  } catch {
    // Bundled book JSON optional if not yet generated
  }

  try {
    const db = await openDatabase();
    const stored = await new Promise<TranslatedPage[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as TranslatedPage[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('Failed to read IndexedDB'));
    });

    for (const item of stored) {
      if (item && typeof item.pageNumber === 'number' && item.translatedMarkdown?.trim()) {
        base[item.pageNumber] = item;
      }
    }

    db.close();
    return base;
  } catch {
    // Fallback to localStorage if IndexedDB is blocked
    try {
      const raw = window.localStorage.getItem(FALLBACK_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, TranslatedPage>;
        for (const [k, v] of Object.entries(parsed)) {
          const p = Number(k);
          if (!Number.isNaN(p) && v?.translatedMarkdown?.trim()) {
            base[p] = v;
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
    return base;
  }
}

export async function savePage(page: TranslatedPage): Promise<void> {
  const normalized: TranslatedPage = {
    ...page,
    pageNumber: validatePageNumber(page.pageNumber),
  };

  if (typeof window === 'undefined') return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to save page'));
    });
    db.close();
  } catch {
    try {
      const raw = window.localStorage.getItem(FALLBACK_LS_KEY);
      const current = raw ? (JSON.parse(raw) as Record<string, TranslatedPage>) : {};
      current[String(normalized.pageNumber)] = normalized;
      window.localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(current));
    } catch {
      // Ignore storage quota issues
    }
  }
}

export async function savePagesBatch(pages: TranslatedPage[]): Promise<void> {
  if (typeof window === 'undefined' || pages.length === 0) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const page of pages) {
        store.put({
          ...page,
          pageNumber: validatePageNumber(page.pageNumber),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to save pages batch'));
    });
    db.close();
  } catch {
    try {
      const raw = window.localStorage.getItem(FALLBACK_LS_KEY);
      const current = raw ? (JSON.parse(raw) as Record<string, TranslatedPage>) : {};
      for (const page of pages) {
        const num = validatePageNumber(page.pageNumber);
        current[String(num)] = { ...page, pageNumber: num };
      }
      window.localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(current));
    } catch {
      // Ignore
    }
  }
}

export async function resetNonSeedPages(): Promise<Record<number, TranslatedPage>> {
  const seeds = getSeedMap();
  if (typeof window === 'undefined') return seeds;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const page of Object.values(seeds)) {
        store.put(page);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to reset store'));
    });
    db.close();
  } catch {
    try {
      window.localStorage.removeItem(FALLBACK_LS_KEY);
    } catch {
      // Ignore
    }
  }

  return seeds;
}

export function exportBookJson(pagesMap: Record<number, TranslatedPage>): string {
  return JSON.stringify(
    {
      version: 1,
      book: 'Galitsky 8-9 Armenian Translation',
      exportedAt: new Date().toISOString(),
      pages: pagesMap,
    },
    null,
    2
  );
}

export function parseImportedBookJson(raw: string): TranslatedPage[] {
  const parsed = JSON.parse(raw) as { pages?: Record<string, TranslatedPage> } | Record<string, TranslatedPage>;
  const record = 'pages' in parsed && parsed.pages ? parsed.pages : (parsed as Record<string, TranslatedPage>);
  const result: TranslatedPage[] = [];
  for (const val of Object.values(record)) {
    if (
      val &&
      typeof val.pageNumber === 'number' &&
      typeof val.translatedMarkdown === 'string' &&
      val.translatedMarkdown.trim().length > 0
    ) {
      result.push({
        pageNumber: validatePageNumber(val.pageNumber),
        sectionTitle: typeof val.sectionTitle === 'string' ? val.sectionTitle : '',
        translatedMarkdown: val.translatedMarkdown,
        source: val.source === 'gemini' || val.source === 'edited' ? val.source : 'seed',
        updatedAt: typeof val.updatedAt === 'string' ? val.updatedAt : new Date().toISOString(),
      });
    }
  }
  return result;
}
