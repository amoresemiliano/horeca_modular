import { useEffect } from 'react';
import { Copy, Pencil, X } from 'lucide-react';
import { addDays } from '../../personal/domain';
import { Empty, Field } from '../../personal/ui';
import { usePersonnelUi } from '../uiState';
import Pagination, { usePagedList } from '../Pagination';

export default function ScheduleView({ state, unit, open, command, refresh, onError, employeeId, onRange }) {
  const [view, setView] = usePersonnelUi(`schedule:${employeeId || 'all'}:view`,'week');
  const [start, setStart] = usePersonnelUi(`schedule:${employeeId || 'all'}:week`,state.date);
  useEffect(()=>{if(view==='week') onRange?.(start,addDays(start,6));},[start,view,onRange]);
  const changeStart = date => { setStart(date); onRange?.(date, addDays(date, 6)); };
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const schedules = state.schedules.filter(s => s.unitId === unit.id && (!employeeId || s.employeeId === employeeId));
  const rules = (state.scheduleRules || []).filter(r=>!employeeId || r.employeeId===employeeId);
  const exceptions = (state.scheduleExceptions || []).filter(r=>!employeeId || r.employeeId===employeeId);
  const ruleList = usePagedList(rules,`rules:${employeeId || 'all'}`);
  const exceptionList = usePagedList(exceptions,`exceptions:${employeeId || 'all'}`);
  const shiftList = usePagedList(schedules,`schedule-list:${employeeId || 'all'}`,start);
  const displayed = view==='week'?schedules:shiftList.items;
  const changeDay = s => open({kind:'exception',record:exceptions.find(e=>e.employeeId===s.employeeId && e.date===s.date) || {employeeId:s.employeeId,date:s.date,start:s.start,end:s.end,cancelled:false,note:''}});
  async function cancel(schedule) {
    try {
      if (schedule.ruleId || schedule.exceptionId) await command('schedule.exception.save',{...exceptions.find(e=>e.employeeId===schedule.employeeId && e.date===schedule.date),employeeId:schedule.employeeId,date:schedule.date,cancelled:true});
      else await command('schedule.cancel', schedule);
      await refresh();
    } catch (error) { onError(error.message); }
  }
  return <>
    <div className="per-section-heading"><div><h2>Horarios previstos</h2><p className="per-muted">Semana o lista. Los turnos históricos conservan su horario original.</p></div><div className="per-actions"><button className="per-primary" onClick={() => open({ kind: 'rule', employeeId })}>+ Horario habitual</button><button onClick={()=>open({kind:'exception',employeeId})}>Cambiar un día</button><button onClick={() => open({ kind: 'schedule', employeeId })}>+ Programar turno</button></div></div>
    <h3>Horarios habituales</h3><div className="per-record-grid">{ruleList.items.map(r=><article className="per-record per-rule-row" key={r.id}><strong>{state.employees.find(e=>e.id===r.employeeId)?.name}</strong><p>{r.weekdays.map(d=>['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][d-1]).join(' · ')} · {r.start}–{r.end}</p><p>Desde {r.validFrom} · {r.validUntil ? `Hasta ${r.validUntil}` : 'Sin fecha de fin'}</p><button onClick={()=>open({kind:'rule',record:r})}>Editar / finalizar horario</button></article>)}</div>{rules.length>0 && <Pagination list={ruleList} label="Horarios habituales" />}
    {exceptions.length>0 && <><h3>Cambios de un día</h3>{exceptionList.items.map(e=><article className="per-record" key={e.id}><strong>{state.employees.find(p=>p.id===e.employeeId)?.name} · {e.date}</strong><p>{e.cancelled?'Día sin trabajo':`${e.start}–${e.end}`}</p><button disabled={e.date<state.date} onClick={()=>open({kind:'exception',record:e})}>Editar cambio</button></article>)}<Pagination list={exceptionList} label="Cambios de un día" /></>}
    <div className="per-toolbar"><Field label="Semana desde"><input type="date" value={start} onChange={e => changeStart(e.target.value)} /></Field><Field label="Vista"><select value={view} onChange={e => setView(e.target.value)}><option value="week">Semana</option><option value="list">Lista del periodo consultado</option></select></Field><button onClick={() => changeStart(addDays(start, -7))}>Semana anterior</button><button onClick={() => changeStart(addDays(start, 7))}>Semana siguiente</button></div>
    <div className={view === 'week' ? 'per-week' : 'per-schedule-list'}>{(view === 'week' ? days : [...new Set(displayed.map(s => s.date))]).map(date => <section className="per-day" key={date} tabIndex={0} aria-label={`Turnos: ${date}`}><h3>{new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00Z`))}</h3><div className="per-day-shifts">{displayed.filter(s => s.date === date).map(s => {
      const historical = Date.parse(s.expectedStartAt) <= Date.now();
      return <article className="per-record per-calendar-item" key={s.id} title={s.note || undefined}>
        <strong>{state.employees.find(e => e.id === s.employeeId)?.name}</strong>
        <span>{s.start}–{s.end}{s.end <= s.start && ' (+1 día)'}</span>
        <div className="per-calendar-actions">
          <button type="button" title="Clonar turno" aria-label="Clonar turno" onClick={()=>open({kind:'schedule',record:{employeeId:s.employeeId,date:s.date<state.date?state.date:addDays(s.date,1),start:s.start,end:s.end,note:s.note || ''}})}><Copy size={16} aria-hidden="true" /></button>
          <button type="button" title="Editar turno" aria-label="Editar turno" disabled={historical} onClick={()=>s.ruleId || s.exceptionId?changeDay(s):open({kind:'schedule',record:s})}><Pencil size={16} aria-hidden="true" /></button>
          <button type="button" title="Cancelar turno" aria-label="Cancelar turno" disabled={historical} onClick={()=>cancel(s)}><X size={16} aria-hidden="true" /></button>
        </div>
        {historical && <span className="per-sr">Turno histórico</span>}
      </article>;
    })}{!displayed.some(s => s.date === date) && <p className="per-muted">Sin turnos</p>}</div></section>)}</div>{view==='list' && <Pagination list={shiftList} label="Turnos" />}
    {!schedules.length && <Empty title="Sin turnos en el periodo consultado" />}
  </>;
}
