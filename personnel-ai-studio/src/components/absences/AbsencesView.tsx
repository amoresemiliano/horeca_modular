import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { StatusBadge } from '../common/StatusBadge';
import { NewAbsenceModal } from './NewAbsenceModal';
import { ManageAbsenceTypesModal } from './ManageAbsenceTypesModal';
import {
  UserX,
  Plus,
  Settings2,
  Calendar,
  Check,
  X,
  FileText,
  MessageSquare,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const AbsencesView: React.FC = () => {
  const {
    absences,
    absenceTypes,
    employees,
    reviewAbsence,
    openWhatsAppModal,
  } = usePersonnel();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);

  const filteredAbsences = absences.filter((abs) => {
    if (statusFilter !== 'all' && abs.status !== statusFilter) return false;
    if (typeFilter !== 'all' && abs.absenceTypeId !== typeFilter) return false;
    return true;
  });

  const handleApprove = (absenceId: string) => {
    reviewAbsence(absenceId, 'APROBADA');
  };

  const handleReject = (absenceId: string) => {
    reviewAbsence(absenceId, 'RECHAZADA', 'Denegado por necesidades operativas de sala/cocina');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Gestión de Calendario y Personal</span>
            <span>·</span>
            <span>Vacaciones, Bajas Médicas y Permisos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Ausencias y Permisos
          </h1>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Administrar tipos de ausencia modal button */}
          <button
            type="button"
            onClick={() => setIsManageTypesOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Settings2 className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Administrar Tipos</span>
            <span className="sm:hidden">Tipos</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Nueva Ausencia</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status segmented filters */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'PENDIENTE', label: 'Pendientes' },
            { id: 'APROBADA', label: 'Aprobadas' },
            { id: 'RECHAZADA', label: 'Rechazadas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter by absence type */}
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 rounded-xl px-3 py-2 focus:outline-hidden"
          >
            <option value="all">Todos los motivos</option>
            {absenceTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Absences List / Cards */}
      <div className="space-y-3">
        {filteredAbsences.map((abs) => {
          const emp = employees.find((e) => e.id === abs.employeeId);
          const type = absenceTypes.find((t) => t.id === abs.absenceTypeId);

          return (
            <div
              key={abs.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: type?.color || '#3b82f6' }}
                  />
                  <span className="text-xs font-bold text-slate-900">
                    {abs.absenceTypeLabel}
                  </span>
                  <span className="text-slate-400">·</span>
                  <StatusBadge status={abs.status} size="sm" />
                  <span className="text-slate-400">·</span>
                  <span className="text-xs font-mono text-slate-600 tabular-nums">
                    {abs.startDate} al {abs.endDate}
                  </span>
                  {abs.isPartialDay && (
                    <span className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono">
                      {abs.partialHours} horas
                    </span>
                  )}
                </div>

                <div className="text-xs font-bold text-slate-900">
                  {emp?.personalInfo.firstName} {emp?.personalInfo.lastName}{' '}
                  <span className="text-slate-500 font-normal">({emp?.employmentInfo.position})</span>
                </div>

                {abs.reasonNotes && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {abs.reasonNotes}
                  </p>
                )}

                {/* Attached Document info */}
                {abs.documentName && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-[11px] text-slate-700 font-mono border border-slate-200/60">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>{abs.documentName}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                {/* WhatsApp Notification trigger */}
                <button
                  type="button"
                  onClick={() => {
                    if (!emp) return;
                    openWhatsAppModal({
                      employeeId: emp.id,
                      recipientName: emp.personalInfo.firstName,
                      recipientPhone: emp.personalInfo.phone,
                      channel: 'WHATSAPP',
                      templateType: abs.status === 'APROBADA' ? 'ABSENCE_APPROVED' : 'CUSTOM',
                      templateData: {
                        absenceType: abs.absenceTypeLabel,
                        startDate: abs.startDate,
                        endDate: abs.endDate,
                      },
                    });
                  }}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                  title="Enviar notificación por WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>

                {abs.status === 'PENDIENTE' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleReject(abs.id)}
                      className="px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer min-h-[40px]"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(abs.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[40px]"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Aprobar</span>
                    </button>
                  </>
                )}

                {abs.status === 'APROBADA' && (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprobada por {abs.reviewedBy}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filteredAbsences.length === 0 && (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-800">No hay ausencias con el filtro seleccionado</p>
            <p className="text-xs text-slate-500 mt-1">
              Las solicitudes de vacaciones, permisos y bajas médicas aparecerán aquí.
            </p>
          </div>
        )}
      </div>

      {/* Modal: New Absence */}
      <NewAbsenceModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />

      {/* Modal: Manage Absence Types */}
      <ManageAbsenceTypesModal
        isOpen={isManageTypesOpen}
        onClose={() => setIsManageTypesOpen(false)}
      />
    </div>
  );
};
