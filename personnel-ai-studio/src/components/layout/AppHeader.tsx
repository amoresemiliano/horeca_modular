import React from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import {
  Store,
  Tablet,
  Shield,
  Layers,
  Building2,
  ChevronDown,
} from 'lucide-react';

export const AppHeader: React.FC = () => {
  const {
    organization,
    operationalUnits,
    selectedOperationalUnitId,
    setSelectedOperationalUnitId,
    currentRole,
    setCurrentRole,
    setIsKioskMode,
    moduleEntitlement,
    togglePersonnelOnlyEntitlement,
  } = usePersonnel();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Brand & Module Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
                H
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                  HORECA Modular
                </span>
                <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Vegen Digital
                </span>
              </div>
            </div>

            <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

            {/* Current Active Module */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-900 rounded-md text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              <span>Personal & Turnos</span>
            </div>
          </div>

          {/* Zone 2: Multi-Tenant Operational Unit Selector */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <label htmlFor="unit-selector" className="sr-only">
                Seleccionar Unidad Operativa
              </label>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/70 rounded-lg text-xs font-medium text-slate-800 transition-colors border border-slate-200/60 cursor-pointer">
                <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  id="unit-selector"
                  value={selectedOperationalUnitId}
                  onChange={(e) => setSelectedOperationalUnitId(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer pr-1"
                >
                  <option value="all">Todas las unidades ({operationalUnits.length})</option>
                  {operationalUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Zone 3: Role, Entitlement Switch & Kiosk Action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Modular Entitlement Toggle (Product Owner requirement) */}
            <button
              type="button"
              onClick={togglePersonnelOnlyEntitlement}
              title={
                moduleEntitlement.personnelOnly
                  ? 'Vista restringida: El usuario solo ve Personal'
                  : 'Vista completa: Propietario / Admin ve todos los módulos'
              }
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                moduleEntitlement.personnelOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{moduleEntitlement.personnelOnly ? 'Solo Personal' : 'Todos los módulos'}</span>
            </button>

            {/* Role indicator dropdown */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-700">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <select
                aria-label="Rol activo en la sesión"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as any)}
                className="bg-transparent font-medium text-xs text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="PERSONNEL_ADMIN">Admin Personal</option>
                <option value="PLATFORM_SUPERADMIN">SuperAdmin</option>
              </select>
            </div>

            {/* DEDICATED KIOSK MODE TRIGGER */}
            <button
              type="button"
              onClick={() => setIsKioskMode(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.98] rounded-xl shadow-xs transition-all cursor-pointer min-h-[44px]"
            >
              <Tablet className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Modo Fichaje</span>
              <span className="sm:hidden">Fichar</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
