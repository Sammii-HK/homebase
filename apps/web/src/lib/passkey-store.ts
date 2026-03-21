import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.PASSKEY_DATA_DIR ?? "/app/data";
const PASSKEY_FILE = path.join(DATA_DIR, "passkey.json");

export interface StoredCredential {
  credentialID: string;
  credentialPublicKey: string; // base64
  counter: number;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports: string[];
  createdAt: string;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function hasCredential(): Promise<boolean> {
  try {
    await fs.access(PASSKEY_FILE);
    return true;
  } catch {
    return false;
  }
}

export async function loadCredential(): Promise<StoredCredential | null> {
  try {
    const raw = await fs.readFile(PASSKEY_FILE, "utf8");
    return JSON.parse(raw) as StoredCredential;
  } catch {
    return null;
  }
}

export async function saveCredential(credential: Omit<StoredCredential, "createdAt">): Promise<void> {
  await ensureDir();
  const toSave: StoredCredential = {
    ...credential,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(PASSKEY_FILE, JSON.stringify(toSave, null, 2), "utf8");
}

export async function updateCredentialCounter(newCounter: number): Promise<void> {
  const existing = await loadCredential();
  if (!existing) return;
  existing.counter = newCounter;
  await fs.writeFile(PASSKEY_FILE, JSON.stringify(existing, null, 2), "utf8");
}
