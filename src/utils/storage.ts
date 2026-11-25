import { type DocStyle, normalizeStyle } from '../types';

const DRAFT_KEY = 'md-to-pdf:draft';

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
