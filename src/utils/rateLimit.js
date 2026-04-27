export const MAX_PER_HOUR = 3;
export const STORAGE_KEY = 'share-suggestion-submissions';
const HOUR_MS = 60 * 60 * 1000;

function readTimestamps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function recentTimestamps() {
  const cutoff = Date.now() - HOUR_MS;
  return readTimestamps().filter((t) => t >= cutoff);
}

export function hasExceededLimit() {
  return recentTimestamps().length >= MAX_PER_HOUR;
}

export function recordSubmission() {
  const updated = [...recentTimestamps(), Date.now()];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — fail open
  }
}
