import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { UserX, X, Upload } from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

interface NewAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
}

export const NewAbsenceModal: React.FC<NewAbsenceModalProps> = ({
  isOpen,
  onClose,
  defaultEmployeeId,
}) => {
  const { employees, absenceTypes, createAbsence } = usePersonnel();

  const [employeeId, setEmployeeId] = useState<string>(defaultEmployeeId || employees[0]?.id || '');
  const [absenceTypeId, setAbsenceTypeId] = useState<string>(absenceTypes[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(TODAY_STR);
  const [endDate, setEndDate] = useState<string>(TODAY_STR);
  const [isPartialDay, setIsPartialDay] = useState<boolean>(false);
  const [partialHours, setPartialHours] = useState<number>(4);
  const [reasonNotes, setReasonNotes] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAbsence({
      employeeId,
      absenceTypeId,
      startDate,
      endDate,
      isPartialDay,
      partialHours: isPartialDay ? partialHours : undefined,
      reasonNotes: reasonNotes.trim() || undefined,
      documentName: documentName || undefined,
    });
    onClose();
  };

  const selectedType = absenceTypes.find((t) => t.id === absenceTypeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Registrar Ausencia o Baja</h2>
              <p className="text-xs text-slate-500">Solicitud o comunicación de inasistencia</p>
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
            <label htmlFor="abs-emp" className="block text-xs font-semibold text-slate-700 mb-1">
              Empleado *
            </label>
            <select
              id="abs-emp"
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

          <div>
            <label htmlFor="abs-type" className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Ausencia *
            </label>
            <select
              id="abs-type"
              value={absenceTypeId}
              onChange={(e) => setAbsenceTypeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
            >
              {absenceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label} ({type.isPaid ? 'Retribuida' : 'No retribuida'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="abs-start" className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha Inicio *
              </label>
              <input
                id="abs-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="abs-end" className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha Fin *
              </label>
              <input
                id="abs-end"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          {/* Partial Day toggle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <label htmlFor="abs-partial" className="text-xs font-semibold text-slate-700 cursor-pointer">
              ¿Ausencia de jornada parcial? (Horas)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="abs-partial"
                type="checkbox"
                checked={isPartialDay}
                onChange={(e) => setIsPartialDay(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
              {isPartialDay && (
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={partialHours}
                  onChange={(e) => setPartialHours(Number(e.target.value))}
                  className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-900"
                />
              )}
            </div>
          </div>

          <div>
            <label htmlFor="abs-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Observaciones / Justificación
            </label>
            <input
              id="abs-notes"
              type="text"
              placeholder="Ej: Acompañamiento a familiar a consulta médica"
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
            />
          </div>

          {/* Document upload simulation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Justificante o Documento Médico {selectedType?.requiresDocument && '(Requerido)'}
            </label>
            <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-between">
              <span className="text-xs text-slate-500 truncate">
                {documentName || 'Ningún archivo seleccionado'}
              </span>
              <button
                type="button"
                onClick={() => setDocumentName(`justificante_${startDate}_${Math.floor(Math.random() * 1000)}.pdf`)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Adjuntar PDF
              </button>
            </div>
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
              Guardar Solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
