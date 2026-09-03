import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logoVDC from '../assets/icono_VDC.png';
import logoCliente from '../assets/logo_cliente.png';

const Login = () => {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading_google' | 'loading_github' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const { loginWithProvider } = useAuth();

  const handleLogin = async (provider) => {
    setStatus(`loading_${provider}`);
    setErrorMsg('');
    try {
      await loginWithProvider(provider);
    } catch (err) {
      console.error(`Error durante autenticación ${provider}:`, err.message);
      setErrorMsg(`Error de autenticación con ${provider === 'google' ? 'Google' : 'GitHub'}. Intentalo de nuevo.`);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3500);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'var(--font-body)',
      background: 'var(--c-bg)',
    }}>

      {/* ── PANEL IZQUIERDO (Imagen de marca) ──────────────────── */}
      <div style={{
        flex: 1,
        display: 'none',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        position: 'relative',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '4rem',
      }}
      className="login-panel-left"
      >
        {/* Grid decorativo de fondo */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(226,35,26,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(226,35,26,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />

        {/* Orbes decorativos */}
        <div style={{
          position: 'absolute',
          top: '-80px', right: '-80px',
          width: '400px', height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(226,35,26,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-60px', left: '-60px',
          width: '300px', height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,104,71,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Contenido */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <img src={logoCliente} alt="El Criollo" style={{ height: '72px', objectFit: 'contain', marginBottom: '2rem', filter: 'brightness(0) invert(1)' }} />
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            marginBottom: '1rem',
          }}>
            Plataforma de Gestión<br />
            <span style={{ color: '#F87171' }}>HORECA</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9375rem', lineHeight: 1.6, maxWidth: '340px' }}>
            Control total de tu negocio. Bancos, KPIs, inventario, personal y más — todo en un solo lugar.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '2.5rem', justifyContent: 'center' }}>
            {['🏦 Extractos bancarios', '📈 KPIs en tiempo real', '👥 Control de personal', '🍳 Producción', '📦 Inventario'].map(f => (
              <span key={f} style={{
                padding: '0.35rem 0.875rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>{f}</span>
            ))}
          </div>
        </div>

        {/* Footer panel */}
        <div style={{
          position: 'absolute', bottom: '2rem', left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        }}>
          <img src={logoVDC} alt="VDC" style={{ height: '20px', opacity: 0.35, filter: 'invert(1)' }} />
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Vegen Digital
          </span>
        </div>
      </div>

      {/* ── PANEL DERECHO (Formulario) ──────────────────────────── */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        margin: '0 auto',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>

          {/* Logotipo mobile */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <img src={logoCliente} alt="El Criollo" style={{ height: '52px', objectFit: 'contain', marginBottom: '1.25rem' }} />
            <p style={{ fontSize: '0.8125rem', color: 'var(--c-text-4)', fontWeight: 500 }}>
              Iniciá sesión para continuar
            </p>
          </div>

          {/* Card de login */}
          <div style={{
            background: 'var(--c-surface)',
            borderRadius: 'var(--r-2xl)',
            border: '1px solid var(--c-border)',
            boxShadow: 'var(--shadow-lg)',
            padding: '2.25rem 2rem',
          }}>
            {/* Campo usuario (decorativo) */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block', fontSize: '0.75rem', fontWeight: 700,
                color: 'var(--c-text-3)', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '0.5rem',
              }}>Email</label>
              <input
                type="email" disabled placeholder="Gestionado por Supabase Auth"
                style={{
                  width: '100%', padding: '0.65rem 1rem',
                  border: '1.5px solid var(--c-border)',
                  borderRadius: 'var(--r-lg)',
                  background: 'var(--c-bg)',
                  color: 'var(--c-text-4)',
                  fontSize: '0.875rem',
                  cursor: 'not-allowed',
                  outline: 'none',
                  fontFamily: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{
                display: 'block', fontSize: '0.75rem', fontWeight: 700,
                color: 'var(--c-text-3)', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '0.5rem',
              }}>Contraseña</label>
              <input
                type="password" disabled placeholder="••••••••"
                style={{
                  width: '100%', padding: '0.65rem 1rem',
                  border: '1.5px solid var(--c-border)',
                  borderRadius: 'var(--r-lg)',
                  background: 'var(--c-bg)',
                  color: 'var(--c-text-4)',
                  fontSize: '0.875rem',
                  cursor: 'not-allowed',
                  outline: 'none',
                  fontFamily: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Divisor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--c-border)' }} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--c-text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Acceso mediante OAuth
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--c-border)' }} />
            </div>

            {/* Botones de OAuth / Estados */}
            {status === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Botón Google */}
                <button
                  onClick={() => handleLogin('google')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    padding: '0.8rem 1.5rem',
                    background: 'var(--c-text-1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--r-xl)',
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 200ms ease',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.2)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1E293B'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-text-1)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.2)'; }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ background: '#fff', borderRadius: '50%', padding: '2px', flexShrink: 0 }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Acceder con Google
                </button>

                {/* Botón GitHub */}
                <button
                  onClick={() => handleLogin('github')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    padding: '0.8rem 1.5rem',
                    background: '#24292F',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--r-xl)',
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 200ms ease',
                    boxShadow: '0 2px 8px rgba(36,41,47,0.2)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0D1117'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(36,41,47,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#24292F'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(36,41,47,0.2)'; }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  Acceder con GitHub
                </button>
              </div>
            )}

            {status.startsWith('loading_') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
                <div style={{
                  width: '36px', height: '36px',
                  border: '3px solid var(--c-border)',
                  borderTopColor: status === 'loading_github' ? '#24292F' : 'var(--c-brand)',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
                <p style={{ fontSize: '0.8125rem', color: 'var(--c-text-3)', fontWeight: 600 }}>
                  Redirigiendo a {status === 'loading_github' ? 'GitHub' : 'Google'} OAuth…
                </p>
              </div>
            )}

            {status === 'error' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: 'var(--c-brand-light)',
                borderRadius: 'var(--r-lg)',
                color: 'var(--c-brand)',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                {errorMsg || 'Error de autenticación. Intentalo de nuevo.'}
              </div>
            )}
          </div>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            marginTop: '2rem',
            fontSize: '0.6875rem',
            color: 'var(--c-text-4)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Desarrollado por Vegen Digital SL
          </p>
        </div>
      </div>

      {/* Estilos responsive */}
      <style>{`
        @media (min-width: 768px) {
          .login-panel-left { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;