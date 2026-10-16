import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '../../../src/context/AuthContext';
import Login from '../../../src/components/Login';
import '../../../src/index.css';

// Real AuthProvider and Login; the browser runner intercepts network boundaries.
// This entry is never imported by the production application.
function AccessFixture() {
  const { user, loading, isPasswordRecovery, logout, can, organizationId } = useAuth();
  if (loading) return <p role="status">Restoring session</p>;
  if (user && !isPasswordRecovery) return <main><h1>Authenticated test session</h1><p>{organizationId || 'No tenant context'}</p><p>{can('production.batch.log') ? 'Tenant access allowed' : 'Tenant access denied'}</p><button onClick={logout}>Sign out test session</button></main>;
  return <Login />;
}

createRoot(document.getElementById('root')).render(<AuthProvider><AccessFixture /></AuthProvider>);
