import { memo } from 'react';
import { economicLabels } from '../../domains/finance/domain/economic';
import { ruleExample } from './workflow';
import { currencyAmount } from './ExtractosGraficas';
const statuses = { PENDING:'Pendiente', SUGGESTED:'Sugerida', CONFIRMED:'Confirmada' };
function Action({ label, reason, onClick, children }) {
  return <span title={reason || label} tabIndex={reason ? 0 : undefined} aria-label={reason || undefined} className="inline-flex"><button type="button" title={reason || label} aria-label={reason || label} disabled={!!reason} onClick={onClick} className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded hover:bg-emerald-50 focus-visible:outline-emerald-700 disabled:opacity-35"><span aria-hidden="true">{children}</span></button></span>;
}
function FinanceMovementRow({ movement:m, editable, onEdit, onRule, onSplit, suggestion }) {
  const a = m.allocations[0], multiple = m.allocations.length > 1, linked = m.allocations.some(x=>x.transfer_candidate_id);
  const noPermission = !editable ? 'Tu rol no permite clasificar movimientos' : '';
  const editReason = noPermission || (!a ? 'No hay asignación disponible para clasificar' : linked && !multiple ? 'Transferencia vinculada: usa la revisión de pares' : '');
  const ruleReason = noPermission || (!ruleExample(m) ? (multiple ? 'Edita las líneas del split; no hay una única clasificación para esta regla' : 'Clasifica primero el movimiento para crear una regla') : '');
  const splitReason = noPermission || (m.allocations.some(x=>x.transfer_candidate_id || x.reconciliation_status === 'CONFIRMED') ? 'Este movimiento vinculado no puede dividirse' : '');
  const detail = m.allocations.map(x=>[economicLabels[x.economic_type || 'UNCLASSIFIED'],x.category?.name,x.subcategory?.name,statuses[x.classification_status],x.notes].filter(Boolean).join(' · ')).join('\n');
  const context = [m.source_account?.institution,m.source_account?.product_type === 'CARD' ? 'Tarjeta' : 'Cuenta',m.source_account?.name,m.source_account?.masked_identifier].filter(Boolean).join(' · ');
  return <tr className="border-t border-gray-100 h-10 hover:bg-gray-50">
    <td className="px-2 py-1 whitespace-nowrap text-xs">{m.fecha}</td>
    <td className="px-2 py-1 truncate" title={m.descripcion + '\n' + context}><span>{m.descripcion}</span><span className="sr-only"> · {context}</span></td>
    <td className={'px-2 py-1 text-right whitespace-nowrap tabular-nums ' + (Number(m.monto)<0?'text-red-700':'text-emerald-700')}>{currencyAmount(Number(m.monto)*100,m.currency)}</td>
    <td className="px-2 py-1 truncate" title={detail + (suggestion ? '\n'+suggestion.explanation : '')}><span>{multiple ? `${m.allocations.length} asignaciones` : a?.category?.name || 'Sin clasificar'}</span>{suggestion ? <span className="text-amber-800 text-xs ml-1">· Propuesta</span> : a?.classification_status === 'CONFIRMED' ? <span aria-label="Confirmada" className="text-emerald-700 ml-1">✓</span> : a?.category_id || a?.classification_status === 'SUGGESTED' ? <span className="text-xs text-amber-800 ml-1">· {statuses[a.classification_status]}</span> : null}</td>
    <td className="px-2 py-1 truncate text-xs" title={multiple?'Por asignación':a?.counterparty?.name || ''}>{multiple?'Por asignación':a?.counterparty?.name || '—'}</td>
    <td className="px-1 py-1"><div role="group" aria-label={'Acciones de '+m.descripcion} className="flex flex-nowrap gap-0.5 w-[100px]">
      <Action label="Editar clasificación" reason={editReason} onClick={()=>onEdit(m)}>✏️</Action><Action label="Crear regla desde ejemplo confirmado" reason={ruleReason} onClick={()=>onRule(m)}>⚙️</Action><Action label="Dividir en asignaciones" reason={splitReason} onClick={()=>onSplit(m)}>✂️</Action>
    </div></td>
  </tr>;
}
export default memo(FinanceMovementRow);
