import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { AlertTriangle, X } from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

interface NewIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
}

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  isOpen,
  onClose,
  defaultEmployeeId,
}) => {
  const {
    employees,
    incidentTypes,
    operationalUnits,
    selectedOperationalUnitId,
    createIncident,
    currentRole,
  } = usePersonnel();

  const [employeeId, setEmployeeId] = useState<string>(defaultEmployeeId || employees[0]?.id || '');
  const [date, setDate] = useState<string>(TODAY_STR);
  const [incidentTypeId, setIncidentTypeId] = useState<string>(incidentTypes[0]?.id || '');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [unitId, setUnitId] = useState<string>(
    selectedOperationalUnitId !== 'all' ? selectedOperationalUnitId : operationalUnits[0].id
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    createIncident({
      employeeId,
      operationalUnitId: unitId,
      date,
      incidentTypeId,
      title: title.trim(),
      description: description.trim(),
      createdBy: currentRole === 'PLATFORM_SUPERADMIN' ? 'SuperAdmin' : 'Encargado de Sala / Cocina',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Registrar Nueva Incidencia</h2>
              <p className="text-xs text-slate-500">Aviso operativo o irregularidad de jornada</p>
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
            <label htmlFor="inc-emp" className="block text-xs font-semibold text-slate-700 mb-1">
              Empleado Afectado *
            </label>
            <select
              id="inc-emp"
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
              <label htmlFor="inc-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha de la Incidencia *
              </label>
              <input
                id="inc-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="inc-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Incidencia *
              </label>
              <select
                id="inc-type"
                value={incidentTypeId}
                onChange={(e) => setIncidentTypeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
              >
                {incidentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="inc-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Título Breve *
            </label>
            <input
              id="inc-title"
              type="text"
              required
              placeholder="Ej: Olvido de fichaje por entrega urgente de pescado"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
            />
          </div>

          <div>
            <label htmlFor="inc-desc" className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción de lo Ocurrido *
            </label>
            <textarea
              id="inc-desc"
              required
              rows={3}
              placeholder="Detalla qué sucedió, testimonios de encargados o causa alegada por el empleado..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900 resize-none leading-relaxed"
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
              disabled={!title.trim() || !description.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              Registrar Incidencia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
