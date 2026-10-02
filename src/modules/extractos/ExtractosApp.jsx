import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getExtractosCatalogs, fetchConsolidatedMovements, splitMovementAllocations, fetchTransferCandidates,
  detectTransferCandidates, reviewTransferCandidate, confirmFinanceSuggestions } from '../../lib/extractosService';
import { financeMetrics, economicLabels } from '../../domains/finance/domain/economic';
import { paginateMovements, buildConfirmedSimilarityIndex, buildSuggestionGroups, semanticKey } from '../../domains/finance/application/operationalInsights';
import FinancePagination from './FinancePagination';
import TransferReview from './TransferReview';
import ImportModal from './ImportModal';
import FinanceCatalogModal from './FinanceCatalogModal';
import ClassificationModal from './ClassificationModal';
import SplitModal from './SplitModal';
import RuleModal from './RuleModal';
import FinanceDialog from './FinanceDialog';
import ExtractosResumen from './ExtractosResumen';
import FinanceMovementRow from './FinanceMovementRow';
import FinanceFilters from './FinanceFilters';
import { emptyFilters, filterMovements } from './workflow';
import ExtractosGraficas, { currencyAmount } from './ExtractosGraficas';

const emptyCatalogs = { accounts: [], categories: [], subcategories: [], counterparties: [], rules: [] };
export default function ExtractosApp(props) {
  const { organizationId } = useAuth();
  return <FinanceWorkspace key={(organizationId || 'no-organization') + ':' + props.tabActiva} {...props} />;
}
function FinanceWorkspace({ tabActiva }) {
  const { organizationId, can } = useAuth();
  const currentOrg = useRef(organizationId), requestSequence = useRef(0);
  currentOrg.current = organizationId;
  const [catalogs, setCatalogs] = useState(emptyCatalogs), [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [importOpen, setImportOpen] = useState(false), [catalogOpen, setCatalogOpen] = useState(false);
  const [classificationMovement, setClassificationMovement] = useState(null), [split, setSplit] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false), [ruleExample, setRuleExample] = useState(null);
  const [filters, setFilters] = useState(emptyFilters), [reviewFromSummary, setReviewFromSummary] = useState(false);
  const { status, currency } = filters;
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[suggestionGroup,setSuggestionGroup]=useState('');
  const [dismissed,setDismissed]=useState(()=>new Set());
  const [selected, setSelected] = useState([]), [confirmOpen, setConfirmOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false), [candidates, setCandidates] = useState([]), [busy, setBusy] = useState(false);
  const editable = can('financial.allocation.edit');
  const loadData = useCallback(async () => {
    if (currentOrg.current !== organizationId) return;
    const request = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      if (!organizationId) { setCatalogs(emptyCatalogs); setMovements([]); return; }
      const [cats, rows, pairs] = await Promise.all([getExtractosCatalogs(organizationId), fetchConsolidatedMovements(organizationId), fetchTransferCandidates(organizationId)]);
      if (request !== requestSequence.current || currentOrg.current !== organizationId) return;
      setCatalogs(cats); setMovements(rows); setCandidates(pairs); setSelected([]);
    } catch (err) { if (request === requestSequence.current && currentOrg.current === organizationId) { setError(err.message); setMovements([]); } }
    finally { if (request === requestSequence.current && currentOrg.current === organizationId) setLoading(false); }
  }, [organizationId]);
  const invalidateRequests = useCallback(() => { requestSequence.current++; }, []);
  useEffect(() => { loadData(); return invalidateRequests; }, [loadData, invalidateRequests]);
  useEffect(() => {
    setImportOpen(false); setCatalogOpen(false); setClassificationMovement(null); setSplit(null); setRulesOpen(false);
    setTransfersOpen(false); setCandidates([]); setSelected([]); setConfirmOpen(false);
    setMovements([]); setCatalogs(emptyCatalogs); setMessage('');
  }, [organizationId]);
  const handleImportCompleted = (summary) => {
    setMessage(summary.imported + ' movimientos importados');
    loadData();
  };
  async function handleConfirmSplit(movementId, origAmount, allocations) {
    await splitMovementAllocations(movementId, origAmount, allocations, organizationId); await loadData();
  }
  async function run(action) {
    setBusy(true); setError('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function refreshCandidates() { setCandidates(await fetchTransferCandidates(organizationId)); }
  const similarityIndex = useMemo(()=>buildConfirmedSimilarityIndex(movements,organizationId),[movements,organizationId]);
  const assistance = useMemo(()=>buildSuggestionGroups(movements,similarityIndex,organizationId,dismissed),[movements,similarityIndex,organizationId,dismissed]);
  const filtered = useMemo(()=>filterMovements(movements,filters),[movements,filters]);
  const visible = useMemo(()=>!suggestionGroup?filtered:filtered.filter(m=>assistance.suggestions.get(m.id)?.groupKey===suggestionGroup || m.allocations.some(a=>a.classification_status==='SUGGESTED'&&semanticKey(a)===suggestionGroup)),[filtered,suggestionGroup,assistance]);
  const pagination = useMemo(()=>paginateMovements(visible,page,pageSize),[visible,page,pageSize]);
  const banking = useMemo(()=>financeMetrics(visible,currency).banking,[visible,currency]);
  const movementMap = useMemo(()=>new Map(movements.map(m=>[m.id,m])),[movements]);
  const attention = useMemo(()=>({pending:movements.filter(m=>m.currency===currency&&m.allocations.some(a=>a.classification_status==='PENDING')).length,suggested:movements.filter(m=>m.currency===currency&&m.allocations.some(a=>a.classification_status==='SUGGESTED')).length,transfers:candidates.filter(c=>c.status==='SUGGESTED').length}),[movements,candidates,currency]);
  const reviewable = useMemo(()=>visible.flatMap(m => m.allocations.filter(a => a.classification_status === 'SUGGESTED' && !a.transfer_candidate_id && a.reconciliation_status === 'UNMATCHED'
    && !['UNCLASSIFIED', 'INTERNAL_TRANSFER'].includes(a.economic_type || 'UNCLASSIFIED')).map(a => ({ ...a, movement: m }))),[visible]);
  const pageReviewable = useMemo(()=>{const ids=new Set(pagination.rows.map(m=>m.id));return reviewable.filter(a=>ids.has(a.movement.id));},[pagination,reviewable]);
  const reviewed = useMemo(()=>{const ids=new Set(selected);return reviewable.filter(a=>ids.has(a.id));},[reviewable,selected]);
  function changeFilters(next) { setFilters(next); setPage(1); setSuggestionGroup(''); setSelected([]); setConfirmOpen(false); }
  if (tabActiva === 'Gráficas' || tabActiva === 'Métricas') return <>{error && <p role="alert">{error}</p>}<ExtractosGraficas movements={movements} /></>;
  if (tabActiva === 'Resumen' && !reviewFromSummary) return <>{error && <p role="alert">{error}</p>}{loading && <p role="status">Cargando…</p>}<ExtractosResumen movements={movements} onReview={nextCurrency => { changeFilters({ ...emptyFilters(), currency: nextCurrency }); setReviewFromSummary(true); }} /></>;
  return <div className="p-3 space-y-2 text-sm text-gray-900">
    {tabActiva === 'Resumen' && <button className="text-sm text-emerald-800 underline" onClick={() => setReviewFromSummary(false)}>Volver al resumen</button>}
    <header className="flex flex-wrap justify-between gap-3 items-center"><div><h2 className="text-base font-semibold">Movimientos bancarios</h2></div>
      <div className="flex gap-2 flex-wrap"><button disabled={!organizationId} className="border border-gray-200 rounded-lg px-3 py-1.5" onClick={() => setCatalogOpen(true)}>Cuentas y categorías</button><button disabled={!editable} className="border border-gray-200 rounded-lg px-3 py-1.5" onClick={() => { setRuleExample(null); setRulesOpen(true); }}>Reglas</button><button disabled={!can('STATEMENTS_IMPORT_CONFIRM')} className="bg-emerald-700 text-white rounded-lg px-3 py-1.5" onClick={() => setImportOpen(true)}>Cargar</button></div>
    </header>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-800 rounded">{error}<button className="ml-3 underline" onClick={loadData}>Recargar</button></p>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    <FinanceFilters value={filters} onChange={changeFilters} catalogs={catalogs} movements={movements} />
    <div aria-label="Atención y revisión" className="flex gap-2 flex-wrap items-center text-xs"><button aria-pressed={status === 'PENDING'} className="bg-amber-50 text-amber-900 rounded px-2 py-1.5" onClick={() => changeFilters({ ...emptyFilters(), currency, status: 'PENDING' })}>Pendientes ({attention.pending})</button><button aria-pressed={status === 'SUGGESTED'} className="bg-amber-50 text-amber-900 rounded px-2 py-1.5" onClick={() => changeFilters({ ...emptyFilters(), currency, status: 'SUGGESTED' })}>Sugeridas · revisar ({attention.suggested})</button><button disabled={!editable || busy} title={!editable?'Tu rol no permite revisar transferencias':'Revisión dedicada de pares'} className="bg-emerald-50 text-emerald-800 rounded px-2 py-1.5 disabled:opacity-40" onClick={()=>run(async()=>{await refreshCandidates();setTransfersOpen(true);})}>Transferencias posibles ({attention.transfers})</button><button className="text-gray-600 underline" onClick={() => changeFilters({ ...emptyFilters(), currency })}>Ver todas / limpiar</button>{loading&&<span role="status">Cargando…</span>}</div>
    {editable && assistance.groups.size>0 && <details className="text-xs bg-amber-50 rounded-lg px-3 py-2"><summary className="cursor-pointer">Propuestas por historial ({assistance.suggestions.size}) · pendientes de revisión</summary><p className="py-1">No se guardan automáticamente. Revisa cada propuesta o crea una regla para sugerir el grupo en una operación.</p>{[...assistance.groups.values()].slice(0,10).map(g=><div key={g.groupKey} className="flex gap-3 py-1 items-center flex-wrap"><span>{g.merchant} · {g.ids.size} pendientes · {g.explanation}</span><button className="underline" onClick={()=>{changeFilters({...emptyFilters(),currency});setSuggestionGroup(g.groupKey);}}>Revisar grupo</button><button className="underline" onClick={()=>{setRuleExample(g.example);setRulesOpen(true);}}>Crear regla para este grupo</button></div>)}</details>}
    {suggestionGroup&&<p className="text-xs text-amber-900">Grupo de interpretación similar · {visible.length} movimientos. Las sugerencias guardadas se confirman con selección explícita.</p>}
    {(status === 'SUGGESTED' || suggestionGroup) && <section className="border border-gray-200 rounded-xl p-4 bg-amber-50 space-y-2"><h3 className="font-semibold">Revisión de sugerencias · selección explícita</h3><p className="text-sm">Las transferencias y las asignaciones sin tipo requieren revisión individual. Selecciona hasta 100 líneas.</p>
      <div className="max-h-52 overflow-y-auto">{pageReviewable.map(a => <label key={a.id} className="block py-1 text-sm"><input disabled={!editable || busy || (!selected.includes(a.id) && selected.length >= 100)} type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(e.target.checked ? [...selected, a.id] : selected.filter(id => id !== a.id))} /> {a.movement.descripcion} · {currencyAmount(Number(a.monto) * 100, currency)} · {economicLabels[a.economic_type]} · {a.category?.name || 'Sin categoría'} · {a.counterparty?.name || 'Sin proveedor / contraparte'}</label>)}</div>
      <button disabled={!reviewed.length || !editable || busy} onClick={() => setConfirmOpen(true)} className="border border-gray-200 rounded px-3 py-1.5">Revisar selección ({reviewed.length})</button>
    </section>}
    <div className="border border-gray-200 rounded-xl bg-white overflow-x-auto"><table className="w-full table-fixed text-sm min-w-[780px]"><thead className="bg-gray-50"><tr>{['Fecha', 'Descripción', 'Importe', 'Clasificación', 'Proveedor', 'Acciones'].map((label, i) => <th key={label} className={'px-2 py-2 text-left ' + (i === 0 ? 'w-24' : i === 1 ? 'w-[29%]' : i === 2 ? 'w-28' : i === 5 ? 'w-[108px]' : '')}>{label}</th>)}</tr></thead><tbody>
      {pagination.rows.map(m => <FinanceMovementRow key={m.id + ':' + m.allocations.map(a => a.updated_at).join(':')} movement={m} suggestion={assistance.suggestions.get(m.id)} editable={editable} onEdit={setClassificationMovement} onRule={movement => { setRuleExample(movement); setRulesOpen(true); }} onSplit={setSplit} />)}
      {!visible.length && <tr><td colSpan={6} className="p-8 text-center text-gray-500">{loading ? 'Cargando movimientos…' : 'No hay movimientos con estos filtros.'}</td></tr>}
    </tbody></table></div>
    <FinancePagination pagination={pagination} onPage={setPage} onSize={size=>{setPageSize(size);setPage(1);setSelected([]);}} />
    <p data-testid="filtered-banking-summary" className="text-xs text-gray-500">Flujo bancario de esta selección: {banking.count} movimientos · entradas {currencyAmount(banking.inflows,currency)} · salidas {currencyAmount(banking.outflows,currency)} · neto {currencyAmount(banking.net,currency)}</p>
    {catalogOpen && <FinanceCatalogModal orgId={organizationId} catalogs={catalogs} canAccounts={can('STATEMENTS_IMPORT_CONFIRM')} canClassify={editable} onClose={() => setCatalogOpen(false)} onSaved={loadData} />}
    {classificationMovement && <ClassificationModal key={classificationMovement.id} movement={classificationMovement} suggestion={assistance.suggestions.get(classificationMovement.id)} onDismissSuggestion={id=>setDismissed(prev=>new Set([...prev,id]))} catalogs={catalogs} orgId={organizationId} onClose={() => setClassificationMovement(null)} onSaved={loadData} />}
    <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImportCompleted={handleImportCompleted} />
    <SplitModal isOpen={!!split} movement={split} categories={catalogs.categories} subcategories={catalogs.subcategories} counterparties={catalogs.counterparties} onClose={() => setSplit(null)} onConfirmSplit={handleConfirmSplit} />
    {rulesOpen && <RuleModal movements={movements} catalogs={catalogs} orgId={organizationId} example={ruleExample} onClose={() => setRulesOpen(false)} onSaved={loadData} />}
    {confirmOpen && <FinanceDialog title="Confirmar sugerencias seleccionadas" busy={busy} onClose={() => setConfirmOpen(false)}>{error && <p role="alert" className="text-red-700">{error}</p>}<p>Confirmarás {reviewed.length} asignaciones. Esta acción valida su interpretación económica.</p><ul>{reviewed.map(a => <li key={a.id}>{a.movement.descripcion} · {a.monto} {currency} · {economicLabels[a.economic_type]} · {a.category?.name} · {a.counterparty?.name}</li>)}</ul><button disabled={busy || !reviewed.length} className="bg-emerald-700 text-white rounded p-2" onClick={() => run(async () => { const count = await confirmFinanceSuggestions(organizationId, reviewed); setConfirmOpen(false); await loadData(); setMessage(count + ' sugerencias confirmadas'); })}>Confirmar explícitamente la selección</button></FinanceDialog>}
    {transfersOpen && <TransferReview candidates={candidates} movementMap={movementMap} busy={busy} error={error} onClose={()=>setTransfersOpen(false)} onDetect={()=>run(async()=>{const count=await detectTransferCandidates(organizationId);await refreshCandidates();setMessage(count+' nuevos candidatos');})} onReview={(id,decision)=>run(async()=>{await reviewTransferCandidate(organizationId,id,decision);await loadData();})} />}
  </div>;
}
