// Preferences only. Every restored ID and route must pass the normal access gates.
const key = id => `horeca-context-v1:${id}`;
export function readContext(userId) {
  try { return userId ? JSON.parse(localStorage.getItem(key(userId)) || '{}') : {}; } catch { return {}; }
}
export function saveContext(userId, patch) {
  if (!userId) return;
  try { localStorage.setItem(key(userId), JSON.stringify({ ...readContext(userId), ...patch })); } catch { /* Storage may be unavailable. */ }
}
export function clearContext(userId) {
  try { if (userId) localStorage.removeItem(key(userId)); } catch { /* No authority is stored here. */ }
  const url = new URL(window.location.href);
  url.searchParams.delete('module'); url.searchParams.delete('section');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}
export function readRoute(userId) {
  const url = new URL(window.location.href), saved = readContext(userId);
  return { module: url.searchParams.get('module') || saved.module, section: url.searchParams.get('section') || saved.section };
}
export function saveRoute(userId, module, section) {
  saveContext(userId, { module, section });
  const url = new URL(window.location.href);
  url.searchParams.set('module', module); url.searchParams.set('section', section);
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}
