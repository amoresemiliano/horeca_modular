import React from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

export const ModuleEntitlementBanner: React.FC = () => {
  const { moduleEntitlement, togglePersonnelOnlyEntitlement } = usePersonnel();

  if (!moduleEntitlement.personnelOnly) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-200/80 px-4 py-2 text-xs text-amber-900">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Modo Restringido (Derecho de Módulo):</strong> Este perfil solo tiene derecho al módulo <strong>Personal & Control Horario</strong>. Los módulos de Finanzas, Ventas, Producción y Compras permanecen ocultos.
          </span>
        </div>
        <button
          onClick={togglePersonnelOnlyEntitlement}
          className="text-amber-800 font-bold hover:underline shrink-0 cursor-pointer ml-2"
        >
          Desactivar restricción
        </button>
      </div>
    </div>
  );
};
