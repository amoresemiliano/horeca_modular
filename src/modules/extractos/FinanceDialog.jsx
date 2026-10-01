import { useEffect, useRef } from 'react';

export default function FinanceDialog({ title, onClose, busy = false, children }) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    box.current?.querySelector('button,input,select,textarea')?.focus();
    return () => previous?.focus?.();
  }, []);
  function keyboard(e) {
    if (e.key === 'Escape' && !busy) onClose();
    if (e.key !== 'Tab') return;
    const nodes = [...box.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
    if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
  }
  return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <section ref={box} role="dialog" aria-modal="true" aria-label={title} onKeyDown={keyboard} className="bg-white text-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl">
      <header className="flex justify-between items-center gap-4"><h2 className="text-lg font-bold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar" title="Cerrar" className="p-2">✕</button></header>
      {children}
    </section>
  </div>;
}
