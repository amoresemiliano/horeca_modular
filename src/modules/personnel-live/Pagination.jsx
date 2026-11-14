import { Field } from '../personal/ui';
import { usePersonnelUi } from './uiState';
import { useEffect } from 'react';

export function pageWindow(total, requestedPage = 1, requestedSize = 10) {
  const size = [10,25,50,'all'].includes(requestedSize) ? requestedSize : 10;
  const pages = size === 'all' ? 1 : Math.max(1, Math.ceil(total / size));
  const page = Math.max(1, Math.min(pages, Math.trunc(Number(requestedPage)) || 1));
  const offset = size === 'all' ? 0 : (page - 1) * size;
  return { page, pages, size, offset, end: size === 'all' ? total : Math.min(total, offset + size), total };
}
export function usePagedList(items, name, filter = '') {
  const [saved, setSaved] = usePersonnelUi(`pages:${name}`, { page:1, size:10, filter });
  useEffect(()=>{if(saved.filter!==filter) setSaved({...saved,page:1,filter});},[filter,saved,setSaved]);
  const window = pageWindow(items.length, saved.filter === filter ? saved.page : 1, saved.size);
  const set = patch => setSaved({ ...saved, ...patch, filter });
  return { ...window, items: items.slice(window.offset, window.end), setPage: page => set({page}), setSize: size => set({page:1,size}) };
}
export default function Pagination({ list, label }) {
  return <div className="per-pagination" role="group" aria-label={`Paginación: ${label}`}>
    <span aria-live="polite">{list.total ? list.offset+1 : 0}–{list.end} de {list.total}</span>
    <Field label="Filas por página"><select value={list.size} onChange={e=>list.setSize(e.target.value==='all'?'all':Number(e.target.value))}>{[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}<option value="all">Todos</option></select></Field>
    <button type="button" aria-label={`Página anterior: ${label}`} disabled={list.page<=1} onClick={()=>list.setPage(list.page-1)}>Anterior</button>
    <span>{list.page} / {list.pages}</span>
    <button type="button" aria-label={`Página siguiente: ${label}`} disabled={list.page>=list.pages} onClick={()=>list.setPage(list.page+1)}>Siguiente</button>
  </div>;
}
