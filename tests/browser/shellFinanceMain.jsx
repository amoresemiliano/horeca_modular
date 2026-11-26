import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MainLayout from '../../src/components/MainLayout';
import { FinanceAuth } from './financeAuth';
import '../../src/index.css';
function Harness(){
  const [version,setVersion]=useState(0),[scope,setScope]=useState('organization');
  const org={id:'synthetic-org',name:'Organización sintética'};
  const platform=new URL(location.href).searchParams.has('platform');
  return <FinanceAuth.Provider value={{user:{email:'synthetic@example.invalid'},organizationId:org.id,activeOrganization:org,availableOrganizations:[org],availableOperationalUnits:[],can:code=>['sensitivedata.banking.read','banks.consolidated.view','banks.summary.view','banks.metrics.view','financial.allocation.edit','org.config.write'].includes(code),isModuleEnabled:key=>key==='bancos',platformCan:code=>platform&&code==='platform.tenants.provision',navigationScope:scope,setNavigationScope:setScope,switchOrganization:()=>{},switchOperationalUnit:()=>{},logout:async()=>{},updatePassword:async()=>{}}}>
    <button onClick={()=>setVersion(v=>v+1)} style={{position:'fixed',bottom:0,right:0,zIndex:100}}>Remontar contexto</button><MainLayout key={version}/>
  </FinanceAuth.Provider>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
