import React, { useState } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { Employee, EmployeeDocumentType } from '../../types/personnel';
import { FileUp, X, UploadCloud, ShieldCheck } from 'lucide-react';
import { TODAY_STR } from '../../data/mockPersonnelData';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

const DOCUMENT_TYPES: Array<{ type: EmployeeDocumentType; label: string }> = [
  { type: 'CONTRATO', label: 'Contrato de Trabajo' },
  { type: 'NOMINA', label: 'Nómina / Recibo Salarial' },
  { type: 'BAJA_MEDICA', label: 'Parte de Baja Médica (IT)' },
  { type: 'ALTA_MEDICA', label: 'Parte de Alta Médica' },
  { type: 'DNI_NIE', label: 'DNI / NIE / Permiso Residencia' },
  { type: 'CERTIFICADO_MEDICO', label: 'Reconocimiento Médico Vigilancia de la Salud' },
  { type: 'MANIPULADOR_ALIMENTOS', label: 'Carnet Manipulador de Alimentos' },
  { type: 'FORMACION_ALERGENOS', label: 'Certificado Formación Alérgenos Horeca' },
  { type: 'PERMISO_TRABAJO', label: 'Autorización de Trabajo' },
  { type: 'OTRO', label: 'Otro Documento' },
];

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  isOpen,
  onClose,
  employee,
}) => {
  const { uploadEmployeeDocument, openWhatsAppModal } = usePersonnel();

  const [docType, setDocType] = useState<EmployeeDocumentType>('CONTRATO');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState(TODAY_STR);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);

  if (!isOpen || !employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsUploading(true);
    const mockFile = fileName || `${docType.toLowerCase()}_${issueDate}.pdf`;

    try {
      await uploadEmployeeDocument(
        employee.id,
        title.trim(),
        docType,
        issueDate,
        mockFile,
        340 * 1024
      );

      if (notifyWhatsApp) {
        openWhatsAppModal({
          employeeId: employee.id,
          recipientName: employee.personalInfo.firstName,
          recipientPhone: employee.personalInfo.phone,
          channel: 'WHATSAPP',
          templateType: 'DOCUMENT_RECEIVED',
          templateData: {
            docTitle: title.trim(),
          },
        });
      }

      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Archivar Documento</h2>
              <p className="text-xs text-slate-500">
                Para: {employee.personalInfo.firstName} {employee.personalInfo.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="doc-type-sel" className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Documento *
            </label>
            <select
              id="doc-type-sel"
              value={docType}
              onChange={(e) => {
                const val = e.target.value as EmployeeDocumentType;
                setDocType(val);
                const matched = DOCUMENT_TYPES.find((d) => d.type === val);
                if (matched && !title) setTitle(matched.label);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-slate-900"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="doc-title-in" className="block text-xs font-semibold text-slate-700 mb-1">
              Título Descriptivo *
            </label>
            <input
              id="doc-title-in"
              type="text"
              required
              placeholder="Ej: Contrato Indefinido 40h firmado"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
            />
          </div>

          <div>
            <label htmlFor="doc-date-in" className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha de Emisión *
            </label>
            <input
              id="doc-date-in"
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
            />
          </div>

          {/* File Picker Zone Simulation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Archivo Digital (PDF) *
            </label>
            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center hover:border-slate-300 transition-colors">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-700 font-medium">
                {fileName || 'Selecciona o arrastra el documento del empleado'}
              </p>
              <button
                type="button"
                onClick={() => setFileName(`${docType.toLowerCase()}_firmado_${Date.now()}.pdf`)}
                className="mt-2 text-xs text-slate-900 font-bold hover:underline cursor-pointer"
              >
                Cargar archivo simulado (PDF)
              </button>
            </div>
          </div>

          {/* Notification checkbox */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <label htmlFor="doc-notify" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Notificar al empleado por WhatsApp
            </label>
            <input
              id="doc-notify"
              type="checkbox"
              checked={notifyWhatsApp}
              onChange={(e) => setNotifyWhatsApp(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Almacenamiento seguro en servidor externo Bluehost con token privado.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading || !title.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer min-h-[44px]"
            >
              {isUploading ? 'Subiendo...' : 'Archivar Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
