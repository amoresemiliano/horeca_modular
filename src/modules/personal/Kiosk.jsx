import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { time } from './domain';

export default function Kiosk({ service, unit, refresh, onLock }) {
  const [now, setNow] = useState(new Date()), [pin, setPin] = useState(''), [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [observing, setObserving] = useState(false), [note, setNote] = useState('');
  const input = useRef(null), pending = useRef(false);
  useEffect(() => { const tick = setInterval(() => setNow(new Date()), 1000); input.current?.focus(); return () => clearInterval(tick); }, []);
  useEffect(() => { if (!result || observing) return; const timer = setTimeout(() => { setResult(null); setNote(''); input.current?.focus(); }, 4500); return () => clearTimeout(timer); }, [result, observing]);
  useEffect(() => { if (!observing) return; const timer = setTimeout(() => { setObserving(false); setResult(null); setNote(''); }, 60000); return () => clearTimeout(timer); }, [observing, note]);
  async function enter(value) {
    if (pending.current || result) return;
    const next = value.replace(/\D/g, '').slice(0, 4); setPin(next); setError('');
    if (next.length !== 4) return;
    pending.current = true; setBusy(true);
    try { const response = await service.punch(next, unit.id); setResult(response); refresh(); }
    catch (err) { setError(err.message); }
    finally { setPin(''); setBusy(false); pending.current = false; }
  }
  return createPortal(<section className="per-kiosk" aria-label="Fichaje de personal"><header><span>VEGEN DIGITAL <small>HORECA Modular</small></span><button onClick={onLock}>Bloquear terminal</button></header><main>
    <div className="per-kiosk-unit">{unit.name}</div><p className="per-kiosk-time">{time(now, unit.timeZone)}</p><p>{new Intl.DateTimeFormat('es-ES', { timeZone: unit.timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</p>
    {result ? <div className="per-kiosk-result" role="status"><span aria-hidden="true">✓</span><h1>Hola, {result.firstName}</h1><h2>{result.event.kind === 'IN' ? 'Entrada registrada' : 'Salida registrada'}</h2><p>{time(result.event.at, unit.timeZone)}</p>{observing ? <form onSubmit={e => { e.preventDefault(); service.observe(result.event.id, note); refresh(); setObserving(false); setResult(null); setNote(''); }}><label>Observación<textarea autoFocus required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label><button type="submit">Guardar observación</button><button type="button" onClick={() => { setObserving(false); setResult(null); setNote(''); }}>Cancelar</button></form> : <><button onClick={() => setObserving(true)}>Añadir observación</button><small>La pantalla se limpiará en unos segundos.</small></>}</div>
      : <><h1>Introduce tu PIN</h1><label className="per-sr" htmlFor="personnel-pin">PIN de cuatro dígitos</label><input ref={input} id="personnel-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} disabled={busy} onChange={e => enter(e.target.value)} className="per-kiosk-input" /><div className="per-pin-dots" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i}>{pin.length > i ? '●' : '○'}</span>)}</div><div className="per-keypad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Borrar', '0', '←'].map(key => <button key={key} disabled={busy} aria-label={key === '←' ? 'Borrar último dígito' : key} onClick={() => enter(key === 'Borrar' ? '' : key === '←' ? pin.slice(0, -1) : pin + key)}>{key}</button>)}</div><div aria-live="polite" className="per-kiosk-message">{busy ? 'Validando…' : error}</div></>}
    </main><footer>Fichaje de personal · Demostración sin persistencia</footer></section>, document.body);
}
