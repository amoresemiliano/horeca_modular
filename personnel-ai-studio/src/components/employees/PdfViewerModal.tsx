import React from 'react';
import { X, Download, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { PayrollRecord, EmployeeDocument } from '../../types/personnel';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  payroll?: PayrollRecord;
  document?: EmployeeDocument;
  employeeName?: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  payroll,
  document,
  employeeName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 truncate max-w-md">{title}</h2>
              <p className="text-xs text-slate-500">
                {employeeName} · Acceso autorizado por credenciales de administración
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

        {/* PDF Simulated Sheet */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div className="bg-white w-full max-w-lg p-6 rounded-xl shadow-md border border-slate-200 text-slate-900 space-y-4">
            {/* Header of simulated paper document */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  DOCUMENTO LABORAL OFICIAL
                </p>
                <h3 className="text-base font-extrabold text-slate-900">
                  GRUPO GASTRONÓMICO NORTE S.L.
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">CIF: B-87654321</p>
              </div>
              <div className="text-right font-mono text-xs">
                <p className="font-bold text-slate-800">
                  {payroll ? `NÓMINA ${payroll.month}/${payroll.year}` : title}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Ref: {document?.storageReference || payroll?.storageReference || 'BLUEHOST-DOC-2026'}
                </p>
              </div>
            </div>

            {/* Employee summary */}
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <p>
                <strong>Trabajador/a:</strong> {employeeName}
              </p>
              {payroll && (
                <p>
                  <strong>Período de liquidación:</strong> Mes {payroll.month} / {payroll.year}
                </p>
              )}
            </div>

            {/* Payroll Breakdown Table if payroll */}
            {payroll && (
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">Concepto Salarial</th>
                      <th className="p-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    <tr>
                      <td className="p-2">Salario Base Convenio Hostelería</td>
                      <td className="p-2 text-right">{(payroll.grossSalary * 0.8).toFixed(2)} €</td>
                    </tr>
                    <tr>
                      <td className="p-2">Complemento de Puesto / Turnicidad</td>
                      <td className="p-2 text-right">{(payroll.grossSalary * 0.2).toFixed(2)} €</td>
                    </tr>
                    <tr className="bg-slate-50/50 font-bold">
                      <td className="p-2">Total Devengado (Salario Bruto)</td>
                      <td className="p-2 text-right text-slate-950">{payroll.grossSalary.toFixed(2)} €</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-rose-700">Aportación Seg. Social Trabajador</td>
                      <td className="p-2 text-right text-rose-700">
                        -{((payroll.grossSalary - payroll.netSalary) * 0.4).toFixed(2)} €
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 text-rose-700">Retención IRPF</td>
                      <td className="p-2 text-right text-rose-700">
                        -{((payroll.grossSalary - payroll.netSalary) * 0.6).toFixed(2)} €
                      </td>
                    </tr>
                    <tr className="bg-emerald-50 text-emerald-950 font-bold text-sm">
                      <td className="p-2.5">Líquido Total a Percibir (Neto)</td>
                      <td className="p-2.5 text-right font-extrabold">{payroll.netSalary.toFixed(2)} €</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Coste Empresa */}
            {payroll && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p className="font-semibold text-slate-700">Coste de Empresa:</p>
                <div className="flex justify-between font-mono text-[11px] text-slate-600">
                  <span>Seguridad Social a cargo de la empresa:</span>
                  <span>{payroll.socialSecurityCompany.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-mono text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Coste Total Empleador:</span>
                  <span>{payroll.employerCost.toFixed(2)} €</span>
                </div>
              </div>
            )}

            {/* Security validation badge */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Documento firmado electrónicamente. Custodia segura en Bluehost Document Storage.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            {document?.fileSize || '380 KB'} · PDF protegido
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer"
            >
              Cerrar Visor
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Imprimir / Descargar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
