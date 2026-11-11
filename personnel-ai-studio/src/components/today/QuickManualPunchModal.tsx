import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { Clock, X, Check } from 'lucide-react';

interface QuickManualPunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
}

export const QuickManualPunchModal: React.FC<QuickManualPunchModalProps> = ({
  isOpen,
  onClose,
  defaultEmployeeId,
}) => {
  const { employees, manualClockPunch, schedules } = usePersonnel();

  const [employeeId, setEmployeeId] = useState<string>(defaultEmployeeId || employees[0]?.id || '');
  const [punchType, setPunchType] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [time, setTime] = useState<string>('10:00');
  const [observation, setObservation] = useState<string>('Fichaje manual validado por encargado');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    manualClockPunch(employeeId, punchType, time, observation);
    onClose();
  };

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const employeeSchedule = schedules.find((s) => s.employeeId === employeeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Registrar Fichaje Manual</h2>
              <p className="text-xs text-slate-500">Acción de encargado con registro en auditoría</p>
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
            <label htmlFor="manual-emp" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Empleado
            </label>
            <select
              id="manual-emp"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-hidden focus:border-slate-900"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName} ({emp.employmentInfo.position})
                </option>
              ))}
            </select>
            {employeeSchedule && (
              <p className="text-[11px] text-slate-500 mt-1">
                Horario previsto hoy: <span className="font-semibold">{employeeSchedule.expectedStartTime} – {employeeSchedule.expectedEndTime}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tipo de Fichaje
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPunchType('CLOCK_IN')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    punchType === 'CLOCK_IN'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setPunchType('CLOCK_OUT')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    punchType === 'CLOCK_OUT'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Salida
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="manual-time" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hora (HH:mm)
              </label>
              <input
                id="manual-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="manual-obs" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Motivo u Observación
            </label>
            <input
              id="manual-obs"
              type="text"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ej: Olvidó pasar el PIN al entrar con proveedores"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:border-slate-900"
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
              Guardar Fichaje
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
