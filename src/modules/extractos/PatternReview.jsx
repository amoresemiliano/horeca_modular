import {useState} from 'react';
import FinanceDialog from './FinanceDialog';
import AllocationFields from './AllocationFields';
import {reviewFinancePattern} from '../../lib/extractosService';
import {interpretationDraft} from './workflow';
import {genericEconomicTypes} from '../../domains/finance/domain/economic';
export default function PatternReview({group,catalogs,orgId,onClose,onSaved}){
 const [value,setValue]=useState(()=>interpretationDraft(group.proposal||{})),[busy,setBusy]=useState(false),[creating,setCreating]=useState(false),[error,setError]=useState('');
 async function confirm(e){e.preventDefault();setBusy(true);setError('');
  try{const count=await reviewFinancePattern(orgId,group.rows.map(m=>m.allocations[0]),value);await onSaved(count);onClose();}catch(e){setError(e.message);await onSaved();}finally{setBusy(false);}
 }
 return <FinanceDialog title="Clasificar grupo" onClose={onClose} busy={busy||creating}>
  <p><strong>{group.merchant}</strong> · {group.rows.length} movimientos · {group.state}</p>
  <p className="text-xs">{group.context}</p>
  {group.conflict?<p className="text-amber-900 bg-amber-50 p-2">El historial contiene clasificaciones diferentes. No hay confirmación automática; revisa el contexto antes de aplicar al grupo.</p>:<p className="text-xs">{group.examples?`Basado en ${group.examples} ejemplos humanos confirmados.`:'Patrón nuevo: define su interpretación.'} El proveedor y los catálogos pertenecen a toda la organización.</p>}
  <ul className="text-xs space-y-1 my-2">{group.rows.slice(0,3).map(m=><li key={m.id} className="break-words">{m.fecha} · {m.descripcion} · {m.monto} {m.currency}</li>)}</ul>
  {!!group.exceptions?.length&&<p className="bg-amber-50 p-2 text-xs">{group.exceptions.length} movimientos tienen solapamientos o una interpretación previa. Esta confirmación manual sustituirá su interpretación. Ejemplo: {group.exceptions[0].descripcion}</p>}
  <p className="text-xs">Se conservarán las descripciones originales. Los patrones reconocidos requieren tu confirmación. Los movimientos se guardan individualmente; un error puede dejar el grupo parcialmente clasificado.</p>
  <form onSubmit={confirm} className="space-y-3"><fieldset disabled={busy||creating}><AllocationFields value={value} onChange={setValue} catalogs={catalogs} orgId={orgId} quickCreate showNotes={false} onBusyChange={setCreating} allowedEconomicTypes={genericEconomicTypes.filter(t=>t!=='CARD_SETTLEMENT')} /></fieldset>
   {error&&<p role="alert" className="text-red-700">{error}</p>}
   <button disabled={busy||creating||!value.economic_type||value.economic_type==='UNCLASSIFIED'} className="bg-emerald-700 text-white rounded p-2">Confirmar grupo ({group.rows.length})</button>
  </form>
 </FinanceDialog>;
}
