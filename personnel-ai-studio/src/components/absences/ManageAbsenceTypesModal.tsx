import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { AbsenceType } from '../../types/personnel';
import { Settings2, Plus, X, Check, Shield } from 'lucide-react';

interface ManageAbsenceTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageAbsenceTypesModal: React.FC<ManageAbsenceTypesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { absenceTypes, createAbsenceType } = usePersonnel();

  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [requiresDocument, setRequiresDocument] = useState(false);
  const [isPaid, setIsPaid] = useState(true);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    createAbsenceType({
      code: label.toUpperCase().replace(/\s+/g, '_'),
      label: label.trim(),
      color,
      requiresApproval,
      requiresDocument,
      isPaid,
      isActive: true,
    });

    setLabel('');
    setRequiresDocument(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Administrar Tipos de Ausencia</h2>
              <p className="text-xs text-slate-500">Configuración de permisos y bajas laborales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* List of existing types */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tipos de Ausencia Activos ({absenceTypes.length})
            </h3>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {absenceTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="font-semibold text-slate-900">{type.label}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{type.isPaid ? 'Retribuida' : 'No retribuida'}</span>
                    <span>·</span>
                    <span>{type.requiresDocument ? 'Req. justificante' : 'Sin doc.'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form to add a new type */}
          <form onSubmit={handleCreate} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-900">Crear Nuevo Tipo de Ausencia</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nombre del motivo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Mudanza / Traslado"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Color Identificativo
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-8 bg-white border border-slate-200 rounded-xl p-1 cursor-pointer"
                />
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-700 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-[11px]">Requiere aprobación</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresDocument}
                  onChange={(e) => setRequiresDocument(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-[11px]">Req. justificante</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-[11px]">Retribuido</span>
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!label.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Tipo</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
