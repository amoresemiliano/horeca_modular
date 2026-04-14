import React from 'react';

export const FilterGroup = ({ label, children }) => (
    <div className="filter-group">
        <label className="filter-label">{label}</label>
        {children}
    </div>
);

export const DateRangeFilter = ({ value, onChange, className }) => (
    <div className={`date-filter ${className || ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="date" value={value.start} onChange={e => onChange({ ...value, start: e.target.value })} className="form-input form-input-sm" title="Fecha inicio" style={{ margin: 0 }} />
        <span style={{ color: '#64748b' }}>-</span>
        <input type="date" value={value.end} onChange={e => onChange({ ...value, end: e.target.value })} className="form-input form-input-sm" title="Fecha fin" style={{ margin: 0 }} />
        <button onClick={() => onChange({ start: '', end: '' })} className="btn btn-secondary btn-sm" title="Limpiar fechas" style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
        </button>
    </div>
);

export const PaginationControls = ({ itemsPerPage, setItemsPerPage, totalItems }) => (
    <div className="pagination">
        <span>Mostrando {Math.min(itemsPerPage, totalItems)} de {totalItems}</span>
        <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="form-select" style={{width: 'auto'}}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={totalItems}>Todos</option>
        </select>
    </div>
);

export const FilterBar = ({ children }) => (
    <div className="filter-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        {children}
    </div>
);