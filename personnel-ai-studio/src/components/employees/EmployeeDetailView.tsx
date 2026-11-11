import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { StatusBadge } from '../common/StatusBadge';
import { ResetPinModal } from './ResetPinModal';
import { UploadDocumentModal } from './UploadDocumentModal';
import { PdfViewerModal } from './PdfViewerModal';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  KeyRound,
  FileText,
  DollarSign,
  CalendarCheck,
  AlertTriangle,
  UserX,
  FileUp,
  MessageSquare,
  Eye,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { formatMinutesToHours } from '../../services/attendanceCalculator';

interface EmployeeDetailViewProps {
  employeeId: string;
  onBack: () => void;
}

type ProfileTab = 'resumen' | 'asistencia' | 'ausencias' | 'incidencias' | 'nominas' | 'documentos';

export const EmployeeDetailView: React.FC<EmployeeDetailViewProps> = ({ employeeId, onBack }) => {
  const {
    employees,
    attendanceRecords,
    schedules,
    absences,
    incidents,
    payrolls,
    documents,
    operationalUnits,
    openWhatsAppModal,
  } = usePersonnel();

  const [activeTab, setActiveTab] = useState<ProfileTab>('resumen');
  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);

  // PDF Viewer Modal State
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    title: string;
    payroll?: any;
    document?: any;
  }>({ isOpen: false, title: '' });

  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-sm font-semibold text-slate-800">Empleado no encontrado</p>
        <button onClick={onBack} className="mt-2 text-xs font-bold text-amber-600 hover:underline">
          Volver al directorio
        </button>
      </div>
    );
  }

  const unit = operationalUnits.find((u) => u.id === employee.employmentInfo.primaryOperationalUnitId);
  const empAttendance = attendanceRecords.filter((r) => r.employeeId === employee.id);
  const empAbsences = absences.filter((a) => a.employeeId === employee.id);
  const empIncidents = incidents.filter((i) => i.employeeId === employee.id);
  const empPayrolls = payrolls.filter((p) => p.employeeId === employee.id);
  const empDocuments = documents.filter((d) => d.employeeId === employee.id);

  const fullName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer min-h-[36px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Directorio de Empleados</span>
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-xs">
              {employee.personalInfo.firstName[0]}
              {employee.personalInfo.lastName[0]}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{fullName}</h1>
                <StatusBadge
                  status={employee.employmentInfo.employmentStatus}
                  customLabel={
                    employee.employmentInfo.employmentStatus === 'ACTIVE'
                      ? 'Activo'
                      : employee.employmentInfo.employmentStatus === 'ON_LEAVE'
                      ? 'De Baja / Permiso'
                      : 'Inactivo'
                  }
                  size="sm"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1 flex-wrap">
                <span className="text-slate-700 font-semibold">{employee.employmentInfo.position}</span>
                <span>·</span>
                <span>{unit?.name || 'Sede Central'}</span>
                <span>·</span>
                <span className="font-mono">{employee.employmentInfo.weeklyContractedHours}h / semana</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                openWhatsAppModal({
                  employeeId: employee.id,
                  recipientName: employee.personalInfo.firstName,
                  recipientPhone: employee.personalInfo.phone,
                  channel: 'WHATSAPP',
                  templateType: 'CUSTOM',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer min-h-[44px]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Notificar WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setIsResetPinOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer min-h-[44px]"
            >
              <KeyRound className="w-4 h-4 text-slate-500" />
              <span>Restablecer PIN</span>
            </button>
          </div>
        </div>

        {/* Quick Contact & Legal Info strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono font-medium">{employee.personalInfo.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{employee.personalInfo.email}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>DNI/NIE: <strong className="font-mono">{employee.personalInfo.documentId}</strong></span>
          </div>
        </div>
      </div>

      {/* PROFILE TABS */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
        {[
          { id: 'resumen', label: 'Resumen', count: undefined },
          { id: 'asistencia', label: 'Asistencia', count: empAttendance.length },
          { id: 'ausencias', label: 'Ausencias', count: empAbsences.length },
          { id: 'incidencias', label: 'Incidencias', count: empIncidents.length },
          { id: 'nominas', label: 'Nóminas', count: empPayrolls.length },
          { id: 'documentos', label: 'Documentos', count: empDocuments.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ProfileTab)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer min-h-[40px] ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 text-[10px] font-mono text-slate-400">
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: RESUMEN */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Employment Contract info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Condiciones Contractuales
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Tipo de Contrato:</span>
                <span className="font-semibold text-slate-900">{employee.employmentInfo.contractType}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Fecha de Antigüedad:</span>
                <span className="font-mono text-slate-900">{employee.employmentInfo.startDate}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Jornada Semanal:</span>
                <span className="font-mono font-bold text-slate-900">{employee.employmentInfo.weeklyContractedHours} horas</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Coste Hora Estimado:</span>
                <span className="font-mono text-slate-900">{employee.employmentInfo.hourlyCost?.toFixed(2)} €/h</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Salario Bruto Mensual:</span>
                <span className="font-mono font-bold text-slate-900">{employee.employmentInfo.monthlyGrossSalary?.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Operational & PIN Credential info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Control de Fichaje y Terminal
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Estado del PIN:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Configurado (4 dígitos)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                El empleado puede registrar sus turnos en cualquiera de los terminales físicos autorizados.
              </p>
              <button
                type="button"
                onClick={() => setIsResetPinOpen(true)}
                className="mt-2 w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Generar Nuevo PIN Aleatorio
              </button>
            </div>

            {/* Emergency Contact */}
            <div className="pt-2 text-xs space-y-1">
              <p className="text-slate-500 font-medium">Contacto de Emergencia:</p>
              <p className="font-bold text-slate-800">
                {employee.personalInfo.emergencyContactName || 'No especificado'}
              </p>
              <p className="font-mono text-slate-600">
                {employee.personalInfo.emergencyContactPhone || ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ASISTENCIA */}
      {activeTab === 'asistencia' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Historial de Fichajes de {fullName}
          </h3>
          <div className="space-y-2">
            {empAttendance.map((rec) => (
              <div
                key={rec.id}
                className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="font-sans font-bold text-slate-900">{rec.date}</span>
                  <span className="text-slate-400 mx-1.5">|</span>
                  <span className="text-slate-700">
                    {rec.clockInTimeFormatted || '--:--'} → {rec.clockOutTimeFormatted || 'En curso'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-sans">
                    <StatusBadge status={rec.status} size="sm" />
                  </span>
                </div>
              </div>
            ))}
            {empAttendance.length === 0 && (
              <p className="text-xs text-slate-500 p-4 text-center">No hay registros de asistencia previos.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUSENCIAS */}
      {activeTab === 'ausencias' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Solicitudes de Vacaciones y Permisos
          </h3>
          <div className="space-y-2">
            {empAbsences.map((abs) => (
              <div
                key={abs.id}
                className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{abs.absenceTypeLabel}</p>
                  <p className="text-slate-500 font-mono text-[11px]">
                    {abs.startDate} al {abs.endDate}
                  </p>
                  {abs.reasonNotes && <p className="text-slate-600 mt-0.5">{abs.reasonNotes}</p>}
                </div>
                <StatusBadge status={abs.status} size="sm" />
              </div>
            ))}
            {empAbsences.length === 0 && (
              <p className="text-xs text-slate-500 p-4 text-center">Sin ausencias registradas.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INCIDENCIAS */}
      {activeTab === 'incidencias' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Incidencias de Jornada Vinculadas
          </h3>
          <div className="space-y-2">
            {empIncidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{inc.title}</span>
                  <StatusBadge status={inc.status} size="sm" />
                </div>
                <p className="text-slate-600">{inc.description}</p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {inc.date} · Registrada por {inc.createdBy}
                </p>
              </div>
            ))}
            {empIncidents.length === 0 && (
              <p className="text-xs text-slate-500 p-4 text-center">Sin incidencias registradas.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: NÓMINAS */}
      {activeTab === 'nominas' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recibos de Salarios y Nóminas Oficiales
              </h3>
              <p className="text-xs text-slate-500">Custodia documental protegida con desglose salarial</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {empPayrolls.map((pay) => (
              <div
                key={pay.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-sm text-slate-900">
                    Nómina {pay.month}/{pay.year}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-600 font-mono mt-0.5">
                    <span>Bruto: <strong>{pay.grossSalary.toFixed(2)} €</strong></span>
                    <span>·</span>
                    <span>Líquido: <strong className="text-emerald-700">{pay.netSalary.toFixed(2)} €</strong></span>
                    <span>·</span>
                    <span>Coste Empresa: {pay.employerCost.toFixed(2)} €</span>
                  </div>
                  {pay.notes && <p className="text-[11px] text-slate-400 mt-0.5">{pay.notes}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setViewerState({
                        isOpen: true,
                        title: pay.documentPdfName,
                        payroll: pay,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Nómina PDF</span>
                  </button>
                </div>
              </div>
            ))}
            {empPayrolls.length === 0 && (
              <p className="text-xs text-slate-500 p-4 text-center">No hay nóminas registradas para este empleado.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: DOCUMENTOS */}
      {activeTab === 'documentos' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Expediente Digital de Personal
              </h3>
              <p className="text-xs text-slate-500">
                Almacenamiento seguro en servidor Bluehost bajo cifrado y control de accesos
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsUploadDocOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer min-h-[40px]"
            >
              <FileUp className="w-4 h-4 text-amber-400" />
              <span>Subir Documento</span>
            </button>
          </div>

          <div className="space-y-2">
            {empDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 truncate">{doc.title}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-slate-200/80 rounded text-slate-700">
                      {doc.documentType}
                    </span>
                  </div>
                  <p className="text-slate-500 font-mono text-[11px]">
                    Emisión: {doc.issueDate} · Tamaño: {doc.fileSize} · Subido por {doc.uploadedBy}
                  </p>
                  {doc.notes && <p className="text-slate-600">{doc.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setViewerState({
                        isOpen: true,
                        title: doc.title,
                        document: doc,
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ver</span>
                  </button>
                </div>
              </div>
            ))}
            {empDocuments.length === 0 && (
              <p className="text-xs text-slate-500 p-4 text-center">Sin documentos archivados en el expediente.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal: Reset PIN */}
      <ResetPinModal
        isOpen={isResetPinOpen}
        onClose={() => setIsResetPinOpen(false)}
        employee={employee}
      />

      {/* Modal: Upload Document */}
      <UploadDocumentModal
        isOpen={isUploadDocOpen}
        onClose={() => setIsUploadDocOpen(false)}
        employee={employee}
      />

      {/* Modal: PDF Viewer */}
      <PdfViewerModal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState({ isOpen: false, title: '' })}
        title={viewerState.title}
        payroll={viewerState.payroll}
        document={viewerState.document}
        employeeName={fullName}
      />
    </div>
  );
};
