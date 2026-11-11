import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { Employee, ContractType } from '../../types/personnel';
import { UserPlus, X } from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

interface NewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewEmployeeModal: React.FC<NewEmployeeModalProps> = ({ isOpen, onClose }) => {
  const { operationalUnits, selectedOperationalUnitId, createEmployee } = usePersonnel();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [phone, setPhone] = useState('+34 ');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('Cocina - Chef de Partida');
  const [unitId, setUnitId] = useState(
    selectedOperationalUnitId !== 'all' ? selectedOperationalUnitId : operationalUnits[0].id
  );
  const [contractType, setContractType] = useState<ContractType>('INDEFINIDO');
  const [weeklyHours, setWeeklyHours] = useState(40);
  const [monthlySalary, setMonthlySalary] = useState(1800);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !documentId.trim()) return;

    createEmployee({
      personalInfo: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        documentId: documentId.trim(),
        phone: phone.trim(),
        email: email.trim(),
        emergencyContactName: emergencyContact.trim(),
        emergencyContactPhone: emergencyPhone.trim(),
      },
      employmentInfo: {
        position: position.trim(),
        primaryOperationalUnitId: unitId,
        operationalUnitIds: [unitId],
        startDate: TODAY_STR,
        employmentStatus: 'ACTIVE',
        contractType,
        weeklyContractedHours: Number(weeklyHours),
        monthlyGrossSalary: Number(monthlySalary),
        hourlyCost: Math.round((Number(monthlySalary) / (Number(weeklyHours) * 4.3)) * 10) / 10,
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Dar de Alta Empleado</h2>
              <p className="text-xs text-slate-500">Expediente laboral y credencial de fichaje</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Personal Information */}
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            1. Datos Personales
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
              <input
                type="text"
                required
                placeholder="Ej: Marcos"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
              <input
                type="text"
                required
                placeholder="Ej: Ortiz Cano"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">DNI / NIE *</label>
              <input
                type="text"
                required
                placeholder="48192837K"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Móvil *</label>
              <input
                type="tel"
                required
                placeholder="+34 600..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="correo@..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contacto de Emergencia</label>
              <input
                type="text"
                placeholder="Nombre (Parentesco)"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono Emergencia</label>
              <input
                type="tel"
                placeholder="+34 6..."
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          {/* Employment Information */}
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pt-2 border-t border-slate-100">
            2. Datos Laborales y Centro de Trabajo
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Puesto Operativo *</label>
              <input
                type="text"
                required
                placeholder="Ej: Sala - Camarero"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unidad Operativa *</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-slate-900"
              >
                {operationalUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo Contrato</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-hidden"
              >
                <option value="INDEFINIDO">Indefinido</option>
                <option value="TEMPORAL">Temporal</option>
                <option value="FIJO_DISCONTINUO">Fijo-Discontinuo</option>
                <option value="PRACTICAS">Prácticas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Horas/Semana</label>
              <input
                type="number"
                min={10}
                max={40}
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salario Bruto (€)</label>
              <input
                type="number"
                step={50}
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 rounded-xl text-[11px] text-amber-900">
            <strong>Credencial de Fichaje:</strong> Se configurará con un PIN inicial temporal <strong>1111</strong> para que el empleado pueda fichar inmediatamente desde el terminal kiosco.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer min-h-[44px]"
            >
              Dar de Alta Empleado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
