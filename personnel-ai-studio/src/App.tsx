import React from 'react';
import { PersonnelProvider, usePersonnel } from './context/PersonnelContext';
import { AppHeader } from './components/layout/AppHeader';
import { Sidebar } from './components/layout/Sidebar';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { ModuleEntitlementBanner } from './components/layout/ModuleEntitlementBanner';
import { TodayDashboard } from './components/today/TodayDashboard';
import { AttendanceAdminView } from './components/attendance/AttendanceAdminView';
import { ScheduleView } from './components/schedule/ScheduleView';
import { IncidentsView } from './components/incidents/IncidentsView';
import { AbsencesView } from './components/absences/AbsencesView';
import { EmployeeDirectoryView } from './components/employees/EmployeeDirectoryView';
import { KioskClockInView } from './components/kiosk/KioskClockInView';
import { WhatsAppPreviewModal } from './components/notifications/WhatsAppPreviewModal';
import { ToastContainer } from './components/common/Toast';
import { PrototypeFlowSwitcher } from './components/common/PrototypeFlowSwitcher';

const MainPersonnelApp: React.FC = () => {
  const { isKioskMode, activeTab } = usePersonnel();

  // If Kiosk Mode is active, isolate terminal screen without admin chrome
  if (isKioskMode) {
    return (
      <>
        <KioskClockInView />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900 pb-16 md:pb-0">
      {/* Top Application Bar */}
      <AppHeader />

      {/* Modular Entitlement Banner (if restricted mode is active) */}
      <ModuleEntitlementBanner />

      {/* Application Shell: Sidebar + Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {activeTab === 'hoy' && <TodayDashboard />}
          {activeTab === 'asistencia' && <AttendanceAdminView />}
          {activeTab === 'horarios' && <ScheduleView />}
          {activeTab === 'incidencias' && <IncidentsView />}
          {activeTab === 'ausencias' && <AbsencesView />}
          {activeTab === 'empleados' && <EmployeeDirectoryView />}
        </main>
      </div>

      {/* Mobile Navigation Bar (thumb ergonomics) */}
      <MobileTabBar />

      {/* Shared Modals and Notifications */}
      <WhatsAppPreviewModal />
      <ToastContainer />
      <PrototypeFlowSwitcher />
    </div>
  );
};

export default function App() {
  return (
    <PersonnelProvider>
      <MainPersonnelApp />
    </PersonnelProvider>
  );
}
