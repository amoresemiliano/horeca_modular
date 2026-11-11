import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { AttendanceRecord } from '../../types/personnel';
import { Edit3, X, AlertTriangle } from 'lucide-react';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  const { employees, correctAttendance, currentRole } = usePersonnel();

  const [clockIn, setClockIn] = useState<string>(record?.clockInTimeFormatted || '10:00');
  const [clockOut, setClockOut] = useState<string>(record?.clockOutTimeFormatted || '17:00');
  const [reason, setReason] = useState<string>('');

  if (!isOpen || !record) return null;

  const employee = employees.find((e) => e.id === record.employeeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    correctAttendance(record.id, {
      clockIn,
      clockOut: clockOut || undefined,
      reason: reason.trim(),
      correctedBy: currentRole === 'PLATFORM_SUPERADMIN' ? 'SuperAdmin' : 'Administrador de Turno',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Corregir Fichaje (Auditoría)</h2>
              <p className="text-xs text-slate-500">Modificación con registro inmutable de trazabilidad</p>
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
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
            <p>
              <strong>Empleado:</strong> {employee?.personalInfo.firstName} {employee?.personalInfo.lastName}
            </p>
            <p className="mt-1">
              <strong>Fecha:</strong> {record.date}
            </p>
            {record.originalClockIn && (
              <p className="mt-1 text-slate-500">
                Fichaje original registrado: {record.originalClockIn} – {record.originalClockOut || 'En curso'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="correct-in" className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Entrada
              </label>
              <input
                id="correct-in"
                type="time"
                required
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="correct-out" className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Salida
              </label>
              <input
                id="correct-out"
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="correct-reason" className="block text-xs font-semibold text-slate-700 mb-1">
              Motivo legal de la corrección *
            </label>
            <textarea
              id="correct-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Empleado olvidó fichar al entrar por recepción de mercancía urgente. Verificado por cámaras y jefe de cocina."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900 resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg text-[11px] text-amber-900 border border-amber-200/60">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              El registro original no se sobreescribe de forma destructiva; queda vinculado con el autor, marca de tiempo y justificación conforme a la normativa laboral española.
            </p>
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
              disabled={!reason.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              Guardar Corrección Auditada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
