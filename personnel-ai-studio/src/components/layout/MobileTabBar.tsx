import React from 'react';
import { usePersonnel, PersonnelTab } from '../../context/PersonnelContext';
import { Clock, CalendarCheck, CalendarDays, AlertTriangle, Users, UserX } from 'lucide-react';

export const MobileTabBar: React.FC = () => {
  const { activeTab, setActiveTab, incidents, attendanceRecords, absences } = usePersonnel();

  const lateCount = attendanceRecords.filter((r) => r.status === 'RETRASO').length;
  const openIncidents = incidents.filter((i) => i.status === 'ABIERTA').length;
  const pendingAbsences = absences.filter((a) => a.status === 'PENDIENTE').length;

  const tabs: Array<{
    id: PersonnelTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'hoy', label: 'Hoy', icon: Clock, badge: lateCount > 0 ? lateCount : undefined },
    { id: 'asistencia', label: 'Asistencia', icon: CalendarCheck },
    { id: 'horarios', label: 'Horarios', icon: CalendarDays },
    { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, badge: openIncidents > 0 ? openIncidents : undefined },
    { id: 'ausencias', label: 'Ausencias', icon: UserX, badge: pendingAbsences > 0 ? pendingAbsences : undefined },
    { id: 'empleados', label: 'Empleados', icon: Users },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1">
      <div className="grid grid-cols-6 items-center h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center h-full relative cursor-pointer min-h-[44px] transition-colors ${
                isActive ? 'text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-500 stroke-[2.2]' : 'text-slate-500'}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-amber-500 text-slate-950 text-[9px] font-bold font-mono rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-[52px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
