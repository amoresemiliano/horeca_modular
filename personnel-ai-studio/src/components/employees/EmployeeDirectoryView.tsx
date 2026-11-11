import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { StatusBadge } from '../common/StatusBadge';
import { NewEmployeeModal } from './NewEmployeeModal';
import { EmployeeDetailView } from './EmployeeDetailView';
import {
  Users,
  Plus,
  Search,
  Filter,
  KeyRound,
  MessageSquare,
  ArrowRight,
  Shield,
  Building,
} from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

export const EmployeeDirectoryView: React.FC = () => {
  const {
    employees,
    schedules,
    operationalUnits,
    selectedOperationalUnitId,
    selectedEmployeeId,
    setSelectedEmployeeId,
    openWhatsAppModal,
  } = usePersonnel();

  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewEmployeeModalOpen, setIsNewEmployeeModalOpen] = useState(false);

  // If an employee is selected, render their full profile
  if (selectedEmployeeId) {
    return (
      <EmployeeDetailView
        employeeId={selectedEmployeeId}
        onBack={() => setSelectedEmployeeId(null)}
      />
    );
  }

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    if (selectedOperationalUnitId !== 'all') {
      const matchUnit =
        emp.employmentInfo.primaryOperationalUnitId === selectedOperationalUnitId ||
        emp.employmentInfo.operationalUnitIds.includes(selectedOperationalUnitId);
      if (!matchUnit) return false;
    }

    if (statusFilter !== 'all' && emp.employmentInfo.employmentStatus !== statusFilter) {
      return false;
    }

    if (positionFilter !== 'all' && !emp.employmentInfo.position.toLowerCase().includes(positionFilter.toLowerCase())) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`.toLowerCase();
      const doc = emp.personalInfo.documentId.toLowerCase();
      const pos = emp.employmentInfo.position.toLowerCase();
      if (!fullName.includes(q) && !doc.includes(q) && !pos.includes(q)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Gestión de Personal & Expedientes</span>
            <span>·</span>
            <span>Plantilla de Trabajadores</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Directorio de Empleados
          </h1>
        </div>

        {/* Action: Add new employee */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewEmployeeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Nuevo Empleado</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status segmented buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'ACTIVE', label: 'Activos' },
            { id: 'ON_LEAVE', label: 'En Baja / Vacaciones' },
            { id: 'INACTIVE', label: 'Inactivos' },
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

        {/* Position & Search */}
        <div className="flex items-center gap-2">
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 rounded-xl px-2.5 py-2 focus:outline-hidden"
          >
            <option value="all">Todas las secciones</option>
            <option value="Cocina">Cocina</option>
            <option value="Sala">Sala</option>
            <option value="Barra">Barra</option>
            <option value="Producción">Obrador / Producción</option>
            <option value="Logística">Logística / Reparto</option>
          </select>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, DNI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Employee Cards Grid (Clean operational cards, NO salary on card) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredEmployees.map((emp) => {
          const unit = operationalUnits.find((u) => u.id === emp.employmentInfo.primaryOperationalUnitId);
          const scheduleToday = schedules.find((s) => s.employeeId === emp.id && s.date === TODAY_STR);

          return (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                {/* Header: Name, Avatar initial, Position & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {emp.personalInfo.firstName[0]}
                      {emp.personalInfo.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className="font-bold text-sm text-slate-900 hover:text-amber-600 transition-colors truncate block text-left cursor-pointer"
                      >
                        {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                      </button>
                      <p className="text-xs text-slate-500 truncate">{emp.employmentInfo.position}</p>
                    </div>
                  </div>

                  <StatusBadge
                    status={emp.employmentInfo.employmentStatus}
                    customLabel={
                      emp.employmentInfo.employmentStatus === 'ACTIVE'
                        ? 'Activo'
                        : emp.employmentInfo.employmentStatus === 'ON_LEAVE'
                        ? 'De Baja'
                        : 'Inactivo'
                    }
                    size="sm"
                  />
                </div>

                {/* Operational Information (No salary displayed) */}
                <div className="p-2.5 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500">Centro:</span>
                    <span className="font-medium text-slate-900 truncate max-w-[150px]">
                      {unit?.name || 'Sede Central'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500">Jornada:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {emp.employmentInfo.weeklyContractedHours} h / semana
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500">Turno hoy:</span>
                    {scheduleToday ? (
                      <span className="font-mono font-bold text-slate-900">
                        {scheduleToday.expectedStartTime} – {scheduleToday.expectedEndTime}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Libre / Sin turno</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-mono text-slate-400">
                  PIN: ● ● ● ●
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      openWhatsAppModal({
                        employeeId: emp.id,
                        recipientName: emp.personalInfo.firstName,
                        recipientPhone: emp.personalInfo.phone,
                        channel: 'WHATSAPP',
                        templateType: 'CUSTOM',
                      })
                    }
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    title="Enviar WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span>Ver Ficha</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: New Employee */}
      <NewEmployeeModal
        isOpen={isNewEmployeeModalOpen}
        onClose={() => setIsNewEmployeeModalOpen(false)}
      />
    </div>
  );
};
