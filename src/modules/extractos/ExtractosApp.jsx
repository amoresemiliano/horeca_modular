import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { banksSectionAllowed } from '../../application/tenancy/accessNavigation';
import { useAuth } from '../../context/AuthContext';
import { getExtractosCatalogs, fetchConsolidatedMovements, fetchConsolidatedPage, fetchTransferMovementContext, splitMovementAllocations, fetchTransferCandidates,
  detectTransferCandidates, reviewTransferCandidate, confirmFinanceSuggestions } from '../../lib/extractosService';
import { financeMetrics, economicLabels } from '../../domains/finance/domain/economic';
import { buildConfirmedSimilarityIndex, buildSuggestionGroups } from '../../domains/finance/application/operationalInsights';
import FinancePagination from './FinancePagination';
import PatternWorkspace from './PatternWorkspace';
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
function restoredTableState() {
  const params = new URLSearchParams(window.location.search);
  const size = Number(params.get('pageSize'));
  const page = Number(params.get('page'));
  const status = params.get('status');
  const month = params.get('month');
  return { page: Number.isSafeInteger(page) && page > 0 ? page : 1, pageSize: [25,50,100].includes(size) ? size : 25,
    filters: { ...emptyFilters(), account: params.get('account') || '', month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') ? month : '', status: ['PENDING','SUGGESTED','CONFIRMED'].includes(status) ? status : '' } };
}
export default function ExtractosApp(props) {
  const { organizationId, can, isModuleEnabled } = useAuth();
  if (!organizationId || !isModuleEnabled('bancos') || !banksSectionAllowed(props.tabActiva, can)) return <p role="alert">Sección de Bancos no autorizada.</p>;
  return <FinanceWorkspace key={(organizationId || 'no-organization') + ':' + props.tabActiva} {...props} />;
}
function FinanceWorkspace({ tabActiva }) {
  const { organizationId, can } = useAuth();
  const currentOrg = useRef(organizationId), requestSequence = useRef(0), catalogCache = useRef(null);
  currentOrg.current = organizationId;
  const [catalogs, setCatalogs] = useState(emptyCatalogs), [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [importOpen, setImportOpen] = useState(false), [catalogOpen, setCatalogOpen] = useState(false);
  const [classificationMovement, setClassificationMovement] = useState(null), [split, setSplit] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false), [ruleExample, setRuleExample] = useState(null);
  const [initialTable] = useState(restoredTableState);
  const [filters, setFilters] = useState(() => tabActiva === 'Consolidado' ? initialTable.filters : emptyFilters()), [reviewFromSummary, setReviewFromSummary] = useState(false);
  const { status, currency } = filters;
  const [page,setPage]=useState(() => tabActiva === 'Consolidado' ? initialTable.page : 1),[pageSize,setPageSize]=useState(() => tabActiva === 'Consolidado' ? initialTable.pageSize : 25);
  const [total,setTotal]=useState(0),[history,setHistory]=useState(null),[transferMovements,setTransferMovements]=useState([]),[settlementReview,setSettlementReview]=useState(false);
  const assistedWorkspace = useRef(null);
  const [dismissed,setDismissed]=useState(()=>new Set());
  const [selected, setSelected] = useState([]), [confirmOpen, setConfirmOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false), [candidates, setCandidates] = useState([]), [candidatesLoaded, setCandidatesLoaded] = useState(false), [busy, setBusy] = useState(false);
  const editable = can('financial.allocation.edit');
  const manageRules = can('banks.rules.manage'), manageAccounts = can('banks.accounts.manage'), manageCategories = can('banks.categories.manage'), manageParties = can('banks.counterparties.manage'), reviewTransfers = can('banks.transfers.review');
  const importing = can('statements.import.upload') && can('statements.import.process') && can('STATEMENTS_IMPORT_CONFIRM');
  const pageMode = tabActiva === 'Consolidado' || reviewFromSummary;
  const loadData = useCallback(async () => {
    if (currentOrg.current !== organizationId) return;
    const request = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      if (!organizationId) { setCatalogs(emptyCatalogs); setMovements([]); return; }
      const [cats, result, pairs] = await Promise.all([catalogCache.current ? Promise.resolve(catalogCache.current) : getExtractosCatalogs(organizationId), pageMode ? fetchConsolidatedPage(organizationId, {page,pageSize,filters}) : fetchConsolidatedMovements(organizationId, tabActiva === 'Resumen' ? 'summary' : 'metrics'), !pageMode && tabActiva === 'Resumen' && reviewTransfers ? fetchTransferCandidates(organizationId) : Promise.resolve(null)]);
      if (request !== requestSequence.current || currentOrg.current !== organizationId) return;
      const lastPage = pageMode ? Math.max(1,Math.ceil(result.total/pageSize)) : 1;
      if (pageMode && page > lastPage) { setPage(lastPage); return; }
      catalogCache.current = cats; setCatalogs(cats); setMovements(pageMode ? result.rows : result); setTotal(pageMode ? result.total : 0); if (pairs) { setCandidates(pairs); setCandidatesLoaded(true); } setSelected([]);
    } catch (err) { if (request === requestSequence.current && currentOrg.current === organizationId) { setError(err.message); setMovements([]); setTotal(0); } }
    finally { if (request === requestSequence.current && currentOrg.current === organizationId) setLoading(false); }
  }, [organizationId, tabActiva, reviewTransfers, pageMode, page, pageSize, filters]);
  const invalidateRequests = useCallback(() => { requestSequence.current++; }, []);
  const refreshCatalogs = async () => { catalogCache.current = null; await loadData(); };
  useEffect(() => { loadData(); return invalidateRequests; }, [loadData, invalidateRequests]);
  useEffect(() => { if (settlementReview && history) assistedWorkspace.current?.scrollIntoView({block:'start'}); }, [settlementReview,history]);
  useEffect(() => {
    if (tabActiva !== 'Consolidado') return;
    const url = new URL(window.location.href);
    for (const [key,value] of Object.entries({ page, pageSize, account: filters.account, month: filters.month, status: filters.status })) {
      if (value) url.searchParams.set(key, String(value)); else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, '', url);
  }, [tabActiva,page,pageSize,filters.account,filters.month,filters.status]);
  useEffect(() => {
    setImportOpen(false); setCatalogOpen(false); setClassificationMovement(null); setSplit(null); setRulesOpen(false);
    setTransfersOpen(false); setCandidates([]); setCandidatesLoaded(false); setSelected([]); setConfirmOpen(false);
    catalogCache.current = null; setMovements([]); setCatalogs(emptyCatalogs); setMessage(''); setHistory(null); setTransferMovements([]); setSettlementReview(false);
  }, [organizationId]);
  const handleImportCompleted = async (summary) => {
    let text=summary.imported+' movimientos importados';
    setMessage(text);await loadData();
  };
  async function handleConfirmSplit(movementId, origAmount, allocations) {
    await splitMovementAllocations(movementId, origAmount, allocations, organizationId); await loadData();
  }
  async function run(action) {
    setBusy(true); setError('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function refreshCandidates() { const pairs=await fetchTransferCandidates(organizationId); setTransferMovements(await fetchTransferMovementContext(organizationId,pairs)); setCandidates(pairs); setCandidatesLoaded(true); }
  const assistanceRows = useMemo(()=>history ? [...new Map([...history,...movements].map(m=>[m.id,m])).values()] : movements,[history,movements]);
  const similarityIndex = useMemo(()=>buildConfirmedSimilarityIndex(assistanceRows,organizationId),[assistanceRows,organizationId]);
  const assistance = useMemo(()=>buildSuggestionGroups(assistanceRows,similarityIndex,organizationId,dismissed),[assistanceRows,similarityIndex,organizationId,dismissed]);
  const filtered = useMemo(()=>pageMode ? movements : filterMovements(movements,filters),[movements,filters,pageMode]);
  const visible = filtered;
  const pagination = useMemo(()=>({ rows:visible, page, pageSize, total, totalPages:Math.max(1,Math.ceil(total/pageSize)) }),[visible,page,pageSize,total]);
  const banking = useMemo(()=>financeMetrics(visible,currency).banking,[visible,currency]);
  const movementMap = useMemo(()=>new Map([...transferMovements,...movements].map(m=>[m.id,m])),[movements,transferMovements]);
  const attention = useMemo(()=>({pending:movements.filter(m=>m.currency===currency&&m.allocations.some(a=>a.classification_status==='PENDING')).length,suggested:movements.filter(m=>m.currency===currency&&m.allocations.some(a=>a.classification_status==='SUGGESTED')).length,transfers:candidates.filter(c=>c.status==='SUGGESTED').length}),[movements,candidates,currency]);
  const reviewable = useMemo(()=>visible.flatMap(m => m.allocations.filter(a => a.classification_status === 'SUGGESTED' && !a.transfer_candidate_id && a.reconciliation_status === 'UNMATCHED'
    && !['UNCLASSIFIED', 'INTERNAL_TRANSFER'].includes(a.economic_type || 'UNCLASSIFIED')).map(a => ({ ...a, movement: m }))),[visible]);
  const pageReviewable = useMemo(()=>{const ids=new Set(pagination.rows.map(m=>m.id));return reviewable.filter(a=>ids.has(a.movement.id));},[pagination,reviewable]);
  const reviewed = useMemo(()=>{const ids=new Set(selected);return reviewable.filter(a=>ids.has(a.id));},[reviewable,selected]);
  function changeFilters(next) { setFilters(next); setPage(1); setSelected([]); setConfirmOpen(false); }
  if (tabActiva === 'Gráficas' || tabActiva === 'Métricas') return <div className="shell-finance">{error && <p role="alert">{error}</p>}{loading ? <div className="finance-loading" role="status">Cargando métricas…</div> : <ExtractosGraficas movements={movements} />}</div>;
  if (tabActiva === 'Resumen' && !reviewFromSummary) return <div className="shell-finance">{error && <p role="alert">{error}</p>}{loading ? <div className="finance-loading" role="status">Cargando resumen…</div> : <ExtractosResumen movements={movements} organizationId={organizationId} candidates={candidates} canTransfer={reviewTransfers} canClassify={editable} canReviewSettlements={editable && can('financial.reconciliation.confirm')} onReview={can('banks.consolidated.view') ? (nextCurrency,nextStatus='',mode='',query='',settlementPairs=[]) => { setMovements([]); setTotal(0); changeFilters({ ...emptyFilters(), currency: nextCurrency, status:nextStatus, query }); setReviewFromSummary(true); setSettlementReview(mode==='settlements'); if(mode==='assisted'||mode==='settlements')run(async()=>{const result=await fetchConsolidatedPage(organizationId,{page:1,pageSize:100,filters:{currency:nextCurrency}});setHistory([...new Map([...settlementPairs.flatMap(p=>[p.bank,p.card]),...result.rows].map(m=>[m.id,m])).values()]);}); if(mode==='transfers')run(async()=>{await refreshCandidates();setTransfersOpen(true);}); } : undefined} />}</div>;
  return <div className="shell-finance p-3 space-y-2 text-sm text-gray-900">
    {tabActiva === 'Resumen' && <button className="text-sm text-emerald-800 underline" onClick={() => setReviewFromSummary(false)}>Volver al resumen</button>}
    <header className="flex flex-wrap justify-between gap-3 items-center"><div><h2 className="text-base font-semibold">Movimientos bancarios</h2></div>
      <div className="flex gap-2 flex-wrap">{(manageAccounts || manageCategories || manageParties) && <button disabled={!organizationId} className="border border-gray-200 rounded-lg px-3 py-1.5" onClick={() => setCatalogOpen(true)}>Cuentas y categorías</button>}{manageRules && <details><summary className="cursor-pointer px-2 py-1.5">Avanzado</summary><button disabled={!manageRules} className="border border-gray-200 rounded-lg px-3 py-1.5" onClick={() => { setRuleExample(null); setRulesOpen(true); }}>Reglas</button></details>}{importing && <button disabled={!importing} className="bg-emerald-700 text-white rounded-lg px-3 py-1.5" onClick={() => setImportOpen(true)}>Cargar extracto</button>}</div>
    </header>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-800 rounded">{error}<button className="ml-3 underline" onClick={loadData}>Recargar</button></p>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    <FinanceFilters value={filters} onChange={changeFilters} catalogs={catalogs} movements={movements} />
    <div aria-label="Por revisar" className="flex gap-2 flex-wrap items-center text-xs"><strong>Por revisar · esta página</strong><button aria-pressed={status === 'PENDING'} className="bg-amber-50 text-amber-900 rounded px-2 py-1.5" onClick={() => changeFilters({ ...emptyFilters(), currency, status: 'PENDING' })}>Pendientes ({attention.pending})</button><button aria-pressed={status === 'SUGGESTED'} className="bg-amber-50 text-amber-900 rounded px-2 py-1.5" onClick={() => changeFilters({ ...emptyFilters(), currency, status: 'SUGGESTED' })}>Sugerencias ({attention.suggested})</button>{reviewTransfers && <button disabled={busy} className="bg-emerald-50 text-emerald-800 rounded px-2 py-1.5 disabled:opacity-40" onClick={()=>run(async()=>{await refreshCandidates();setTransfersOpen(true);})}>Transferencias{candidatesLoaded ? ` (${attention.transfers})` : ''}</button>}<button className="text-gray-600 underline" onClick={() => changeFilters({ ...emptyFilters(), currency })}>Ver todas / limpiar</button>{loading&&<span role="status">Cargando…</span>}</div>
    <div className="border border-gray-200 rounded-xl bg-white overflow-x-auto"><table className="w-full table-fixed text-sm min-w-[880px]"><thead className="bg-gray-50"><tr>{['Fecha', 'Concepto', 'Detalle', 'Importe', 'Clasificación', 'Proveedor', 'Acciones'].map((label, i) => <th key={label} className={'px-2 py-2 text-left ' + (i === 0 ? 'w-24' : i === 3 ? 'w-28' : i === 6 ? 'w-[108px]' : '')}>{label}</th>)}</tr></thead><tbody>
      {pagination.rows.map(m => <FinanceMovementRow key={m.id + ':' + m.allocations.map(a => a.updated_at).join(':')} movement={m} suggestion={assistance.suggestions.get(m.id)} catalogs={catalogs} editable={editable} canRules={false} hideDenied onEdit={setClassificationMovement} onRule={movement => { setRuleExample(movement); setRulesOpen(true); }} onSplit={setSplit} />)}
      {!visible.length && (loading ? Array.from({length:5},(_,index)=><tr key={index} aria-hidden="true"><td colSpan={7} className="px-3 py-2"><div className="finance-skeleton-row" /></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-gray-500">No hay movimientos con estos filtros.</td></tr>)}
    </tbody></table></div>
    <FinancePagination pagination={pagination} onPage={setPage} onSize={size=>{setPageSize(size);setPage(1);setSelected([]);}} />
    <p data-testid="filtered-banking-summary" className="text-xs text-gray-500">Flujo bancario de esta página: {banking.count} movimientos · entradas {currencyAmount(banking.inflows,currency)} · salidas {currencyAmount(banking.outflows,currency)} · neto {currencyAmount(banking.net,currency)}</p>
    {editable && <section className="border-t pt-3 space-y-2"><h3 className="font-semibold">Clasificación asistida</h3><p className="text-xs text-gray-600">Revisa operaciones similares y aplica una clasificación de forma conjunta.</p>
    {editable && !history && <button disabled={busy} className="text-emerald-800 underline text-xs" onClick={()=>run(async()=>{const result=await fetchConsolidatedPage(organizationId,{page:1,pageSize:100,filters:{currency}});setHistory(result.rows);})}>Abrir clasificación asistida</button>}
    {editable && history && <div ref={assistedWorkspace}><p className="text-xs text-gray-600">La clasificación asistida utiliza hasta 100 movimientos recientes y los de la página actual.{settlementReview?' Incluye los pares solicitados desde el resumen.':''}</p><PatternWorkspace movements={assistanceRows.filter(m=>(m.currency||'EUR')===currency)} catalogs={catalogs} orgId={organizationId} canReconcile={can('financial.reconciliation.confirm')} onSaved={async text=>{setHistory(null);await loadData();if(text)setMessage(text);}} /></div>}
    {editable && status === 'SUGGESTED' && <section className="border border-gray-200 rounded-xl p-4 bg-amber-50 space-y-2"><h3 className="font-semibold">Revisión de sugerencias · selección explícita</h3><p className="text-sm">Las transferencias y las asignaciones sin tipo requieren revisión individual. Selecciona hasta 100 líneas.</p>
      <div className="max-h-52 overflow-y-auto">{pageReviewable.map(a => <label key={a.id} className="block py-1 text-sm"><input disabled={!editable || busy || (!selected.includes(a.id) && selected.length >= 100)} type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(e.target.checked ? [...selected, a.id] : selected.filter(id => id !== a.id))} /> {a.movement.descripcion} · {currencyAmount(Number(a.monto) * 100, currency)} · {economicLabels[a.economic_type]} · {a.category?.name || 'Sin categoría'} · {a.counterparty?.name || 'Sin proveedor / contraparte'}</label>)}</div>
      <button disabled={!reviewed.length || !editable || busy} onClick={() => setConfirmOpen(true)} className="border border-gray-200 rounded px-3 py-1.5">Revisar selección ({reviewed.length})</button>
    </section>}
    </section>}
    {catalogOpen && <FinanceCatalogModal orgId={organizationId} catalogs={catalogs} canAccounts={manageAccounts} canClassify={manageCategories} canCounterparties={manageParties} onClose={() => setCatalogOpen(false)} onSaved={refreshCatalogs} />}
    {classificationMovement && <ClassificationModal key={classificationMovement.id} movement={classificationMovement} suggestion={assistance.suggestions.get(classificationMovement.id)} onDismissSuggestion={id=>setDismissed(prev=>new Set([...prev,id]))} catalogs={catalogs} orgId={organizationId} onClose={() => setClassificationMovement(null)} onSaved={refreshCatalogs} />}
    <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImportCompleted={handleImportCompleted} />
    <SplitModal isOpen={!!split} movement={split} categories={catalogs.categories} subcategories={catalogs.subcategories} counterparties={catalogs.counterparties} onClose={() => setSplit(null)} onConfirmSplit={handleConfirmSplit} />
    {rulesOpen && <RuleModal movements={movements} catalogs={catalogs} orgId={organizationId} example={ruleExample} onClose={() => setRulesOpen(false)} onSaved={refreshCatalogs} />}
    {confirmOpen && <FinanceDialog title="Confirmar sugerencias seleccionadas" busy={busy} onClose={() => setConfirmOpen(false)}>{error && <p role="alert" className="text-red-700">{error}</p>}<p>Confirmarás {reviewed.length} asignaciones. Esta acción valida su interpretación económica.</p><ul>{reviewed.map(a => <li key={a.id}>{a.movement.descripcion} · {a.monto} {currency} · {economicLabels[a.economic_type]} · {a.category?.name} · {a.counterparty?.name}</li>)}</ul><button disabled={busy || !reviewed.length} className="bg-emerald-700 text-white rounded p-2" onClick={() => run(async () => { const count = await confirmFinanceSuggestions(organizationId, reviewed); setConfirmOpen(false); await loadData(); setMessage(count + ' sugerencias confirmadas'); })}>Confirmar explícitamente la selección</button></FinanceDialog>}
    {transfersOpen && <TransferReview candidates={candidates} movementMap={movementMap} busy={busy} error={error} onClose={()=>setTransfersOpen(false)} onDetect={()=>run(async()=>{const count=await detectTransferCandidates(organizationId);await refreshCandidates();setMessage(count+' nuevos candidatos');})} onReview={(id,decision)=>run(async()=>{await reviewTransferCandidate(organizationId,id,decision);await refreshCandidates();await loadData();})} />}
  </div>;
}
