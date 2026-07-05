import { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import MainLayout from './components/MainLayout';
import Login from './components/Login';

function App() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        gap: '1.5rem',
        fontFamily: 'var(--font-body)',
      }}>
        {/* Spinner de marca */}
        <div style={{
          width: '48px', height: '48px',
          borderRadius: '50%',
          border: '3px solid rgba(226,35,26,0.2)',
          borderTopColor: '#E2231A',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
            Iniciando plataforma
          </p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            El Criollo · Sistema HORECA
          </p>
        </div>
      </div>
    );
  }

  return user ? <MainLayout user={user} /> : <Login />;
}

export default App;