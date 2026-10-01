import { useState } from 'react';
import { createClassificationRule, updateClassificationRule, applyClassificationRules, getExtractosCatalogs } from '../../lib/extractosService';
import { economicLabels } from '../../domains/finance/domain/economic';
import FinanceDialog from './FinanceDialog';
import AllocationFields from './AllocationFields';
import { emptyInterpretation, ruleExample } from './workflow';

export default function RuleModal({ catalogs, orgId, example, onClose, onSaved }) {
  const confirmed = ruleExample(example);
  const [rules, setRules] = useState(catalogs.rules), [editing, setEditing] = useState(null);
  const [pattern, setPattern] = useState(example?.descripcion || ''), [account, setAccount] = useState(example?.source_account_id || '');
  const [sign, setSign] = useState(example ? (Number(example.monto) < 0 ? 'NEGATIVE' : Number(example.monto) > 0 ? 'POSITIVE' : 'ALL') : 'ALL');
  const [value, setValue] = useState({ ...emptyInterpretation(), ...confirmed });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function run(action) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setRules((await getExtractosCatalogs(orgId)).rules); await onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function edit(rule) {
    setEditing(rule.id); setPattern(rule.pattern); setSign(rule.match_sign); setAccount(rule.source_account_id || '');
    setValue({ ...emptyInterpretation(), economic_type: rule.target_economic_type, category_id: rule.target_category_id || '', subcategory_id: rule.target_subcategory_id || '', counterparty_id: rule.target_counterparty_id || '' });
  }
  function reset() { setEditing(null); setPattern(''); setAccount(''); setSign('ALL'); setValue(emptyInterpretation()); }
  async function save(e) {
    e.preventDefault(); await run(async () => {
      if (editing) await updateClassificationRule(orgId, editing, { pattern: pattern.trim(), name: 'Regla: ' + pattern.trim(), match_sign: sign, source_account_id: account || null,
        target_economic_type: value.economic_type, target_category_id: value.category_id || null, target_subcategory_id: value.subcategory_id || null, target_counterparty_id: value.counterparty_id || null });
      else await createClassificationRule({ orgId, pattern, matchSign: sign, sourceAccountId: account, economicType: value.economic_type, categoryId: value.category_id, subcategoryId: value.subcategory_id, counterpartyId: value.counterparty_id });
      reset(); setMessage('Regla guardada. Los resultados siempre requieren revisión.');
    });
  }
  return <FinanceDialog title="Reglas de clasificación" busy={busy} onClose={onClose}>
    <p className="text-sm">Coincidencia literal, sin distinguir mayúsculas. La primera regla activa por prioridad y antigüedad propone una clasificación; nunca la confirma.</p>
    <button disabled={busy} className="border border-gray-200 rounded px-3 py-2" onClick={() => run(async () => setMessage((await applyClassificationRules(orgId)) + ' sugerencias aplicadas a pendientes'))}>Aplicar reglas a pendientes</button>
    <ul className="divide-y max-h-56 overflow-y-auto">{rules.map(rule => <li key={rule.id} className="py-3 flex items-center justify-between gap-2 text-sm">
      <div><strong>{rule.pattern}</strong><p>{economicLabels[rule.target_economic_type || 'UNCLASSIFIED']} · {rule.is_active ? 'Activa' : 'Inactiva'} · {rule.match_sign}</p></div>
      <div className="flex gap-2"><button disabled={busy} onClick={() => edit(rule)}>Editar</button><button disabled={busy} onClick={() => run(() => updateClassificationRule(orgId, rule.id, { is_active: !rule.is_active }))}>{rule.is_active ? 'Desactivar' : 'Activar'}</button></div>
    </li>)}</ul>
    <form onSubmit={save} className="border-t pt-4 space-y-3"><fieldset disabled={busy} className="space-y-3">
      <h3 className="font-bold">{editing ? 'Editar regla' : 'Crear regla'}</h3>
      {confirmed && <p className="text-sm">Ejemplo confirmado: {example.descripcion}. Revisa el patrón antes de guardar.</p>}
      {example && !confirmed && <p className="text-amber-900 text-sm">Clasifica primero el movimiento para crear una regla. No se ha propuesto ningún tipo económico.</p>}
      <label className="block">Cuando la descripción contenga<input aria-label="Cuando la descripción contenga" required maxLength={200} value={pattern} onChange={e => setPattern(e.target.value)} className="block border border-gray-200 rounded p-2 w-full" /></label>
      <div className="grid sm:grid-cols-2 gap-3"><label>Cuenta de origen<select aria-label="Cuenta de origen" className="block border border-gray-200 rounded p-2 w-full" value={account} onChange={e => setAccount(e.target.value)}><option value="">Cualquier cuenta</option>{catalogs.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Signo bancario<select aria-label="Signo bancario" className="block border border-gray-200 rounded p-2 w-full" value={sign} onChange={e => setSign(e.target.value)}><option value="ALL">Cualquiera</option><option value="POSITIVE">Entrada</option><option value="NEGATIVE">Salida</option></select></label></div>
      <h4 className="font-semibold">Entonces sugerir</h4><AllocationFields key={editing || 'new'} catalogs={catalogs} value={value} onChange={setValue} orgId={orgId} showNotes={false} />
      <div className="flex gap-3"><button disabled={value.economic_type === 'UNCLASSIFIED'} title={value.economic_type === 'UNCLASSIFIED' ? 'Selecciona el tipo económico que propondrá la regla' : 'Guardar regla como sugerencia'} className="bg-emerald-700 text-white rounded px-4 py-2 disabled:opacity-40">Guardar regla</button><button type="button" onClick={reset}>Nueva / limpiar</button></div>
    </fieldset></form>
    {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
  </FinanceDialog>;
}
