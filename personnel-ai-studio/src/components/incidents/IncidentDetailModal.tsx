import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { PersonnelIncident } from '../../types/personnel';
import { StatusBadge } from '../common/StatusBadge';
import {
  AlertTriangle,
  X,
  CheckCircle2,
  MessageSquare,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';

interface IncidentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: PersonnelIncident | null;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  isOpen,
  onClose,
  incident,
}) => {
  const { employees, resolveIncident, openWhatsAppModal, currentRole } = usePersonnel();
  const [resolutionNotes, setResolutionNotes] = useState('');

  if (!isOpen || !incident) return null;

  const employee = employees.find((e) => e.id === incident.employeeId);

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) return;

    resolveIncident(
      incident.id,
      resolutionNotes.trim(),
      currentRole === 'PLATFORM_SUPERADMIN' ? 'SuperAdmin' : 'Administrador de Personal'
    );
    onClose();
  };

  const handleNotifyWhatsApp = () => {
    if (!employee) return;
    openWhatsAppModal({
      employeeId: employee.id,
      recipientName: employee.personalInfo.firstName,
      recipientPhone: employee.personalInfo.phone,
      channel: 'WHATSAPP',
      templateType: 'INCIDENT_ALERT',
      templateData: {
        date: incident.date,
        incidentType: incident.incidentTypeLabel,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 truncate max-w-xs">
                {incident.title}
              </h2>
              <p className="text-xs text-slate-500">Expediente de incidencia operativa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 font-medium block">Empleado</span>
              <span className="font-bold text-slate-900 mt-0.5 block">
                {employee?.personalInfo.firstName} {employee?.personalInfo.lastName}
              </span>
              <span className="text-slate-500 text-[11px]">{employee?.employmentInfo.position}</span>
            </div>

            <div>
              <span className="text-slate-400 font-medium block">Estado y Fecha</span>
              <div className="mt-0.5 flex items-center gap-2">
                <StatusBadge status={incident.status} size="sm" />
                <span className="font-mono text-slate-700">{incident.date}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-medium block">Tipo de Incidencia</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {incident.incidentTypeLabel}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium block">Registrado por</span>
              <span className="font-medium text-slate-700 mt-0.5 block">
                {incident.createdBy}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <span className="text-xs font-semibold text-slate-700 block mb-1">
              Descripción del Hecho
            </span>
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-800 leading-relaxed border border-slate-100">
              {incident.description}
            </div>
          </div>

          {/* Resolution section if already resolved */}
          {incident.status === 'RESUELTA' ? (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Incidencia Resuelta</span>
              </div>
              <p className="text-emerald-900 leading-relaxed">{incident.resolutionNotes}</p>
              <p className="text-[10px] text-emerald-700 pt-1 font-mono">
                Cerrada por {incident.resolvedBy} el {incident.resolvedAt?.substring(0, 10)}
              </p>
            </div>
          ) : (
            /* Resolution Form */
            <form onSubmit={handleResolve} className="space-y-3 pt-2 border-t border-slate-100">
              <label htmlFor="inc-res" className="block text-xs font-semibold text-slate-700">
                Resolución / Conclusión de Turno *
              </label>
              <textarea
                id="inc-res"
                required
                rows={2}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Añade la justificación, acuerdo o ajuste realizado con el trabajador..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900 resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleNotifyWhatsApp}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer min-h-[38px]"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Notificar por WhatsApp</span>
                </button>

                <button
                  type="submit"
                  disabled={!resolutionNotes.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer min-h-[38px]"
                >
                  Cerrar como Resuelta
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
