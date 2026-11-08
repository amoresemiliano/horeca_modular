import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TestAuth } from './auth';
import MainLayout from '../../src/components/MainLayout';
import '../../src/index.css';
import logo from '../../src/assets/vegen-digital.png';
function Harness() {
  const [locked, setLocked] = useState(false);
  const punchOnly = new URLSearchParams(location.search).has('punch-only');
  const user = { email: 'demo@example.invalid', displayName: 'Administración demo', photoURL: logo };
  const organization = { id: 'test-organization', name: 'Grupo de restauración · Demo' };
  const capabilities = punchOnly ? ['personnel.fichajes.write'] : ['personnel.employees.manage', 'personnel.fichajes.write'];
  if (locked) return <h1>Terminal bloqueado · sesión cerrada</h1>;
  return <TestAuth.Provider value={{ user, can: code => capabilities.includes(code), isModuleEnabled: key => key === 'personal', platformCan: () => false, navigationScope: 'organization', setNavigationScope: () => {}, availableOrganizations: [organization], availableOperationalUnits: [], activeOrganization: organization, activeOperationalUnit: null, switchOrganization: () => {}, switchOperationalUnit: () => {}, logout: async () => setLocked(true), updatePassword: async () => {} }}><MainLayout user={user} /></TestAuth.Provider>;
}
createRoot(document.getElementById('root')).render(<Harness />);
