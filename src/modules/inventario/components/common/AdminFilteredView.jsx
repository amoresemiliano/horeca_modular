import React, { useState, useMemo } from 'react';
import { FilterBar, FilterGroup, PaginationControls } from './Filters';

const AdminFilteredView = ({ title, data, columns, filterFields }) => {
    const [filters, setFilters] = useState({});
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleFilterChange = (id, value) => {
        setFilters(prev => ({ ...prev, [id]: value }));
    };

    const filteredData = useMemo(() => {
        return data.filter(item => {
            return Object.entries(filters).every(([key, value]) => {
                if (!value || value === 'Todos') return true;
                if (key === 'fecha') {
                    const itemDate = new Date(item.fecha.split(' ')[0]).getTime();
                    const start = value.start ? new Date(value.start).getTime() : 0;
                    const end = value.end ? new Date(value.end).getTime() : Infinity;
                    return itemDate >= start && itemDate <= end;
                }
                return String(item[key]).toLowerCase().includes(String(value).toLowerCase());
            });
        });
    }, [data, filters]);

    const paginatedData = useMemo(() => filteredData.slice(0, itemsPerPage), [filteredData, itemsPerPage]);

    return (
        <div className="container view-container">
            <h1>{title}</h1>
            <FilterBar>
                {filterFields.map(field => (
                     <FilterGroup key={field.id} label={field.label}>
                         {field.type === 'select' && (
                            <select onChange={(e) => handleFilterChange(field.id, e.target.value)} className="filter-select">
                                <option>Todos</option>
                                {field.options?.map(opt => <option key={opt}>{opt}</option>)}
                            </select>
                         )}
                         {field.type === 'date-range' && (
                             <div className="date-range-inputs">
                                <input type="date" onChange={(e) => handleFilterChange(field.id, { ...filters[field.id], start: e.target.value })} className="filter-input" />
                                <span>-</span>
                                <input type="date" onChange={(e) => handleFilterChange(field.id, { ...filters[field.id], end: e.target.value })} className="filter-input" />
                            </div>
                         )}
                     </FilterGroup>
                ))}
            </FilterBar>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>{columns.map(col => <th key={col.accessor}>{col.header}</th>)}</tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((item, index) => (
                            <tr key={index}>
                                {columns.map(col => (
                                    <td key={col.accessor} data-label={col.header}>
                                        {col.cell ? col.cell(item[col.accessor], item) : item[col.accessor]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <PaginationControls itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage} totalItems={filteredData.length} />
        </div>
    );
};

export default AdminFilteredView;