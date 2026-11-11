import React from 'react';
import { usePersonnel, PersonnelTab } from '../../context/PersonnelContext';
import {
  Clock,
  CalendarCheck,
  CalendarDays,
  AlertTriangle,
  UserX,
  Users,
  Tablet,
  Building,
} from 'lucide-react';

interface NavItem {
  id: PersonnelTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    incidents,
    absences,
    attendanceRecords,
    organization,
    setIsKioskMode,
  } = usePersonnel();

  // Compute live operational badges
  const openIncidentsCount = incidents.filter((i) => i.status === 'ABIERTA').length;
  const pendingAbsencesCount = absences.filter((a) => a.status === 'PENDIENTE').length;
  const lateAttendanceCount = attendanceRecords.filter((a) => a.status === 'RETRASO').length;

  const navItems: NavItem[] = [
    { id: 'hoy', label: 'Hoy', icon: Clock, badgeCount: lateAttendanceCount > 0 ? lateAttendanceCount : undefined },
    { id: 'asistencia', label: 'Asistencia', icon: CalendarCheck },
    { id: 'horarios', label: 'Horarios', icon: CalendarDays },
    { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, badgeCount: openIncidentsCount > 0 ? openIncidentsCount : undefined },
    { id: 'ausencias', label: 'Ausencias', icon: UserX, badgeCount: pendingAbsencesCount > 0 ? pendingAbsencesCount : undefined },
    { id: 'empleados', label: 'Empleados', icon: Users },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-slate-200/90 bg-white min-h-[calc(100vh-4rem)] p-4 select-none">
      {/* Organization Badge */}
      <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-400 tracking-wider">ORGANIZACIÓN</p>
            <p className="text-xs font-bold text-slate-900 truncate">{organization.name}</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="space-y-1 flex-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 tracking-wider">
          CONTROL OPERATIVO
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-amber-400' : 'text-slate-500'
                  }`}
                />
                <span className="tracking-tight">{item.label}</span>
              </div>

              {item.badgeCount !== undefined && item.badgeCount > 0 && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Terminal Kiosk Quick Launch Card */}
      <div className="pt-4 border-t border-slate-100">
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
              <Tablet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">Terminal Kiosco</p>
              <p className="text-[11px] text-slate-400">Fichaje con PIN</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
            Abre la pantalla táctil optimizada para tablet o mostrador de restaurante.
          </p>
          <button
            onClick={() => setIsKioskMode(true)}
            className="w-full py-2 px-3 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
          >
            Abrir Terminal
          </button>
        </div>
      </div>
    </aside>
  );
};
