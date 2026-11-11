import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { EmployeeSchedule } from '../../types/personnel';
import { Calendar, Clock, X, Plus } from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

interface ScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
  defaultDate?: string;
  existingSchedule?: EmployeeSchedule;
}

export const ScheduleEditModal: React.FC<ScheduleEditModalProps> = ({
  isOpen,
  onClose,
  defaultEmployeeId,
  defaultDate,
  existingSchedule,
}) => {
  const { employees, operationalUnits, selectedOperationalUnitId, createSchedule } = usePersonnel();

  const [employeeId, setEmployeeId] = useState<string>(
    existingSchedule?.employeeId || defaultEmployeeId || employees[0]?.id || ''
  );
  const [date, setDate] = useState<string>(existingSchedule?.date || defaultDate || TODAY_STR);
  const [startTime, setStartTime] = useState<string>(existingSchedule?.expectedStartTime || '10:00');
  const [endTime, setEndTime] = useState<string>(existingSchedule?.expectedEndTime || '17:00');
  const [breakMinutes, setBreakMinutes] = useState<number>(existingSchedule?.breakMinutes || 30);
  const [notes, setNotes] = useState<string>(existingSchedule?.notes || '');
  const [unitId, setUnitId] = useState<string>(
    existingSchedule?.operationalUnitId ||
      (selectedOperationalUnitId !== 'all' ? selectedOperationalUnitId : operationalUnits[0].id)
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSchedule({
      employeeId,
      operationalUnitId: unitId,
      date,
      expectedStartTime: startTime,
      expectedEndTime: endTime,
      breakMinutes,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {existingSchedule ? 'Modificar Turno de Trabajo' : 'Asignar Turno de Trabajo'}
              </h2>
              <p className="text-xs text-slate-500">Planificación de cuadrante operativo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="sch-emp" className="block text-xs font-semibold text-slate-700 mb-1">
              Empleado *
            </label>
            <select
              id="sch-emp"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-slate-900"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName} ({emp.employmentInfo.position})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sch-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha *
              </label>
              <input
                id="sch-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="sch-unit" className="block text-xs font-semibold text-slate-700 mb-1">
                Unidad Operativa
              </label>
              <select
                id="sch-unit"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
              >
                {operationalUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sch-start" className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Inicio *
              </label>
              <input
                id="sch-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="sch-end" className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Fin *
              </label>
              <input
                id="sch-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sch-break" className="block text-xs font-semibold text-slate-700 mb-1">
                Descanso previsto (min)
              </label>
              <input
                id="sch-break"
                type="number"
                min={0}
                step={5}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="sch-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Turno
              </label>
              <select
                id="sch-type"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
              >
                <option value="CONTINUO">Turno Continuo</option>
                <option value="PARTIDO">Turno Partido (compatible)</option>
                <option value="NOCTURNO">Turno Noche / Cierre</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sch-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Notas u Observaciones del Turno
            </label>
            <input
              id="sch-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Refuerzo servicio de cenas y cierre de cocina"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              Guardar Turno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
