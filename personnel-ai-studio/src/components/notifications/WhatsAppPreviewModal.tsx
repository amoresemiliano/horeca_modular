import React, { useState, useEffect } from 'react';
import { usePersonnel } from '../../context/PersonnelContext';
import { MessageSquare, Copy, ExternalLink, Check, X, ShieldCheck } from 'lucide-react';
import { notificationService } from '../../services/notificationService';

export const WhatsAppPreviewModal: React.FC = () => {
  const { whatsAppModal, closeWhatsAppModal, sendWhatsAppFromModal, addToast } = usePersonnel();
  const [copied, setCopied] = useState(false);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (whatsAppModal.messageText) {
      setEditedText(whatsAppModal.messageText);
    }
  }, [whatsAppModal.messageText]);

  if (!whatsAppModal.isOpen || !whatsAppModal.params) return null;

  const { params } = whatsAppModal;
  const waLink = notificationService.generateWhatsAppLink(params.recipientPhone, editedText);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText);
    setCopied(true);
    addToast('Mensaje copiado', 'Texto copiado al portapapeles listo para enviar.', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    window.open(waLink, '_blank', 'noopener,noreferrer');
    sendWhatsAppFromModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Notificar por WhatsApp</h2>
              <p className="text-xs text-slate-500">Comunicación operativa oficial con el empleado</p>
            </div>
          </div>
          <button
            onClick={closeWhatsAppModal}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Recipient pill & security badge */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Destinatario</p>
              <p className="text-sm font-semibold text-slate-900">{params.recipientName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-medium">Teléfono móvil</p>
              <p className="text-sm font-mono font-medium text-slate-800">{params.recipientPhone}</p>
            </div>
          </div>

          {/* Message preview editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="wa-message" className="text-xs font-semibold text-slate-700">
                Texto del mensaje (previsualización)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="relative rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
              {/* WhatsApp chat balloon mockup */}
              <div className="bg-[#efeae2] p-4 text-sm font-sans">
                <div className="bg-white rounded-xl rounded-tl-xs p-3.5 shadow-xs max-w-[95%] border border-[#e0dbd3]">
                  <textarea
                    id="wa-message"
                    rows={4}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full text-slate-900 text-sm leading-relaxed bg-transparent resize-none border-0 focus:outline-hidden p-0"
                  />
                  <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 mt-1">
                    <span>10:30</span>
                    <span className="text-sky-500">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture note */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              En producción, el mensaje se envía vía <strong>PersonnelNotificationService</strong> a través de la API oficial o enlace directo verificado con registro de auditoría.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={closeWhatsAppModal}
            className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={sendWhatsAppFromModal}
            className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            Registrar como enviado
          </button>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Abrir en WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
