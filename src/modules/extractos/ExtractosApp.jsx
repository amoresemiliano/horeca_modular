import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getExtractosCatalogs, fetchConsolidatedMovements, splitMovementAllocations, fetchTransferCandidates,
  detectTransferCandidates, reviewTransferCandidate, confirmFinanceSuggestions } from '../../lib/extractosService';
import { financeMetrics, economicLabels } from '../../domains/finance/domain/economic';
import ImportModal from './ImportModal';
import FinanceCatalogModal from './FinanceCatalogModal';
import ClassificationModal from './ClassificationModal';
import SplitModal from './SplitModal';
import RuleModal from './RuleModal';
import FinanceDialog from './FinanceDialog';
import ExtractosGraficas, { BankingCards, currencyAmount } from './ExtractosGraficas';

const statusLabels = { PENDING: 'Pendiente', SUGGESTED: 'Sugerida', CONFIRMED: 'Confirmada' };
const emptyCatalogs = { accounts: [], categories: [], subcategories: [], counterparties: [], rules: [] };
export default function ExtractosApp({ tabActiva }) {
  const { organizationId, can } = useAuth();
  const currentOrg = useRef(organizationId), requestSequence = useRef(0);
  currentOrg.current = organizationId;
  const [catalogs, setCatalogs] = useState(emptyCatalogs), [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [importOpen, setImportOpen] = useState(false), [catalogOpen, setCatalogOpen] = useState(false);
  const [classificationMovement, setClassificationMovement] = useState(null), [split, setSplit] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false), [ruleExample, setRuleExample] = useState(null);
  const [query, setQuery] = useState(''), [account, setAccount] = useState(''), [status, setStatus] = useState(''), [currency, setCurrency] = useState('EUR');
  const [selected, setSelected] = useState([]), [confirmOpen, setConfirmOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false), [candidates, setCandidates] = useState([]), [busy, setBusy] = useState(false);
  const editable = can('financial.allocation.edit');
  const loadData = useCallback(async () => {
    if (currentOrg.current !== organizationId) return;
    const request = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      if (!organizationId) { setCatalogs(emptyCatalogs); setMovements([]); return; }
      const [cats, rows] = await Promise.all([getExtractosCatalogs(organizationId), fetchConsolidatedMovements(organizationId)]);
      if (request !== requestSequence.current || currentOrg.current !== organizationId) return;
      setCatalogs(cats); setMovements(rows); setSelected([]);
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
  const visible = movements.filter(m => (m.currency || 'EUR') === currency && (!account || m.source_account_id === account)
    && (!status || m.allocations.some(a => a.classification_status === status))
    && (!query || [m.descripcion, ...m.allocations.flatMap(a => [a.category?.name, a.subcategory?.name, a.counterparty?.name])].filter(Boolean).join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const reviewable = visible.flatMap(m => m.allocations.filter(a => a.classification_status === 'SUGGESTED' && !a.transfer_candidate_id && a.reconciliation_status === 'UNMATCHED'
    && !['UNCLASSIFIED', 'INTERNAL_TRANSFER'].includes(a.economic_type || 'UNCLASSIFIED')).map(a => ({ ...a, movement: m })));
  const reviewed = reviewable.filter(a => selected.includes(a.id));
  const filter = setter => e => { setter(e.target.value); setSelected([]); };
  function rowAction(label, icon, action, disabled = false) {
    return <button type="button" title={label} aria-label={label} disabled={!editable || disabled} onClick={action} className="p-2 rounded hover:bg-emerald-50 focus-visible:outline-emerald-700 disabled:opacity-30">{icon}</button>;
  }
  if (tabActiva === 'Resumen' || tabActiva === 'Gráficas') return <>{error && <p role="alert">{error}</p>}<ExtractosGraficas movements={movements} /></>;
  return <div className="p-4 lg:p-6 space-y-4 text-gray-900">
    <header className="flex flex-wrap justify-between gap-3 items-center"><div><h2 className="text-xl font-bold">Movimientos bancarios</h2><p className="text-sm text-gray-500">El banco registra el flujo; tú confirmas su interpretación.</p></div>
      <div className="flex gap-2 flex-wrap"><button disabled={!organizationId} className="border rounded-lg px-3 py-2" onClick={() => setCatalogOpen(true)}>Cuentas y categorías</button><button disabled={!editable} className="border rounded-lg px-3 py-2" onClick={() => { setRuleExample(null); setRulesOpen(true); }}>Reglas</button><button disabled={!can('STATEMENTS_IMPORT_CONFIRM')} className="bg-emerald-700 text-white rounded-lg px-4 py-2" onClick={() => setImportOpen(true)}>Cargar</button></div>
    </header>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-800 rounded">{error}<button className="ml-3 underline" onClick={loadData}>Recargar</button></p>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
    <BankingCards flow={financeMetrics(visible, currency).banking} currency={currency} />
    <div className="flex gap-3 flex-wrap"><label className="flex-1 min-w-48">Buscar movimientos similares<input className="block border rounded p-2 w-full" placeholder="Descripción, categoría o contraparte" value={query} onChange={filter(setQuery)} /></label>
      <label>Cuenta<select className="block border rounded p-2" value={account} onChange={filter(setAccount)}><option value="">Todas</option>{catalogs.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>Estado<select className="block border rounded p-2" value={status} onChange={filter(setStatus)}><option value="">Todos</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Moneda<select className="block border rounded p-2" value={currency} onChange={filter(setCurrency)}>{[...new Set(['EUR', ...movements.map(m => m.currency || 'EUR')])].map(c => <option key={c}>{c}</option>)}</select></label>
    </div>
    <div className="flex gap-3 text-sm items-center"><button disabled={!editable || busy} className="underline" onClick={() => run(async () => { await refreshCandidates(); setTransfersOpen(true); })}>Revisar posibles transferencias internas</button><span>{visible.length} movimientos</span>{loading && <span role="status">Cargando…</span>}</div>
    {status === 'SUGGESTED' && <section className="border rounded-xl p-4 bg-amber-50 space-y-2"><h3 className="font-semibold">Revisión de sugerencias · selección explícita</h3><p className="text-sm">Las transferencias y las asignaciones sin tipo requieren revisión individual. Selecciona hasta 100 líneas.</p>
      <div className="max-h-52 overflow-y-auto">{reviewable.map(a => <label key={a.id} className="block py-1 text-sm"><input disabled={!editable || busy || (!selected.includes(a.id) && selected.length >= 100)} type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(e.target.checked ? [...selected, a.id] : selected.filter(id => id !== a.id))} /> {a.movement.descripcion} · {currencyAmount(Number(a.monto) * 100, currency)} · {economicLabels[a.economic_type]} · {a.category?.name || 'Sin categoría'} · {a.counterparty?.name || 'Sin contraparte'}</label>)}</div>
      <button disabled={!reviewed.length || !editable || busy} onClick={() => setConfirmOpen(true)} className="border rounded px-3 py-2">Revisar selección ({reviewed.length})</button>
    </section>}
    <div className="border rounded-xl bg-white overflow-x-auto"><table className="w-full table-fixed text-sm"><thead className="bg-gray-50"><tr>{['Fecha', 'Cuenta', 'Descripción', 'Importe', 'Clasificación', 'Contraparte', 'Acciones'].map((label, i) => <th key={label} className={'p-3 text-left ' + (i === 2 || i === 4 ? 'w-[22%]' : i === 6 ? 'w-28' : '')}>{label}</th>)}</tr></thead><tbody>
      {visible.map(m => { const a = m.allocations[0]; const multiple = m.allocations.length > 1; return <tr key={m.id} className="border-t align-top">
        <td className="p-3 text-xs">{m.fecha}</td><td className="p-3 break-words text-xs">{m.source_account?.name}<span className="block text-gray-400">•••• {m.source_account?.masked_identifier}</span></td>
        <td className="p-3 break-words" title={m.descripcion}>{m.descripcion}</td><td className={'p-3 text-right tabular-nums ' + (Number(m.monto) < 0 ? 'text-rose-700' : 'text-emerald-700')}>{currencyAmount(Number(m.monto) * 100, currency)}</td>
        <td className="p-3">{multiple ? <><strong>{m.allocations.length} asignaciones</strong><p className="text-xs">{[...new Set(m.allocations.map(x => statusLabels[x.classification_status]))].join(' · ')}</p></> : <><p>{economicLabels[a?.economic_type || 'UNCLASSIFIED']}</p>{a?.category && <p className="text-xs">{a.category.name}{a.subcategory ? ' / ' + a.subcategory.name : ''}</p>}<span className={'text-xs rounded px-2 py-0.5 inline-block mt-1 ' + (a?.classification_status === 'CONFIRMED' ? 'bg-emerald-50' : 'bg-amber-50')}>{statusLabels[a?.classification_status || 'PENDING']}</span></>}</td>
        <td className="p-3 break-words text-xs">{multiple ? 'Por asignación' : a?.counterparty?.name || '—'}</td>
        <td className="p-1"><div className="flex flex-wrap">{rowAction('Editar clasificación', '✏️', () => setClassificationMovement(m), !a)}{rowAction('Crear regla desde ejemplo confirmado', '⚙️', () => { setRuleExample(m); setRulesOpen(true); }, !m.allocations.some(x => x.classification_status === 'CONFIRMED'))}{rowAction('Dividir en asignaciones', '✂️', () => setSplit(m), m.allocations.some(x => x.transfer_candidate_id || x.reconciliation_status === 'CONFIRMED'))}</div></td>
      </tr>; })}
      {!visible.length && <tr><td colSpan={7} className="p-8 text-center text-gray-500">{loading ? 'Cargando movimientos…' : 'No hay movimientos con estos filtros.'}</td></tr>}
    </tbody></table></div>
    {catalogOpen && <FinanceCatalogModal orgId={organizationId} accounts={catalogs.accounts} categories={catalogs.categories} onClose={() => setCatalogOpen(false)} onSaved={loadData} />}
    {classificationMovement && <ClassificationModal key={classificationMovement.id} movement={classificationMovement} catalogs={catalogs} orgId={organizationId} onClose={() => setClassificationMovement(null)} onSaved={loadData} />}
    <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImportCompleted={handleImportCompleted} />
    <SplitModal isOpen={!!split} movement={split} categories={catalogs.categories} subcategories={catalogs.subcategories} counterparties={catalogs.counterparties} onClose={() => setSplit(null)} onConfirmSplit={handleConfirmSplit} />
    {rulesOpen && <RuleModal catalogs={catalogs} orgId={organizationId} example={ruleExample} onClose={() => setRulesOpen(false)} onSaved={loadData} />}
    {confirmOpen && <FinanceDialog title="Confirmar sugerencias seleccionadas" busy={busy} onClose={() => setConfirmOpen(false)}>{error && <p role="alert" className="text-red-700">{error}</p>}<p>Confirmarás {reviewed.length} asignaciones. Esta acción valida su interpretación económica.</p><ul>{reviewed.map(a => <li key={a.id}>{a.movement.descripcion} · {a.monto} {currency} · {economicLabels[a.economic_type]} · {a.category?.name} · {a.counterparty?.name}</li>)}</ul><button disabled={busy || !reviewed.length} className="bg-emerald-700 text-white rounded p-2" onClick={() => run(async () => { const count = await confirmFinanceSuggestions(organizationId, reviewed); setConfirmOpen(false); await loadData(); setMessage(count + ' sugerencias confirmadas'); })}>Confirmar explícitamente la selección</button></FinanceDialog>}
    {transfersOpen && <FinanceDialog title="Transferencias internas · revisión de pares" busy={busy} onClose={() => setTransfersOpen(false)}>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <p className="text-sm">Se comparan importes opuestos, cuentas propias distintas, misma moneda y hasta tres días de diferencia. Las coincidencias no prueban por sí solas una transferencia. Los splits y clasificaciones confirmadas incompatibles se revisan individualmente.</p>
      <button disabled={busy} className="border rounded p-2" onClick={() => run(async () => { const count = await detectTransferCandidates(organizationId); await refreshCandidates(); setMessage(count + ' nuevos candidatos'); })}>Buscar candidatos</button>
      {candidates.length === 0 && <p>No hay candidatos. Usa «Buscar candidatos» para analizar el historial.</p>}
      {candidates.map(c => <section key={c.id} className="border rounded-xl p-3 space-y-2"><div className="grid sm:grid-cols-2 gap-3">{[c.source_movement_id, c.target_movement_id].map(id => { const m = movements.find(row => row.id === id); return <div key={id} className="bg-gray-50 p-3 rounded">{m ? <><strong>{m.source_account?.name} · {m.monto} {m.currency}</strong><p>{m.fecha} · {m.descripcion}</p></> : <p>Movimiento no disponible; recarga antes de confirmar.</p>}</div>; })}</div>
        <p className="text-xs">{c.status} · {c.evidence.dayDistance} días · referencia coincidente: {c.evidence.referenceMatch ? 'sí' : 'no'} · indicio en descripción: {c.evidence.descriptionHint ? 'sí' : 'no'}</p>
        {c.status === 'SUGGESTED' && <div className="flex gap-3">{[['CONFIRMED', 'Confirmar transferencia entre estas cuentas'], ['REJECTED', 'Rechazar coincidencia']].map(([decision, label]) => <button key={decision} disabled={busy} className="border rounded p-2 text-sm" onClick={() => run(async () => { await reviewTransferCandidate(organizationId, c.id, decision); await refreshCandidates(); await loadData(); })}>{label}</button>)}</div>}
      </section>)}
    </FinanceDialog>}
  </div>;
}
