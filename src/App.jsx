import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/MainLayout';
import Login from './components/Login';

function AppContent() {
  const { user, loading } = useAuth();

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
            Iniciando plataforma (Supabase Auth)
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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;