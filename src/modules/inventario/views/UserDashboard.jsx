import React, { useState, useMemo, useContext } from 'react';
import { AppContext } from '../store/store';
import { FilterGroup, DateRangeFilter, PaginationControls } from '../components/common/Filters';
import RegisterMovementModal from '../components/modals/RegisterMovementModal';
import { EditIcon, TrashIcon } from '../components/Icons';

const UserDashboard = () => {
    const { state, actions } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    const misMovimientos = useMemo(() => {
        let data = state.movimientos.filter(m => m.usuario === 'usuario@elcriollo.com');
        if (dateFilter.start) data = data.filter(m => new Date(m.fecha) >= new Date(dateFilter.start));
        if (dateFilter.end) data = data.filter(m => new Date(m.fecha) <= new Date(dateFilter.end));
        return data;
    }, [state.movimientos, dateFilter]);

    const paginatedData = useMemo(() => misMovimientos.slice(0, itemsPerPage), [misMovimientos, itemsPerPage]);

    const handleEdit = (item) => {
        setEditItem(item);
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setEditItem(null);
    };

    return (
        <div className="container view-container user-dashboard">
            <RegisterMovementModal show={isModalOpen} onClose={handleClose} initialData={editItem} />
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-cta">+ Registrar Movimiento</button>
            
            <div className="filter-bar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Mis Últimos Movimientos</h2>
                <FilterGroup label="Filtrar por Fecha">
                    <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
                </FilterGroup>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Producto</th>
                            <th>Almacén</th>
                            <th>Cantidad</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((item) => (
                            <tr key={item.id}>
                                <td data-label="Fecha">{item.fecha.split(' ')[0]}</td>
                                <td data-label="Tipo">{item.tipo}</td>
                                <td data-label="Producto" className="font-semibold">{item.producto}</td>
                                <td data-label="Almacén">{item.almacen}</td>
                                <td data-label="Cantidad" className={item.cantidad > 0 ? 'text-success' : 'text-danger'}>{item.cantidad > 0 ? '+' : ''}{item.cantidad}</td>
                                <td data-label="Acciones">
                                    <div className="action-btn-group">
                                        <button className="action-btn edit" onClick={() => handleEdit(item)} title="Editar"><EditIcon /></button>
                                        <button className="action-btn delete" onClick={() => actions.deleteMovement(item.id)} title="Eliminar"><TrashIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <PaginationControls itemsPerPage={itemsPerPage} setItemsPerPage={setItemsPerPage} totalItems={misMovimientos.length} />
        </div>
    );
};

export default UserDashboard;