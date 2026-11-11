import { createRoot } from 'react-dom/client';
import { TestAuth } from './auth';
import MainLayout from '../../src/components/MainLayout';
import '../../src/index.css';
import logo from '../../src/assets/vegen-digital.png';
const org={id:'10000000-0000-4000-8000-000000000001',name:'HORECA DEV LAB',timezone:'Europe/Madrid'},unit={id:'20000000-0000-4000-8000-000000000001',name:'Synthetic unit'};
const user={email:'synthetic@example.invalid',displayName:'Synthetic admin',photoURL:logo};
createRoot(document.getElementById('root')).render(<TestAuth.Provider value={{user,activeOrganization:org,availableOrganizations:[org],availableOperationalUnits:[unit],activeOperationalUnit:unit,can:code=>['personnel.employees.manage','personnel.fichajes.audit'].includes(code),isModuleEnabled:key=>key==='personal',platformCan:()=>false,navigationScope:'organization',setNavigationScope:()=>{},switchOrganization:()=>{},switchOperationalUnit:()=>{},logout:async()=>{},updatePassword:async()=>{}}}><MainLayout user={user}/></TestAuth.Provider>);
