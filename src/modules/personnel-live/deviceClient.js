export async function deviceRequest(action, payload = {}) {
  let response;
  try { response = await fetch('/api/personnel-punch', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) }); }
  catch { throw new Error('OFFLINE'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('UNAVAILABLE'); }
  if (!response.ok || result.error) throw new Error(result.error || 'UNAVAILABLE');
  return result;
}
