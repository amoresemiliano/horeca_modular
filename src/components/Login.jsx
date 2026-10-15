import { useState } from 'react';
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoginHero from './access/LoginHero';
import LoginPanel from './access/LoginPanel';
import './access/access.css';

const Login = () => {
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return window.location.pathname === '/reset-password' && params.has('error')
      ? 'El enlace de acceso ha caducado o ya se ha utilizado. Solicita uno nuevo para recuperar el acceso.' : '';
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const { loginWithProvider, loginWithPassword, requestPasswordReset, updatePassword, isPasswordRecovery } = useAuth();

  // Preserve the existing DEV/PROD flags and trusted auth callbacks.
  const isProduction = import.meta.env.VITE_APP_ENV === 'production';
  const isDevPasswordAuthEnabled = !isProduction && import.meta.env.VITE_DEV_PASSWORD_AUTH === 'true';
  const isPasswordAuthEnabled = isDevPasswordAuthEnabled || (isProduction && import.meta.env.VITE_PASSWORD_AUTH === 'true');
  const isRecoveryRequest = window.location.pathname === '/reset-password' && !isPasswordRecovery;
  const busy = status.startsWith('loading_');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || 'vmxjqwlfwnphorthhcwu';
  const gitSha = (import.meta.env.VITE_RELEASE_SHA || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'c5f73c6').slice(0, 7);

  const handleOAuthLogin = async (provider) => {
    setStatus(`loading_${provider}`);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await loginWithProvider(provider);
    } catch {
      setErrorMsg(`No se pudo iniciar sesión con ${provider === 'google' ? 'Google' : 'GitHub'}. Inténtalo de nuevo.`);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = (emailInput || '').trim();
    const cleanPassword = (passwordInput || '').trim();
    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Introduce tu email y contraseña.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3500);
      return;
    }
    setStatus('loading_password');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await loginWithPassword(cleanEmail, cleanPassword);
    } catch (err) {
      const invalid = /Invalid login credentials|Invalid credentials/.test(err.message || '');
      setErrorMsg(invalid ? 'Credenciales inválidas. Verifica tu email y contraseña.' : 'No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const handleResetRequestSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput) {
      setErrorMsg('Introduce tu email para recibir el enlace de recuperación.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3500);
      return;
    }
    setStatus('loading_reset');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await requestPasswordReset(emailInput);
      setSuccessMsg('Se ha solicitado el enlace de recuperación. Revisa tu correo y la carpeta de spam.');
      setStatus('success_reset');
    } catch {
      setErrorMsg('No se pudo solicitar la recuperación. Inténtalo de nuevo en unos minutos.');
      setStatus('error');
    }
  };

  const handleUpdatePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3500);
      return;
    }
    setStatus('loading_update');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updatePassword(newPasswordInput);
      setSuccessMsg('Contraseña actualizada. Accediendo a la plataforma…');
      setStatus('success_update');
    } catch {
      setErrorMsg('No se pudo actualizar la contraseña. Comprueba el enlace de recuperación e inténtalo de nuevo.');
      setStatus('error');
    }
  };

  const title = isPasswordRecovery ? 'Configura tu contraseña' : isRecoveryRequest ? 'Recupera tu acceso' : 'Iniciá sesión para continuar';
  const description = isPasswordRecovery ? 'Elige una contraseña para tu cuenta.' : isRecoveryRequest ? 'Recibe un enlace seguro en tu correo.' : 'Ingresa tus credenciales del portal de gestión';

  return (
    <main className="access-portal">
      <LoginHero />
      <LoginPanel title={title} description={description}>
        {isDevPasswordAuthEnabled && !isPasswordRecovery && !isRecoveryRequest && <p className="access-dev-badge">Acceso de Desarrollo (DEV-ONLY)</p>}
        {errorMsg && <p id="access-error" className="access-message access-message--error" role="alert">{errorMsg}</p>}
        {status.startsWith('success_') && <p className="access-message access-message--success" role="status">{successMsg}</p>}
        {isPasswordRecovery ? (
          <form className="access-form" onSubmit={handleUpdatePasswordSubmit} aria-busy={busy}>
            <label htmlFor="access-new-password">Nueva contraseña</label>
            <div className="access-input-wrap"><KeyRound aria-hidden="true" size={18} /><input id="access-new-password" name="new-password" type="password" autoComplete="new-password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} aria-describedby={errorMsg ? 'access-error' : undefined} /></div>
            <button className="access-submit" type="submit" disabled={busy}>{status === 'loading_update' ? 'Guardando contraseña…' : 'Guardar nueva contraseña'}<ArrowRight aria-hidden="true" size={18} /></button>
          </form>
        ) : isRecoveryRequest ? (
          // Controlled recovery stays on the existing callback route only.
          <form className="access-form" onSubmit={handleResetRequestSubmit} aria-busy={busy}>
            <label htmlFor="access-recovery-email">Correo para recuperar el acceso</label>
            <div className="access-input-wrap"><Mail aria-hidden="true" size={18} /><input id="access-recovery-email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="tu@correo.com" aria-describedby={errorMsg ? 'access-error' : undefined} /></div>
            <button className="access-submit" type="submit" disabled={busy}>{status === 'loading_reset' ? 'Solicitando enlace…' : 'Enviar enlace de recuperación'}<ArrowRight aria-hidden="true" size={18} /></button>
            <a className="access-back" href="/">Volver al inicio de sesión</a>
          </form>
        ) : isPasswordAuthEnabled ? (
          <form className="access-form" onSubmit={handlePasswordSubmit} aria-busy={busy}>
            <label htmlFor="access-email">Email</label>
            <div className="access-input-wrap"><Mail aria-hidden="true" size={18} /><input id="access-email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="tu@correo.com" required aria-describedby={errorMsg ? 'access-error' : undefined} /></div>
            <label htmlFor="access-password">Contraseña</label>
            <div className="access-input-wrap"><LockKeyhole aria-hidden="true" size={18} /><input id="access-password" name="password" type="password" autoComplete="current-password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Tu contraseña" required aria-describedby={errorMsg ? 'access-error' : undefined} /></div>
            <button className="access-submit" type="submit" disabled={busy}>{status === 'loading_password' ? 'Iniciando sesión…' : 'Iniciar sesión'}<ArrowRight aria-hidden="true" size={18} /></button>
          </form>
        ) : (
          <div className="access-providers" aria-busy={busy}>
            <p>Continúa con tu cuenta de acceso</p>
            <button type="button" disabled={busy} onClick={() => handleOAuthLogin('google')}>{status === 'loading_google' ? 'Redirigiendo a Google…' : 'Acceder con Google'}<ArrowRight aria-hidden="true" size={18} /></button>
            <button type="button" disabled={busy} onClick={() => handleOAuthLogin('github')}>{status === 'loading_github' ? 'Redirigiendo a GitHub…' : 'Acceder con GitHub'}<ArrowRight aria-hidden="true" size={18} /></button>
          </div>
        )}
        {busy && <p className="access-progress" role="status">{status === 'loading_reset' ? 'Solicitando recuperación…' : status === 'loading_update' ? 'Guardando nueva contraseña…' : 'Conectando de forma segura…'}</p>}
        <p className="access-secure"><ShieldCheck size={16} aria-hidden="true" />Acceso seguro a tu organización</p>
        {isDevPasswordAuthEnabled && <p className="access-diagnostics">DEV · {gitSha} · Supabase {projectRef}</p>}
      </LoginPanel>
    </main>
  );
};

export default Login;
