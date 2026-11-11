import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { StatusBadge } from '../common/StatusBadge';
import { QuickManualPunchModal } from './QuickManualPunchModal';
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  AlertTriangle,
  Plus,
  Tablet,
  Search,
  Filter,
  ArrowRight,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

export const TodayDashboard: React.FC = () => {
  const {
    employees,
    schedules,
    attendanceRecords,
    incidents,
    absences,
    selectedOperationalUnitId,
    operationalUnits,
    setIsKioskMode,
    setSelectedEmployeeId,
    setActiveTab,
    openWhatsAppModal,
  } = usePersonnel();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualEmpId, setManualEmpId] = useState<string | undefined>();

  // Filter schedules and records for TODAY
  const todaySchedules = schedules.filter((s) => s.date === TODAY_STR);

  // Filter employees belonging to the selected operational unit if not 'all'
  const filteredEmployees = employees.filter((emp) => {
    if (selectedOperationalUnitId !== 'all') {
      const matchUnit =
        emp.employmentInfo.primaryOperationalUnitId === selectedOperationalUnitId ||
        emp.employmentInfo.operationalUnitIds.includes(selectedOperationalUnitId);
      if (!matchUnit) return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const fullName = `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`.toLowerCase();
      const pos = emp.employmentInfo.position.toLowerCase();
      if (!fullName.includes(query) && !pos.includes(query)) return false;
    }

    return true;
  });

  // Calculate high-impact operational metrics for today
  const scheduledCount = todaySchedules.filter((s) => {
    if (selectedOperationalUnitId === 'all') return true;
    return s.operationalUnitId === selectedOperationalUnitId;
  }).length;

  const presentCount = attendanceRecords.filter((r) => {
    if (r.date !== TODAY_STR) return false;
    if (selectedOperationalUnitId !== 'all' && r.operationalUnitId !== selectedOperationalUnitId) return false;
    return r.status === 'EN_CURSO' || (r.actualClockIn && !r.actualClockOut);
  }).length;

  const lateCount = attendanceRecords.filter((r) => {
    if (r.date !== TODAY_STR) return false;
    if (selectedOperationalUnitId !== 'all' && r.operationalUnitId !== selectedOperationalUnitId) return false;
    return r.status === 'RETRASO';
  }).length;

  const absentCount = attendanceRecords.filter((r) => {
    if (r.date !== TODAY_STR) return false;
    if (selectedOperationalUnitId !== 'all' && r.operationalUnitId !== selectedOperationalUnitId) return false;
    return r.status === 'AUSENTE';
  }).length;

  const incidentCount = incidents.filter((i) => {
    if (i.date !== TODAY_STR) return false;
    if (selectedOperationalUnitId !== 'all' && i.operationalUnitId !== selectedOperationalUnitId) return false;
    return i.status === 'ABIERTA';
  }).length;

  // Build the list of employee cards for Today
  const employeeCardsData = filteredEmployees.map((emp) => {
    const schedule = todaySchedules.find((s) => s.employeeId === emp.id);
    const attendance = attendanceRecords.find((r) => r.employeeId === emp.id && r.date === TODAY_STR);
    const openIncident = incidents.find((i) => i.employeeId === emp.id && i.date === TODAY_STR && i.status === 'ABIERTA');
    const activeAbsence = absences.find((a) => a.employeeId === emp.id && a.startDate <= TODAY_STR && a.endDate >= TODAY_STR);

    // Determine status
    let status = attendance?.status || (schedule ? 'PENDIENTE' : 'SIN_HORARIO');
    if (activeAbsence) status = 'AUSENTE';
    if (openIncident) status = 'INCIDENCIA';

    return {
      employee: emp,
      schedule,
      attendance,
      openIncident,
      activeAbsence,
      status,
    };
  });

  // Filter cards by active quick status filter
  const displayedCards = employeeCardsData.filter((item) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'present') return item.attendance?.actualClockIn && !item.attendance?.actualClockOut;
    if (filterStatus === 'late') return item.status === 'RETRASO';
    if (filterStatus === 'pending') return item.status === 'PENDIENTE';
    if (filterStatus === 'absent') return item.status === 'AUSENTE';
    if (filterStatus === 'incident') return item.status === 'INCIDENCIA';
    if (filterStatus === 'completed') return item.status === 'FINALIZADO';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Operational Live Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Operaciones de Personal</span>
            <span>·</span>
            <span>Viernes, 6 de noviembre de 2026</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Hoy en Planta
          </h1>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setManualEmpId(undefined);
              setIsManualModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>Fichaje Manual</span>
          </button>

          <button
            type="button"
            onClick={() => setIsKioskMode(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Tablet className="w-4 h-4 text-amber-400" />
            <span>Abrir Terminal Kiosco</span>
          </button>
        </div>
      </div>

      {/* TOP SUMMARY STATS (Operational Visibility without heavy charts) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Programados */}
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'all' ? 'all' : 'all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-white border-slate-300 shadow-sm ring-2 ring-slate-900/5'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Programados</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
            {scheduledCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Total turnos previstos</p>
        </button>

        {/* Presentes */}
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'present' ? 'all' : 'present')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'present'
              ? 'bg-sky-50/70 border-sky-300 shadow-sm ring-2 ring-sky-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sky-800 font-medium mb-1">
            <span>Presentes</span>
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-sky-900 font-mono tabular-nums">
            {presentCount}
          </div>
          <p className="text-[11px] text-sky-700/80 mt-1">Actualmente en turno</p>
        </button>

        {/* Retrasos */}
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'late' ? 'all' : 'late')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'late'
              ? 'bg-amber-50/70 border-amber-300 shadow-sm ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-800 font-medium mb-1">
            <span>Retrasos</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-900 font-mono tabular-nums">
            {lateCount}
          </div>
          <p className="text-[11px] text-amber-700/80 mt-1">Llegada posterior (+5 min)</p>
        </button>

        {/* Ausentes */}
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'absent' ? 'all' : 'absent')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'absent'
              ? 'bg-rose-50/70 border-rose-300 shadow-sm ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-800 font-medium mb-1">
            <span>Ausentes</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-900 font-mono tabular-nums">
            {absentCount}
          </div>
          <p className="text-[11px] text-rose-700/80 mt-1">Bajas y vacaciones</p>
        </button>

        {/* Incidencias */}
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'incident' ? 'all' : 'incident')}
          className={`p-4 rounded-2xl border text-left col-span-2 sm:col-span-1 transition-all cursor-pointer ${
            filterStatus === 'incident'
              ? 'bg-amber-50/90 border-amber-400 shadow-sm ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-900 font-medium mb-1">
            <span>Incidencias</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-950 font-mono tabular-nums">
            {incidentCount}
          </div>
          <p className="text-[11px] text-amber-800/80 mt-1">Olvidos / Avisos hoy</p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Segmented Filter Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'present', label: 'Presentes' },
            { id: 'late', label: 'Retrasos' },
            { id: 'pending', label: 'Pendientes' },
            { id: 'absent', label: 'Ausentes' },
            { id: 'incident', label: 'Incidencias' },
            { id: 'completed', label: 'Finalizados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
                filterStatus === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o puesto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden focus:border-slate-900 shadow-2xs"
          />
        </div>
      </div>

      {/* Employee Cards Feed (Mobile-First responsive cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {displayedCards.map((item) => {
          const emp = item.employee;
          const sch = item.schedule;
          const att = item.attendance;
          const unit = operationalUnits.find((u) => u.id === emp.employmentInfo.primaryOperationalUnitId);

          return (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Header: Name, Position and Status */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(emp.id);
                        setActiveTab('empleados');
                      }}
                      className="text-left font-bold text-sm text-slate-900 hover:text-amber-600 transition-colors truncate block cursor-pointer"
                    >
                      {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                    </button>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {emp.employmentInfo.position}
                    </p>
                  </div>

                  <StatusBadge status={item.status} size="sm" />
                </div>

                {/* Operational Details Strip */}
                <div className="space-y-2 py-2 border-t border-b border-slate-100 text-xs">
                  {/* Expected Shift */}
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500 font-medium">Turno previsto:</span>
                    {sch ? (
                      <span className="font-mono font-semibold text-slate-900">
                        {sch.expectedStartTime} – {sch.expectedEndTime}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Sin turno asignado</span>
                    )}
                  </div>

                  {/* Real Clock-In / Variance */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Entrada real:</span>
                    {att?.clockInTimeFormatted ? (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-slate-900">{att.clockInTimeFormatted}</span>
                        {att.arrivalVarianceMinutes > 0 && (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                            +{att.arrivalVarianceMinutes} min tarde
                          </span>
                        )}
                        {att.arrivalVarianceMinutes < 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            {Math.abs(att.arrivalVarianceMinutes)} min antes
                          </span>
                        )}
                      </div>
                    ) : item.activeAbsence ? (
                      <span className="text-rose-600 font-medium">{item.activeAbsence.absenceTypeLabel}</span>
                    ) : (
                      <span className="text-slate-400 italic">Pendiente de entrada</span>
                    )}
                  </div>

                  {/* Clock-Out if completed */}
                  {att?.clockOutTimeFormatted && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Salida real:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {att.clockOutTimeFormatted}
                      </span>
                    </div>
                  )}

                  {/* Incidents / Alerts banner */}
                  {item.openIncident && (
                    <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>{item.openIncident.title}:</strong> {item.openIncident.description}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Quick Actions */}
              <div className="flex items-center justify-between pt-3 mt-1 text-xs">
                <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]">
                  {unit?.name || 'Sede Central'}
                </span>

                <div className="flex items-center gap-1.5">
                  {/* WhatsApp Quick Trigger */}
                  <button
                    type="button"
                    onClick={() =>
                      openWhatsAppModal({
                        employeeId: emp.id,
                        recipientName: emp.personalInfo.firstName,
                        recipientPhone: emp.personalInfo.phone,
                        channel: 'WHATSAPP',
                        templateType: item.openIncident ? 'INCIDENT_ALERT' : 'CUSTOM',
                        templateData: {
                          date: 'hoy',
                          incidentType: item.openIncident?.title || 'aviso de turno',
                        },
                      })
                    }
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    title="Notificar por WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  {/* Quick Manual Clock-In if missing */}
                  {!att?.actualClockIn && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualEmpId(emp.id);
                        setIsManualModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer min-h-[32px] flex items-center"
                    >
                      Fichar
                    </button>
                  )}

                  {/* View Employee Detail */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeId(emp.id);
                      setActiveTab('empleados');
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer min-h-[32px]"
                  >
                    <span>Ver ficha</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayedCards.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm font-semibold text-slate-800">
            No se encontraron empleados con el filtro seleccionado
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Prueba a seleccionar "Todos" o borrar el término de búsqueda.
          </p>
          <button
            onClick={() => {
              setFilterStatus('all');
              setSearchQuery('');
            }}
            className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
          >
            Restablecer filtros
          </button>
        </div>
      )}

      {/* Manual Punch Modal */}
      <QuickManualPunchModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        defaultEmployeeId={manualEmpId}
      />
    </div>
  );
};
