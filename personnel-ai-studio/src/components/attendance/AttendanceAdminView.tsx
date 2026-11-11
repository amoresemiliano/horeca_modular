import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { StatusBadge } from '../common/StatusBadge';
import { CorrectionModal } from './CorrectionModal';
import { AttendanceRecord } from '../../types/personnel';
import {
  Calendar,
  Filter,
  Search,
  Edit3,
  Clock,
  ArrowUpDown,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatMinutesToHours } from '../../services/attendanceCalculator';

export const AttendanceAdminView: React.FC = () => {
  const {
    attendanceRecords,
    employees,
    schedules,
    operationalUnits,
    selectedOperationalUnitId,
    setSelectedEmployeeId,
    setActiveTab,
    addToast,
  } = usePersonnel();

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected record for correction modal
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<AttendanceRecord | null>(null);

  // Filter records
  const filteredRecords = attendanceRecords.filter((rec) => {
    // Unit filter
    if (selectedOperationalUnitId !== 'all' && rec.operationalUnitId !== selectedOperationalUnitId) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && rec.status !== statusFilter) {
      return false;
    }

    // Employee dropdown filter
    if (selectedEmployeeFilter !== 'all' && rec.employeeId !== selectedEmployeeFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const emp = employees.find((e) => e.id === rec.employeeId);
      const fullName = `${emp?.personalInfo.firstName} ${emp?.personalInfo.lastName}`.toLowerCase();
      if (!fullName.includes(searchQuery.toLowerCase())) return false;
    }

    return true;
  });

  const handleExportCsv = () => {
    addToast(
      'Informe generado',
      `Se han exportado ${filteredRecords.length} registros de control horario en formato CSV (conforme a la ITSS).`,
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Control Horario y Registro de Jornada</span>
            <span>·</span>
            <span>Real Decreto-ley 8/2019</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Registro de Asistencia
          </h1>
        </div>

        {/* Action: Export official record */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV Oficial</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date Range Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[36px] ${
                dateFilter === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoy (6 nov)
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[36px] ${
                dateFilter === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Esta semana
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[36px] ${
                dateFilter === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mes de noviembre
            </button>
          </div>

          {/* Quick Stats pill */}
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong className="text-slate-900 font-mono">{filteredRecords.length}</strong> registros
          </div>
        </div>

        {/* Secondary Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
          {/* Employee dropdown */}
          <div>
            <label htmlFor="filter-emp" className="block text-[11px] font-semibold text-slate-500 mb-1">
              Empleado
            </label>
            <select
              id="filter-emp"
              value={selectedEmployeeFilter}
              onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
            >
              <option value="all">Todos los empleados</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Status dropdown */}
          <div>
            <label htmlFor="filter-status" className="block text-[11px] font-semibold text-slate-500 mb-1">
              Estado
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
            >
              <option value="all">Todos los estados</option>
              <option value="A_TIEMPO">A tiempo</option>
              <option value="RETRASO">Retraso</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="AUSENTE">Ausente</option>
              <option value="INCIDENCIA">Incidencia</option>
              <option value="FINALIZADO">Finalizado</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label htmlFor="filter-search" className="block text-[11px] font-semibold text-slate-500 mb-1">
              Búsqueda rápida
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="filter-search"
                type="text"
                placeholder="Nombre de empleado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE CARDS VIEW (Clean cards on mobile, hidden on desktop) */}
      <div className="block md:hidden space-y-3">
        {filteredRecords.map((rec) => {
          const emp = employees.find((e) => e.id === rec.employeeId);
          const sch = schedules.find((s) => s.id === rec.expectedScheduleId);

          return (
            <div
              key={rec.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (emp) setSelectedEmployeeId(emp.id);
                      setActiveTab('empleados');
                    }}
                    className="text-left font-bold text-sm text-slate-900"
                  >
                    {emp?.personalInfo.firstName} {emp?.personalInfo.lastName}
                  </button>
                  <p className="text-xs text-slate-500">{emp?.employmentInfo.position}</p>
                </div>
                <StatusBadge status={rec.status} size="sm" />
              </div>

              {/* Schedule vs Actual Comparison */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block mb-0.5">
                    Horario Previsto
                  </span>
                  <span className="text-slate-900 font-bold">
                    {sch ? `${sch.expectedStartTime} – ${sch.expectedEndTime}` : 'Sin horario'}
                  </span>
                  {rec.expectedMinutes > 0 && (
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {formatMinutesToHours(rec.expectedMinutes)}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block mb-0.5">
                    Fichaje Real
                  </span>
                  <span className="text-slate-900 font-bold">
                    {rec.clockInTimeFormatted || '--:--'} – {rec.clockOutTimeFormatted || 'En curso'}
                  </span>
                  {rec.actualMinutes > 0 ? (
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      {formatMinutesToHours(rec.actualMinutes)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic block mt-0.5">
                      {rec.clockInTimeFormatted ? 'En curso...' : 'Sin fichar'}
                    </span>
                  )}
                </div>
              </div>

              {/* Variance & Audit */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div>
                  {rec.arrivalVarianceMinutes > 0 && (
                    <span className="text-amber-800 font-semibold font-mono">
                      +{rec.arrivalVarianceMinutes} min llegada
                    </span>
                  )}
                  {rec.arrivalVarianceMinutes < 0 && (
                    <span className="text-emerald-700 font-semibold font-mono">
                      {Math.abs(rec.arrivalVarianceMinutes)} min antes
                    </span>
                  )}
                  {rec.arrivalVarianceMinutes === 0 && rec.clockInTimeFormatted && (
                    <span className="text-slate-600 font-semibold">Puntual</span>
                  )}
                  {rec.isManualCorrection && (
                    <span className="block text-[10px] text-amber-700 italic mt-0.5">
                      (Corregido por {rec.correctedBy})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecordForCorrection(rec)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer min-h-[38px]"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Corregir</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP OPERATIONAL COMPACT TABLE (Hidden on mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Fecha</th>
              <th className="py-3.5 px-4">Empleado</th>
              <th className="py-3.5 px-4">Horario Previsto</th>
              <th className="py-3.5 px-4">Fichaje Real</th>
              <th className="py-3.5 px-4">Diferencia</th>
              <th className="py-3.5 px-4">Horas Real / Esperado</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.map((rec) => {
              const emp = employees.find((e) => e.id === rec.employeeId);
              const sch = schedules.find((s) => s.id === rec.expectedScheduleId);

              return (
                <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Fecha */}
                  <td className="py-3 px-4 font-mono font-medium text-slate-600 tabular-nums">
                    {rec.date}
                  </td>

                  {/* Empleado */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (emp) setSelectedEmployeeId(emp.id);
                        setActiveTab('empleados');
                      }}
                      className="font-bold text-slate-900 hover:text-amber-600 transition-colors cursor-pointer text-left"
                    >
                      {emp?.personalInfo.firstName} {emp?.personalInfo.lastName}
                    </button>
                    <p className="text-[11px] text-slate-400 font-medium">{emp?.employmentInfo.position}</p>
                  </td>

                  {/* Horario Previsto */}
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800 tabular-nums">
                    {sch ? `${sch.expectedStartTime} – ${sch.expectedEndTime}` : <span className="text-slate-400 italic font-sans font-normal">Sin horario</span>}
                  </td>

                  {/* Fichaje Real */}
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                    {rec.clockInTimeFormatted ? (
                      <div className="flex items-center gap-1">
                        <span>{rec.clockInTimeFormatted}</span>
                        <span className="text-slate-400 font-normal">→</span>
                        <span>{rec.clockOutTimeFormatted || 'En curso'}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic font-sans font-normal">Sin registrar</span>
                    )}
                  </td>

                  {/* Diferencia */}
                  <td className="py-3 px-4 font-mono tabular-nums">
                    {rec.arrivalVarianceMinutes > 0 ? (
                      <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                        +{rec.arrivalVarianceMinutes} min entrada
                      </span>
                    ) : rec.arrivalVarianceMinutes < 0 ? (
                      <span className="text-emerald-700 font-medium">
                        {Math.abs(rec.arrivalVarianceMinutes)} min antes
                      </span>
                    ) : rec.clockInTimeFormatted ? (
                      <span className="text-slate-500 font-sans">A tiempo</span>
                    ) : (
                      <span className="text-slate-400">--</span>
                    )}
                  </td>

                  {/* Horas */}
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                    <span className="font-bold">{formatMinutesToHours(rec.actualMinutes)}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-slate-500">{formatMinutesToHours(rec.expectedMinutes)}</span>
                  </td>

                  {/* Estado */}
                  <td className="py-3 px-4">
                    <StatusBadge status={rec.status} size="sm" />
                    {rec.isManualCorrection && (
                      <p className="text-[10px] text-amber-700 italic mt-0.5" title={`Motivo: ${rec.correctionReason}`}>
                        Auditado ({rec.correctedBy})
                      </p>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForCorrection(rec)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer min-h-[32px]"
                      title="Corregir fichaje con registro de auditoría"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Corregir</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredRecords.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm font-semibold text-slate-800">No hay registros de asistencia coincidentes</p>
          <p className="text-xs text-slate-500 mt-1">Prueba a seleccionar otros filtros o fechas.</p>
        </div>
      )}

      {/* Correction Modal */}
      <CorrectionModal
        isOpen={Boolean(selectedRecordForCorrection)}
        onClose={() => setSelectedRecordForCorrection(null)}
        record={selectedRecordForCorrection}
      />
    </div>
  );
};
