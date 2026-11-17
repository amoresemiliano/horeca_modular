import {useMemo,useRef,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {BankStatementImportService} from '../../domains/finance/application/BankStatementImportService';
import {SupabaseFinanceRepository} from '../../domains/finance/infrastructure/repositories/SupabaseFinanceRepository';
import {analyzeBankFiles,annotateBatch,batchBlocker,confirmBankBatch} from '../../domains/finance/application/batchImport';
import {formatEuro} from '../../domains/finance/domain/money';
import FinanceDialog from './FinanceDialog';
const service=new BankStatementImportService(new SupabaseFinanceRepository());
export default function ImportModal({isOpen,onClose,onImportCompleted}){
 const {organizationId,can}=useAuth(),input=useRef(null),sequence=useRef(0);
 const [rawItems,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 const items=useMemo(()=>annotateBatch(rawItems),[rawItems]);
 if(!isOpen)return null;
 const authorized=can('statements.import.upload')&&can('statements.import.process')&&can('STATEMENTS_IMPORT_CONFIRM');
 async function select(files){
  if(busy||!files?.length)return;
  if(!authorized||!organizationId){setError('No tienes permiso para importar en la organización activa.');return;}
  const request=++sequence.current;setBusy(true);setError('');setResult(null);setItems([]);
  try{const rows=await analyzeBankFiles([...files],organizationId,service);if(request===sequence.current)setItems(rows);}catch(e){setError(e.message);}finally{if(request===sequence.current)setBusy(false);}
 }
 async function map(item,accountId){setBusy(true);setError('');setResult(null);
  try{const preview=await service.generateImportPreview(await item.file.arrayBuffer(),item.file.name,organizationId,accountId);setItems(rows=>rows.map(x=>x.id===item.id?{...x,preview,accountId,error:''}:x));}catch(e){setItems(rows=>rows.map(x=>x.id===item.id?{...x,accountId:'',error:e.message}:x));}finally{setBusy(false);}
 }
 async function confirm(){if(!authorized||busy||items.some(batchBlocker))return;setBusy(true);setError('');
  try{const summary=await confirmBankBatch(items,organizationId,service);setResult(summary);onImportCompleted?.(summary);}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 function close(){sequence.current++;setItems([]);setResult(null);setError('');onClose();}
 return <FinanceDialog title="Importar Extracto Bancario" onClose={close} busy={busy}>
  <p className="text-xs text-gray-600">BBVA y Sabadell · cuentas y tarjetas · CSV / XLS / XLSX. Cada archivo conserva su identidad y confirmación independiente.</p>
  <button type="button" disabled={busy||!authorized} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();select(e.dataTransfer.files);}} className="w-full border-2 border-dashed rounded-lg p-4 text-sm">Seleccionar o arrastrar varios extractos</button>
  <input ref={input} aria-label="Archivos bancarios" type="file" accept=".csv,.xls,.xlsx" multiple className="hidden" onChange={e=>{select(e.target.files);e.target.value='';}} />
  {busy&&<p role="status">Procesando el lote…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}
  <div className="space-y-2" aria-label="Vista previa del lote">{items.map(item=>{const p=item.preview;return <section key={item.id} className="border rounded-lg p-3 text-xs space-y-1 min-w-0">
   <div className="flex gap-2 justify-between"><strong className="break-all">{item.file.name}</strong><button disabled={busy} type="button" onClick={()=>{setItems(rows=>rows.filter(x=>x.id!==item.id));setResult(null);}}>Retirar</button></div>
   {p&&<><p>{p.formatFamily} · {p.periodStart||'Periodo no disponible'} — {p.periodEnd||'—'}</p>
   <label className="block">Cuenta de destino<select aria-label={'Cuenta de destino: '+item.file.name} disabled={busy} className="block border rounded p-2 w-full min-w-0" value={item.accountId} onChange={e=>{if(e.target.value)map(item,e.target.value);else setItems(rows=>rows.map(x=>x.id===item.id?{...x,accountId:''}:x));}}><option value="">Selecciona una cuenta compatible</option>{p.compatibleAccounts.map(a=><option key={a.id} value={a.id}>{a.displayName} · {a.maskedIdentifier}</option>)}</select></label>
   <p>{p.totalMovements} movimientos · {p.rejectedRows.length} filas rechazadas · neto {formatEuro(p.netAmount)}</p><p>{p.isExactFileDuplicate?'Archivo ya importado · no creará movimientos':item.duplicateInBatch?'Archivo repetido en este lote · se comprobará al confirmar':'Archivo nuevo'} · {p.movements.filter(m=>m.duplicateStatus==='POTENTIAL_OVERLAP').length+(item.overlapsInBatch||0)} posibles solapamientos</p>
   {!!p.rejectedRows.length&&<details><summary>Ver filas rechazadas</summary>{p.rejectedRows.slice(0,10).map(r=><p key={r.sourceRowNumber}>Fila {r.sourceRowNumber}: {r.reason}</p>)}</details>}</>}
   {!!batchBlocker(item)&&<p role="alert" className="text-red-700">{batchBlocker(item)}</p>}
  </section>;})}</div>
  {result&&<section role="status" className="bg-emerald-50 p-3 rounded text-sm space-y-1"><strong>Resultado del lote</strong><p>{result.processed} archivos procesados · {result.alreadyImported} ya importados · {result.imported} movimientos importados · {result.overlaps} posibles solapamientos · {result.rejected} filas rechazadas · {result.intervention} archivos requieren intervención</p>{result.results.map(r=><p key={r.id} className="break-all">{r.fileName}: {{IMPORTED:'Importado',ALREADY_IMPORTED:'Ya importado',FAILED:'Error',NOT_PROCESSED:'No procesado'}[r.status]}{r.error?' · '+r.error:''}</p>)}{!!result.intervention&&<p>Corrige el problema y reintenta. Los archivos completados no se duplican.</p>}</section>}
  <div className="flex gap-2 justify-end flex-wrap"><button disabled={busy} onClick={close}>Cerrar</button><button disabled={!authorized||busy||!items.length||items.some(batchBlocker)||!!result&&!result.intervention} className="bg-emerald-700 text-white px-3 py-2 rounded disabled:opacity-40" onClick={confirm}>{result?.intervention?'Reintentar lote':`Confirmar Importación (${items.reduce((n,x)=>n+(x.preview?.totalMovements||0),0)})`}</button></div>
 </FinanceDialog>;
}
