import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ExtractosApp from '../../src/modules/extractos/ExtractosApp';
import {FinanceAuth} from './financeAuth';
import '../../src/index.css';
function Harness(){const [tab,setTab]=useState('Consolidado');const grants=['banks.consolidated.view','banks.summary.view','banks.metrics.view','sensitivedata.banking.read'];return <FinanceAuth.Provider value={{organizationId:'synthetic-org',isModuleEnabled:()=>true,can:code=>grants.includes(code)}}><nav aria-label="Navegación sintética">{['Consolidado','Resumen','Gráficas'].map(t=><button key={t} onClick={()=>setTab(t)}>{t==='Gráficas'?'Métricas':t}</button>)}</nav><ExtractosApp tabActiva={tab}/></FinanceAuth.Provider>}
createRoot(document.getElementById('root')).render(<Harness/>);
