import { cloneElement, useEffect, useId, useRef } from 'react';
import { STATUS } from './domain';

export function Badge({ status }) {
  const [label, tone, icon] = STATUS[status] || [status, ['Aprobada', 'Resuelta', 'ACTIVE'].includes(status) ? 'good' : ['Rechazada', 'INACTIVE'].includes(status) ? 'neutral' : 'warning', '•'];
  return <span className={`per-badge ${tone}`}><span aria-hidden="true">{icon}</span> {label === 'ACTIVE' ? 'Activo' : label === 'INACTIVE' ? 'Inactivo' : label === 'ON_LEAVE' ? 'De permiso' : label}</span>;
}
export function Avatar({ employee }) { return <span className="per-avatar" aria-hidden="true">{employee.firstName[0]}{employee.lastName[0]}</span>; }
export function Empty({ title = 'No hay resultados', description = 'Prueba otros filtros o añade un registro.', action }) { return <div className="per-empty"><span aria-hidden="true">◎</span><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function Field({ label, children }) { const id = useId(); return <div className="per-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>; }
export function Modal({ title, children, onClose }) {
  const ref = useRef(null), trigger = useRef(document.activeElement);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => { dialog.close(); trigger.current?.focus?.(); }; }, []);
  return <dialog ref={ref} className="per-dialog" onCancel={onClose} aria-labelledby="per-dialog-title"><div className="per-dialog-head"><h2 id="per-dialog-title">{title}</h2><button type="button" onClick={onClose} aria-label="Cerrar">✕</button></div>{children}</dialog>;
}
export function SaveBar({ onClose, label = 'Guardar' }) { return <div className="per-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="per-primary" type="submit">{label}</button></div>; }
export function EmployeeSelect({ state, value, onChange, id }) { return <select id={id} required value={value} onChange={onChange}><option value="">Seleccionar empleado</option>{state.employees.filter(e => e.status !== 'INACTIVE').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>; }
