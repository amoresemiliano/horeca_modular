import { useEffect, useState } from 'react';

export const supportsPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function request(action, payload = {}) {
  const response = await fetch('/api/personnel-push', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
export default function PushOptIn() {
  const [config, setConfig] = useState(null), [pin, setPin] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    if (!supportsPush()) return;
    let active = true;
    request('status').then(value => { if (active) setConfig(value); }).catch(() => { if (active) setMessage('Los recordatorios todavía no están disponibles. Puedes seguir fichando.'); });
    return () => { active = false; };
  }, []);
  if (!supportsPush()) return <p>Este navegador no admite recordatorios. Puedes seguir fichando. En iPhone, instala la aplicación desde Safari.</p>;
  async function enable(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      // Called synchronously from a deliberate form submit, never on page load.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setMessage('Recordatorios desactivados por el navegador. Puedes seguir fichando.'); return; }
      const registration = await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const result = await request('subscribe', { pin, subscription: subscription.toJSON() });
      setConfig({ ...config, enabled: result.enabled }); setMessage('Recordatorios activados para tu PIN en este móvil.');
    } catch (error) { setMessage(error.message === 'PIN_REJECTED' ? 'No se ha podido validar el PIN. Revisa el PIN o espera un minuto.' : 'No se han activado los recordatorios. Puedes seguir fichando.'); }
    finally { setPin(''); setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      await request('unsubscribe');
      setConfig({ ...config, enabled: false });
      const registration = await navigator.serviceWorker.ready;
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      setMessage('Recordatorios desactivados.');
    } catch { setMessage('No se pudo confirmar el cambio. Vuelve a intentarlo con conexión.'); }
    finally { setBusy(false); }
  }
  return <details className="punch-reminders"><summary>Recordatorios de tu turno</summary><p>Solo en tu móvil personal. Cada dispositivo puede recibir recordatorios para un empleado. En un dispositivo compartido, mantén los recordatorios desactivados.</p>{config?.enabled ? <><p>Suscripción activa en el servidor para este dispositivo.</p><button disabled={busy} onClick={disable}>Desactivar recordatorios</button></> : config && <form onSubmit={enable}><label>Tu PIN para asociar recordatorios<input type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{4}" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></label><button disabled={busy}>Activar recordatorios</button></form>}<p role="status">{message}</p></details>;
}
