import { useEffect, useRef } from 'react';

export default function FinanceDialog({ title, onClose, busy = false, children, size = 'medium' }) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    box.current?.querySelector('button,input,select,textarea')?.focus();
    return () => previous?.focus?.();
  }, []);
  function keyboard(e) {
    if (e.key === 'Escape' && !busy) onClose();
    if (e.key !== 'Tab') return;
    const nodes = [...box.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"],summary')].filter(node => node.getClientRects().length);
    if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
  }
  return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <section ref={box} role="dialog" aria-modal="true" aria-label={title} onKeyDown={keyboard} className={'bg-white text-gray-900 text-sm rounded-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl ' + (size === 'large' ? 'max-w-3xl' : size === 'small' ? 'max-w-xl' : 'max-w-2xl')}>
      <header className="flex shrink-0 justify-between items-center gap-3 px-4 py-2 border-b border-gray-100"><h2 className="text-base font-semibold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar" title="Cerrar" className="w-8 h-8">✕</button></header>
      <div className="overflow-y-auto min-h-0 p-4 space-y-3">{children}</div>
    </section>
  </div>;
}
