import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { Employee } from '../../types/personnel';
import { KeyRound, X, Check, ShieldCheck, Copy } from 'lucide-react';

interface ResetPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export const ResetPinModal: React.FC<ResetPinModalProps> = ({
  isOpen,
  onClose,
  employee,
}) => {
  const { resetEmployeePin, addToast } = usePersonnel();
  const [newGeneratedPin, setNewGeneratedPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !employee) return null;

  const handleGenerate = async () => {
    const pin = await resetEmployeePin(employee.id);
    setNewGeneratedPin(pin);
  };

  const handleCopy = () => {
    if (!newGeneratedPin) return;
    navigator.clipboard.writeText(newGeneratedPin);
    setCopied(true);
    addToast('PIN copiado', `PIN copiado para entregar a ${employee.personalInfo.firstName}.`, 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setNewGeneratedPin(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Credencial PIN de Empleado</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Empleado: <strong>{employee.personalInfo.firstName} {employee.personalInfo.lastName}</strong>
          </p>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Seguridad Criptográfica</span>
            </div>
            <p>
              Por privacidad y seguridad, el PIN se almacena cifrado y ningún administrador puede leer el valor anterior.
            </p>
          </div>

          {newGeneratedPin ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <p className="text-xs font-semibold text-emerald-800">
                Nuevo PIN de 4 dígitos generado:
              </p>
              <div className="text-3xl font-mono font-extrabold tracking-widest text-slate-950 tabular-nums">
                {newGeneratedPin}
              </div>
              <p className="text-[11px] text-emerald-700">
                Comunícaselo al empleado en persona. Esta clave no volverá a mostrarse en pantalla.
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar PIN'}</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              ¿Deseas invalidar la clave actual y generar un nuevo PIN aleatorio de 4 dígitos para este empleado?
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            {newGeneratedPin ? 'Cerrar' : 'Cancelar'}
          </button>
          {!newGeneratedPin && (
            <button
              type="button"
              onClick={handleGenerate}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
            >
              Generar Nuevo PIN
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
