import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
// Access token lives strictly in memory — never persisted to localStorage or sessionStorage
let cachedAccessToken: string | null = null;

function getFirebaseAuth(): Auth {
  if (!appInstance) {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  if (!authInstance) {
    authInstance = getAuth(appInstance);
  }
  return authInstance;
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
    callback(user);
  });
}

export async function signInWithGoogleDrive(): Promise<{ user: User; accessToken: string }> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_FILE_SCOPE);
  provider.setCustomParameters({ prompt: 'consent select_account' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken ?? null;
  if (!token) {
    throw new Error('Չհաջողվեց ստանալ Google Drive հասանելիության թոքենը։ Կրկին փորձեք մուտք գործել։');
  }
  cachedAccessToken = token;
  return { user: result.user, accessToken: token };
}

export function getCachedDriveToken(): string | null {
  return cachedAccessToken;
}

export async function signOutGoogle(): Promise<void> {
  cachedAccessToken = null;
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export async function listAppDriveFiles(accessToken: string): Promise<DriveFileItem[]> {
  const query = encodeURIComponent("trashed = false");
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=25`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive ֆայլերի ցանկի սխալ (${res.status}): ${errText}`);
  }
  const data = (await res.json()) as { files?: DriveFileItem[] };
  return data.files ?? [];
}

export async function createBookInDrive(
  accessToken: string,
  options: {
    name: string;
    content: string;
    sourceMimeType: 'text/html' | 'text/markdown';
    convertToGoogleDoc: boolean;
  }
): Promise<DriveFileItem> {
  const metadata: Record<string, string> = {
    name: options.name,
  };
  if (options.convertToGoogleDoc) {
    metadata.mimeType = 'application/vnd.google-apps.document';
  }

  const boundary = `galitsky_hy_${Date.now()}`;
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${options.sourceMimeType}; charset=UTF-8`,
    '',
    options.content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Չհաջողվեց ստեղծել ֆայլը Google Drive-ում (${res.status}): ${errText}`);
  }
  return (await res.json()) as DriveFileItem;
}

export async function updateBookInDrive(
  accessToken: string,
  fileId: string,
  options: {
    name?: string;
    content: string;
    sourceMimeType: 'text/html' | 'text/markdown';
  }
): Promise<DriveFileItem> {
  const boundary = `galitsky_hy_upd_${Date.now()}`;
  const metadata = options.name ? { name: options.name } : {};

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${options.sourceMimeType}; charset=UTF-8`,
    '',
    options.content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Չհաջողվեց թարմացնել ֆայլը Google Drive-ում (${res.status}): ${errText}`);
  }
  return (await res.json()) as DriveFileItem;
}
