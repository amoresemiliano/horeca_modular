import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { StatusBadge } from '../common/StatusBadge';
import { NewIncidentModal } from './NewIncidentModal';
import { IncidentDetailModal } from './IncidentDetailModal';
import { PersonnelIncident } from '../../types/personnel';
import {
  AlertTriangle,
  Plus,
  Filter,
  Search,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Settings2,
} from 'lucide-react';

export const IncidentsView: React.FC = () => {
  const {
    incidents,
    incidentTypes,
    employees,
    operationalUnits,
    selectedOperationalUnitId,
    createIncidentType,
    openWhatsAppModal,
  } = usePersonnel();

  const [statusFilter, setStatusFilter] = useState<'all' | 'ABIERTA' | 'REVISADA' | 'RESUELTA'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<PersonnelIncident | null>(null);

  // New incident type lightweight prompt
  const [showNewTypeModal, setShowNewTypeModal] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  const filteredIncidents = incidents.filter((inc) => {
    if (selectedOperationalUnitId !== 'all' && inc.operationalUnitId !== selectedOperationalUnitId) {
      return false;
    }
    if (statusFilter !== 'all' && inc.status !== statusFilter) {
      return false;
    }
    if (typeFilter !== 'all' && inc.incidentTypeId !== typeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const emp = employees.find((e) => e.id === inc.employeeId);
      const empName = `${emp?.personalInfo.firstName} ${emp?.personalInfo.lastName}`.toLowerCase();
      if (!empName.includes(q) && !inc.title.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleCreateType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeLabel.trim()) return;

    createIncidentType({
      code: newTypeLabel.toUpperCase().replace(/\s+/g, '_'),
      label: newTypeLabel.trim(),
      description: newTypeDescription.trim() || 'Incidencia personalizada de operaciones',
      isActive: true,
      severity: 'MEDIA',
    });

    setNewTypeLabel('');
    setNewTypeDescription('');
    setShowNewTypeModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Gestión Operativa de Turnos</span>
            <span>·</span>
            <span>Irregularidades y Avisos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Incidencias de Personal
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewTypeModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Settings2 className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Tipos de Incidencia</span>
            <span className="sm:hidden">Tipos</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Nueva Incidencia</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status segmented filters */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'ABIERTA', label: 'Abiertas' },
            { id: 'REVISADA', label: 'Revisadas' },
            { id: 'RESUELTA', label: 'Resueltas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
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

        {/* Type & Search filters */}
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 rounded-xl px-2.5 py-2 focus:outline-hidden"
          >
            <option value="all">Todos los motivos</option>
            {incidentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Incidents Feed / Cards */}
      <div className="space-y-3">
        {filteredIncidents.map((inc) => {
          const emp = employees.find((e) => e.id === inc.employeeId);
          const unit = operationalUnits.find((u) => u.id === inc.operationalUnitId);

          return (
            <div
              key={inc.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={inc.status} size="sm" />
                  <span className="text-xs font-semibold text-slate-800">
                    {inc.incidentTypeLabel}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {inc.date}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {unit?.name || 'Sede'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {inc.title}
                </h3>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {inc.description}
                </p>

                <div className="text-[11px] text-slate-500 pt-1">
                  <span>Empleado: </span>
                  <strong className="text-slate-800">
                    {emp?.personalInfo.firstName} {emp?.personalInfo.lastName}
                  </strong>{' '}
                  <span className="text-slate-400">({emp?.employmentInfo.position})</span>
                  <span className="mx-1 text-slate-300">|</span>
                  <span>Registrada por: {inc.createdBy}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (!emp) return;
                    openWhatsAppModal({
                      employeeId: emp.id,
                      recipientName: emp.personalInfo.firstName,
                      recipientPhone: emp.personalInfo.phone,
                      channel: 'WHATSAPP',
                      templateType: 'INCIDENT_ALERT',
                      templateData: {
                        date: inc.date,
                        incidentType: inc.incidentTypeLabel,
                      },
                    });
                  }}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                  title="Notificar por WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedIncident(inc)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer min-h-[40px]"
                >
                  {inc.status === 'RESUELTA' ? 'Ver resolución' : 'Revisar / Resolver'}
                </button>
              </div>
            </div>
          );
        })}

        {filteredIncidents.length === 0 && (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No hay incidencias que mostrar</p>
            <p className="text-xs text-slate-500 mt-1">
              Todos los turnos y fichajes se encuentran al día sin incidencias abiertas.
            </p>
          </div>
        )}
      </div>

      {/* Modal: New Incident */}
      <NewIncidentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />

      {/* Modal: Incident Detail & Resolution */}
      <IncidentDetailModal
        isOpen={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        incident={selectedIncident}
      />

      {/* Lightweight Modal: Custom Incident Type Administration */}
      {showNewTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Añadir Tipo de Incidencia
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Crea una categoría personalizada para el grupo de restaurantes.
            </p>
            <form onSubmit={handleCreateType} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de la Incidencia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Descuadre en pase de comandas"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  placeholder="Breve aclaración del motivo"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTypeModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTypeLabel.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
                >
                  Guardar Tipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
