import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { type DocStyle, normalizeStyle } from '../types';

const DRAFT_KEY = 'md-to-pdf:draft';
const BACKUP_KEY = 'md-to-pdf:backup';
const SHARE_PREFIX = '#share=';

export interface Draft {
  markdown: string;
  style: DocStyle;
}

function parseDraft(json: string | null): Draft | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as { markdown?: unknown; style?: unknown };
    if (typeof data.markdown !== 'string') return null;
    return { markdown: data.markdown, style: normalizeStyle(data.style) };
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage full or blocked (private mode); autosave is best-effort
  }
}

export const loadDraft = (): Draft | null => parseDraft(read(DRAFT_KEY));
export const saveDraft = (draft: Draft): void => write(DRAFT_KEY, JSON.stringify(draft));

/** Keep the previous draft when a shared link replaces it, so it can be restored. */
export const backupDraft = (draft: Draft): void => write(BACKUP_KEY, JSON.stringify(draft));
export const loadBackup = (): Draft | null => parseDraft(read(BACKUP_KEY));
export const clearBackup = (): void => write(BACKUP_KEY, null);

export function encodeShare(draft: Draft): string {
  return compressToEncodedURIComponent(JSON.stringify(draft));
}

export function decodeShare(encoded: string): Draft | null {
  try {
    return parseDraft(decompressFromEncodedURIComponent(encoded));
  } catch {
    return null;
  }
}

export function shareUrl(draft: Draft, base = `${location.origin}${location.pathname}`): string {
  return `${base}${SHARE_PREFIX}${encodeShare(draft)}`;
}

export function readShareFromHash(hash = location.hash): Draft | null {
  return hash.startsWith(SHARE_PREFIX) ? decodeShare(hash.slice(SHARE_PREFIX.length)) : null;
}
