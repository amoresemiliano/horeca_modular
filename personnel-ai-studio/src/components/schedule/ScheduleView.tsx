import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { ScheduleEditModal } from './ScheduleEditModal';
import { EmployeeSchedule } from '../../types/personnel';
import {
  CalendarDays,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  List,
  Grid3X3,
  CheckCircle2,
} from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

const DAYS_OF_WEEK = [
  { key: '2026-11-02', label: 'Lunes', short: 'Lun 2' },
  { key: '2026-11-03', label: 'Martes', short: 'Mar 3' },
  { key: '2026-11-04', label: 'Miércoles', short: 'Mié 4' },
  { key: '2026-11-05', label: 'Jueves', short: 'Jue 5' },
  { key: '2026-11-06', label: 'Viernes', short: 'Vie 6 (Hoy)', isToday: true },
  { key: '2026-11-07', label: 'Sábado', short: 'Sáb 7' },
  { key: '2026-11-08', label: 'Domingo', short: 'Dom 8' },
];

export const ScheduleView: React.FC = () => {
  const {
    schedules,
    employees,
    selectedOperationalUnitId,
    copyPreviousWeekSchedules,
  } = usePersonnel();

  const [activeViewMode, setActiveViewMode] = useState<'week' | 'list'>('week');
  const [selectedDayKey, setSelectedDayKey] = useState<string>(TODAY_STR);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalDefaultEmpId, setModalDefaultEmpId] = useState<string | undefined>();
  const [modalDefaultDate, setModalDefaultDate] = useState<string | undefined>();
  const [editingSchedule, setEditingSchedule] = useState<EmployeeSchedule | undefined>();

  // Filter employees for current unit
  const visibleEmployees = employees.filter((emp) => {
    if (selectedOperationalUnitId === 'all') return true;
    return (
      emp.employmentInfo.primaryOperationalUnitId === selectedOperationalUnitId ||
      emp.employmentInfo.operationalUnitIds.includes(selectedOperationalUnitId)
    );
  });

  const handleOpenAdd = (empId?: string, date?: string) => {
    setEditingSchedule(undefined);
    setModalDefaultEmpId(empId);
    setModalDefaultDate(date || selectedDayKey);
    setIsModalOpen(true);
  };

  const handleEditSchedule = (sch: EmployeeSchedule) => {
    setEditingSchedule(sch);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Cuadrante de Turnos</span>
            <span>·</span>
            <span>Semana del 2 al 8 de Noviembre de 2026</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Planificación de Horarios
          </h1>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Copy Previous Week Productivity Action */}
          <button
            type="button"
            onClick={copyPreviousWeekSchedules}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs transition-colors cursor-pointer min-h-[44px]"
            title="Copiar los turnos de la semana anterior para todos los empleados"
          >
            <Copy className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Copiar semana anterior</span>
            <span className="sm:hidden">Copiar</span>
          </button>

          {/* Add Shift Action */}
          <button
            type="button"
            onClick={() => handleOpenAdd()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Asignar Turno</span>
          </button>
        </div>
      </div>

      {/* View Switcher Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer min-h-[36px]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-800">
            Semana 45 · Noviembre 2026
          </span>
          <button
            type="button"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer min-h-[36px]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Toggle: Semana / Lista */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveViewMode('week')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[36px] ${
              activeViewMode === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Semana</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[36px] ${
              activeViewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
        </div>
      </div>

      {/* WEEK VIEW (Matrix / Grid) */}
      {activeViewMode === 'week' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto">
          <div className="min-w-[840px]">
            {/* Table Header: Days of the week */}
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <div className="py-3 px-3.5 border-r border-slate-200">Empleado / Puesto</div>
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day.key}
                  className={`py-3 px-2 text-center border-r border-slate-200 last:border-r-0 ${
                    day.isToday ? 'bg-amber-500/10 text-amber-900 font-bold' : ''
                  }`}
                >
                  <p>{day.label}</p>
                  <p className="font-mono text-slate-700 text-[10px] mt-0.5">{day.short}</p>
                </div>
              ))}
            </div>

            {/* Employee Rows */}
            <div className="divide-y divide-slate-100">
              {visibleEmployees.map((emp) => {
                return (
                  <div key={emp.id} className="grid grid-cols-8 items-stretch hover:bg-slate-50/50 transition-colors">
                    {/* Employee Profile Header in Row */}
                    <div className="p-3 border-r border-slate-200 flex flex-col justify-center">
                      <p className="font-bold text-xs text-slate-900 leading-tight truncate">
                        {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {emp.employmentInfo.position}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mt-1">
                        {emp.employmentInfo.weeklyContractedHours}h contrato
                      </p>
                    </div>

                    {/* Day Slots */}
                    {DAYS_OF_WEEK.map((day) => {
                      const daySchedule = schedules.find(
                        (s) => s.employeeId === emp.id && (s.date === day.key || (day.isToday && s.date === TODAY_STR))
                      );

                      return (
                        <div
                          key={day.key}
                          className={`p-2 border-r border-slate-200 last:border-r-0 flex flex-col justify-center min-h-[72px] ${
                            day.isToday ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          {daySchedule ? (
                            <button
                              type="button"
                              onClick={() => handleEditSchedule(daySchedule)}
                              className="w-full text-left p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-2xs group cursor-pointer"
                              title={`${daySchedule.expectedStartTime} – ${daySchedule.expectedEndTime} (${daySchedule.notes || 'Sin notas'})`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                                <span>{daySchedule.expectedStartTime}</span>
                                <span className="text-slate-400 font-normal">→</span>
                                <span>{daySchedule.expectedEndTime}</span>
                              </div>
                              {daySchedule.notes && (
                                <p className="text-[9px] text-slate-400 truncate mt-0.5">
                                  {daySchedule.notes}
                                </p>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAdd(emp.id, day.key)}
                              className="w-full h-full min-h-[48px] rounded-xl border border-dashed border-slate-200 hover:border-slate-400 text-slate-300 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer group"
                              title="Añadir turno para este día"
                            >
                              <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW (Agenda by Day) */
        <div className="space-y-4">
          {/* Day selection tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDayKey(day.key)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors cursor-pointer min-h-[40px] ${
                  selectedDayKey === day.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {day.short}
              </button>
            ))}
          </div>

          {/* List of shifts for selected day */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleEmployees.map((emp) => {
              const sch = schedules.find(
                (s) => s.employeeId === emp.id && s.date === selectedDayKey
              );

              return (
                <div
                  key={emp.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{emp.employmentInfo.position}</p>
                    {sch?.notes && (
                      <p className="text-[11px] text-slate-400 mt-1 italic">{sch.notes}</p>
                    )}
                  </div>

                  {sch ? (
                    <button
                      type="button"
                      onClick={() => handleEditSchedule(sch)}
                      className="text-right p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-mono font-bold text-slate-900">
                        {sch.expectedStartTime} – {sch.expectedEndTime}
                      </p>
                      <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Editar turno</p>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAdd(emp.id, selectedDayKey)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer min-h-[36px]"
                    >
                      + Turno
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal for adding/editing schedule */}
      <ScheduleEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultEmployeeId={modalDefaultEmpId}
        defaultDate={modalDefaultDate}
        existingSchedule={editingSchedule}
      />
    </div>
  );
};
