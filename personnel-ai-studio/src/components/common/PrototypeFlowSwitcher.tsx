import React, { useState } from 'react';
import { usePersonnel, PersonnelTab } from '../../context/PersonnelContext';
import { Sparkles, ChevronRight, X, Play } from 'lucide-react';

interface GuidedFlow {
  id: string;
  name: string;
  description: string;
  action: () => void;
}

export const PrototypeFlowSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    setActiveTab,
    setIsKioskMode,
    setSelectedEmployeeId,
    openWhatsAppModal,
  } = usePersonnel();

  const flows: GuidedFlow[] = [
    {
      id: 'flow-a',
      name: 'Flujo A: Fichaje de Entrada con PIN',
      description: 'Abre el terminal táctil Kiosco para introducir PIN (ej: 1234 María López).',
      action: () => {
        setIsKioskMode(true);
        setIsOpen(false);
      },
    },
    {
      id: 'flow-b',
      name: 'Flujo B: Fichaje de Salida con PIN',
      description: 'Prueba la salida en Kiosco (ej: 1234 si ya fichó, o 6789).',
      action: () => {
        setIsKioskMode(true);
        setIsOpen(false);
      },
    },
    {
      id: 'flow-c',
      name: 'Flujo C: Panel Hoy en Planta',
      description: 'Visualiza de inmediato quién está trabajando, retrasos e incidencias.',
      action: () => {
        setIsKioskMode(false);
        setActiveTab('hoy');
        setSelectedEmployeeId(null);
        setIsOpen(false);
      },
    },
    {
      id: 'flow-d',
      name: 'Flujo D: Planificar Horario',
      description: 'Abre el cuadrante semanal interactivo y asignación de turnos.',
      action: () => {
        setIsKioskMode(false);
        setActiveTab('horarios');
        setSelectedEmployeeId(null);
        setIsOpen(false);
      },
    },
    {
      id: 'flow-e',
      name: 'Flujo E: Revisión de Desviaciones (Real vs Previsto)',
      description: 'Inspecciona la tabla de control horario con diferencias de minutos y horas.',
      action: () => {
        setIsKioskMode(false);
        setActiveTab('asistencia');
        setSelectedEmployeeId(null);
        setIsOpen(false);
      },
    },
    {
      id: 'flow-f',
      name: 'Flujo F: Aprobación de Ausencia & WhatsApp',
      description: 'Gestiona vacaciones o bajas y dispara el mensaje oficial de WhatsApp.',
      action: () => {
        setIsKioskMode(false);
        setActiveTab('ausencias');
        setSelectedEmployeeId(null);
        setIsOpen(false);
      },
    },
    {
      id: 'flow-g',
      name: 'Flujo G: Gestión y Resolución de Incidencia',
      description: 'Revisa olvidos de fichaje o retrasos con resolución auditada.',
      action: () => {
        setIsKioskMode(false);
        setActiveTab('incidencias');
        setSelectedEmployeeId(null);
        setIsOpen(false);
      },
    },
    {
      id: 'flow-h',
      name: 'Flujo H: Ficha de Empleado, Nóminas y Documentos',
      description: 'Expediente completo de María López con nóminas PDF y archivos en Bluehost.',
      action: () => {
        setIsKioskMode(false);
        setActiveTab('empleados');
        setSelectedEmployeeId('emp_01');
        setIsOpen(false);
      },
    },
  ];

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 z-40">
      {isOpen ? (
        <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl p-4 w-80 sm:w-96 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                Guía de Flujos a Demostrar
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {flows.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={flow.action}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 hover:border-amber-400/50 border border-slate-800 transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300">
                    {flow.name}
                  </span>
                  <Play className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {flow.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-bold rounded-full border border-slate-700/80 shadow-lg backdrop-blur-md hover:scale-105 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Probar Flujos (A - H)</span>
        </button>
      )}
    </div>
  );
};
