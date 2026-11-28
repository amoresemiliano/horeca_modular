import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import MainLayout from '../../../src/components/MainLayout';
import {FixtureAuth} from './auth';
import '../../../src/index.css';
function Fixture(){const [scope,setScope]=useState(new URLSearchParams(location.search).has('platform')?'platform':'organization');const org={id:'synthetic-org',name:'El Criollo',code:'EL_CRIOLLO'},unit={id:'unit',name:'Local principal'};return <FixtureAuth.Provider value={{user:{email:'synthetic@example.invalid',displayName:'Administrador'},activeOrganization:org,organizationId:org.id,activeOperationalUnit:unit,availableOperationalUnits:[unit],availableOrganizations:[org],navigationScope:scope,setNavigationScope:setScope,switchOperationalUnit:()=>{},switchOrganization:()=>{},isModuleEnabled:()=>true,can:()=>true,platformCan:()=>true,logout:async()=>{},updatePassword:async()=>{}}}><MainLayout/></FixtureAuth.Provider>}
createRoot(document.getElementById('root')).render(<Fixture/>);
