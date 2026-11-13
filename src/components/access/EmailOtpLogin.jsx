import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function EmailOtpLogin() {
  const { requestLoginCode, verifyLoginCode } = useAuth();
  const [email, setEmail] = useState(''), [code, setCode] = useState('');
  const [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      if (sent) await verifyLoginCode(email, code);
      else { await requestLoginCode(email); setSent(true); }
    } catch { setError(sent ? 'Código no válido o caducado. Compruébalo o solicita uno nuevo.' : 'No se pudo enviar el código. Espera un minuto y vuelve a intentarlo.'); }
    finally { setBusy(false); }
  }
  return <form className="access-form" onSubmit={submit} aria-busy={busy}>
    <label htmlFor="otp-email">Correo electrónico</label>
    <div className="access-input-wrap"><input id="otp-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={busy || sent} value={email} onChange={e => setEmail(e.target.value)} /></div>
    {sent && <><p role="status">Si tu cuenta tiene acceso, recibirás un código en tu correo. Caduca en 10 minutos.</p><label htmlFor="otp-code">Código de acceso</label><div className="access-input-wrap"><input id="otp-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} autoFocus required disabled={busy} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} /></div></>}
    {error && <p className="access-message access-message--error" role="alert">{error}</p>}
    <button className="access-submit" type="submit" disabled={busy}>{busy ? 'Conectando…' : sent ? 'Entrar con el código' : 'Recibir código de acceso'}</button>
    {sent && <button type="button" className="access-back" disabled={busy} onClick={() => { setSent(false); setCode(''); setError(''); }}>Cambiar correo o solicitar otro código</button>}
  </form>;
}
