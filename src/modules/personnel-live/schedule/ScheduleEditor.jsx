import { useState } from 'react';
import { Field, Modal } from '../../personal/ui';
export default function ScheduleEditor({ modal, state, unit, command, refresh, close }) {
  const rule = modal.kind === 'rule';
  const [value,setValue] = useState(modal.record || {employeeId:modal.employeeId || '',weekdays:[1,2,3,4,5],start:'10:00',end:'17:00',validFrom:state.date,validUntil:'',date:state.date,cancelled:false,note:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(key,val)=>setValue(v=>({...v,[key]:val}));
  const field=(key,label,type,required=false)=><Field label={label}><input type={type} required={required} value={value[key] || ''} onChange={e=>set(key,e.target.value)} /></Field>;
  async function save(e) {e.preventDefault();if(busy)return;setBusy(true);setError('');try{await command(rule?'schedule.rule.save':'schedule.exception.save',value);await refresh();close();}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Modal title={rule?'Horario habitual':'Cambiar un día'} onClose={close}><form className="per-form" onSubmit={save}>
    {error && <p role="alert" className="per-error">{error}</p>}
    <Field label="Empleado"><select required value={value.employeeId} onChange={e=>set('employeeId',e.target.value)}><option value="">Selecciona un empleado</option>{state.employees.filter(e=>e.status==='ACTIVE'&&e.unitIds.includes(unit.id)).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
    {rule ? <><fieldset><legend>Días de la semana</legend>{['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((name,i)=><label className="per-check" key={name}><input type="checkbox" checked={value.weekdays.includes(i+1)} onChange={e=>set('weekdays',e.target.checked?[...value.weekdays,i+1]:value.weekdays.filter(d=>d!==i+1))} />{name}</label>)}</fieldset><div className="per-form-grid">{field('validFrom','Desde','date',true)}{field('validUntil','Hasta (opcional)','date')}</div><small>Sin fecha de fin, se repite cada semana. Para finalizarlo, indica el último día en «Hasta». Los turnos iniciados se conservan.</small></> : <>{field('date','Fecha','date',true)}<label className="per-check"><input type="checkbox" checked={value.cancelled} onChange={e=>set('cancelled',e.target.checked)} />Día sin trabajo</label><small>Solo cambia esta fecha. Tiene prioridad sobre el horario habitual.</small></>}
    {(rule || !value.cancelled) && <div className="per-form-grid">{field('start','Entrada prevista','time',true)}{field('end','Salida prevista','time',true)}</div>}
    {!rule && field('note','Nota','text')}
    <small>Si la salida es anterior a la entrada, el turno termina al día siguiente.</small>
    <div className="per-actions"><button type="button" onClick={close}>Cancelar</button><button type="submit" className="per-primary" disabled={busy}>{busy?'Guardando…':rule?'Guardar horario habitual':'Guardar cambio del día'}</button></div>
  </form></Modal>;
}
