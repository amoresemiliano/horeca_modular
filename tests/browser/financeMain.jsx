import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ExtractosApp from '../../src/modules/extractos/ExtractosApp';
import {FinanceAuth} from './financeAuth';
import '../../src/index.css';
function Harness(){const [organizationId,setOrg]=useState('synthetic-org'),[tab,setTab]=useState(new URL(location.href).searchParams.has('summary')?'Resumen':'Consolidado');return <FinanceAuth.Provider value={{organizationId,can:()=>true}}><nav className="p-3 flex gap-3 bg-gray-100" aria-label="Synthetic navigation">{['Consolidado','Resumen','Gráficas'].map(t=><button key={t} onClick={()=>setTab(t)}>{t}</button>)}<button onClick={()=>setOrg(organizationId==='synthetic-org'?'foreign-org':'synthetic-org')}>Cambiar organización sintética</button></nav><ExtractosApp tabActiva={tab}/></FinanceAuth.Provider>}
createRoot(document.getElementById('root')).render(<Harness/>);
