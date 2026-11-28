import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TestAuth } from './auth';
import ProductionPersonnelApp from '../../src/modules/personnel-live/ProductionPersonnelApp';
const org={id:'10000000-0000-4000-8000-000000000001',name:'Tenant sintético',timezone:'Europe/Madrid'}, unit={id:'20000000-0000-4000-8000-000000000001',name:'Unidad sintética'};
function Fixture() {
 const [tab,setTab]=useState('Horarios'); const readOnly=new URLSearchParams(location.search).has('readonly');
 const caps=['personnel.employees.view','personnel.attendance.view','personnel.schedules.view',...(readOnly?[]:['personnel.schedules.manage'])];
 return <TestAuth.Provider value={{activeOrganization:org,activeOperationalUnit:unit,availableOperationalUnits:[unit],switchOperationalUnit:()=>{},can:code=>caps.includes(code)}}><nav aria-label="Navegación contextual">{['Horarios','Empleados','Asistencia'].map(name=><button key={name} onClick={()=>setTab(name)}>{name}</button>)}</nav><ProductionPersonnelApp tabActiva={tab}/></TestAuth.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
