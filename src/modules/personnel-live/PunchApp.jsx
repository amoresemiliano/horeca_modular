import { useEffect, useRef, useState } from 'react';
import { deviceRequest } from './deviceClient';
import PushOptIn from './notifications/PushOptIn';
import './punch.css';

const errors = { OFFLINE: 'No hay conexión. No se pudo registrar el fichaje.', PIN_REJECTED: 'No se ha podido validar el PIN. Compruébalo o espera un minuto.', INVALID_DEVICE: 'Este dispositivo no está activado o ha sido revocado. Solicita una nueva activación.', DUPLICATE_PUNCH: 'El fichaje anterior ya está registrado. Espera unos segundos.', SERVER_NOT_CONFIGURED: 'El servicio de fichaje aún no está habilitado.' };
export default function PunchApp() {
  const [session, setSession] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(true), [pin, setPin] = useState(''), [result, setResult] = useState(null), [note, setNote] = useState(null), [now, setNow] = useState(new Date()), [install, setInstall] = useState(null);
  const input = useRef(null), pending = useRef(false), requestId = useRef(sessionStorage.getItem('personnel-pending-request')), lastPin = useRef(null);
  const fail = err => setError(errors[err.message] || 'No se pudo completar la operación. Vuelve a intentarlo.');
  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(location.hash.slice(1)).get('activate');
    // Remove the one-time bearer before any network call, analytics or referrer.
    if (location.hash) history.replaceState(null, '', '/personal/fichaje/');
    const ready = async () => {
      try { if (token) await deviceRequest('activate', { token }); const context = await deviceRequest('session'); if (active) setSession(context); }
      catch (err) { if (active) fail(err); }
      finally { if (active) setBusy(false); }
    };
    ready(); return () => { active = false; };
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!result) return; const timer = setTimeout(() => { setResult(null); setNote(null); setPin(''); input.current?.focus(); }, note === null ? 4500 : 60000); return () => clearTimeout(timer); }, [result, note]);
  useEffect(() => {
    const listener = event => { event.preventDefault(); setInstall(event); };
    window.addEventListener('beforeinstallprompt', listener); return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);
  async function enter(value) {
    if (pending.current || result || !session) return;
    const digits = value.replace(/\D/g, '').slice(0, 4); setPin(digits); setError('');
    if (digits.length < 4) return;
    pending.current = true; setBusy(true);
    // Keep only an in-memory request id after uncertain network delivery. Same
    // PIN retry reuses it, so a lost success response cannot toggle into OUT.
    if (!requestId.current || (lastPin.current && lastPin.current !== digits)) requestId.current = crypto.randomUUID();
    sessionStorage.setItem('personnel-pending-request', requestId.current);
    lastPin.current = digits;
    try {
      const response = await deviceRequest('punch', { pin: digits, requestId: requestId.current });
      setResult(response); requestId.current = null; lastPin.current = null; sessionStorage.removeItem('personnel-pending-request');
    } catch (err) {
      fail(err);
      if (err.message === 'INVALID_DEVICE') setSession(null);
      if (['PIN_REJECTED', 'INVALID_DEVICE', 'DUPLICATE_PUNCH', 'DENIED', 'INVALID_INPUT', 'SERVER_NOT_CONFIGURED', 'METHOD_NOT_ALLOWED'].includes(err.message)) { requestId.current = null; lastPin.current = null; sessionStorage.removeItem('personnel-pending-request'); }
    } finally { setPin(''); pending.current = false; setBusy(false); }
  }
  const formatted = session ? new Intl.DateTimeFormat('es-ES', { timeZone: session.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now) : '—';
  return <main className="punch-app"><header><img src="/personal/fichaje/icon.svg" alt="Vegen Digital" /><span>HORECA Personal</span></header>
    <section><p className="punch-unit">{session ? `${session.organization} · ${session.unit}` : 'Fichaje de personal'}</p><div className="punch-time">{formatted}</div>{session && <p className="punch-date">{new Intl.DateTimeFormat('es-ES', { timeZone: session.timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</p>}
      {result ? <div className="punch-success" role="status"><span aria-hidden="true">✓</span><h1>Hola, {result.firstName}</h1><h2>{result.kind === 'IN' ? 'Entrada registrada' : 'Salida registrada'}</h2><p>{new Intl.DateTimeFormat('es-ES', { timeZone: session.timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(result.occurredAt))}</p>{note === null ? <button onClick={() => setNote('')}>Añadir observación</button> : <form onSubmit={async e => { e.preventDefault(); if (pending.current) return; pending.current = true; try { await deviceRequest('observe', { punchId: result.id, observation: note }); setNote(null); setResult(null); } catch (err) { fail(err); } finally { pending.current = false; } }}><label>Observación<textarea autoFocus required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label><button type="submit">Guardar observación</button><button type="button" onClick={() => { setResult(null); setNote(null); }}>Cancelar</button></form>}</div>
        : session ? <><h1>Introduce tu PIN</h1><label className="punch-hidden" htmlFor="punch-pin">PIN de cuatro dígitos</label><input ref={input} id="punch-pin" type="password" inputMode="numeric" autoComplete="off" disabled={busy} maxLength={4} value={pin} onChange={e => enter(e.target.value)} /><div className="punch-dots" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i}>{pin.length > i ? '●' : '○'}</span>)}</div><div className="punch-keypad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Borrar', '0', '←'].map(key => <button disabled={busy} key={key} aria-label={key === '←' ? 'Borrar último dígito' : key} onClick={() => enter(key === 'Borrar' ? '' : key === '←' ? pin.slice(0, -1) : pin + key)}>{key}</button>)}</div></> : <p>{busy ? 'Comprobando dispositivo…' : 'Abre el enlace de activación facilitado por administración.'}</p>}
      <p className="punch-error" role="alert">{error}</p>{busy && session && <p role="status">Registrando…</p>}
    </section><footer>{session && <PushOptIn />}{install ? <button onClick={async () => { await install.prompt(); setInstall(null); }}>Instalar HORECA Personal</button> : <details><summary>Instalar en mi móvil</summary><p>Android: menú del navegador → Instalar aplicación. iPhone: Safari → Compartir → Añadir a pantalla de inicio.</p></details>}<small>Un fichaje solo se confirma cuando el servidor lo ha guardado.</small></footer>
  </main>;
}
