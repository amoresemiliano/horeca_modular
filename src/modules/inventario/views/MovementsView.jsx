import React, { useContext } from 'react';
import { AppContext } from '../store/store';
import AdminFilteredView from '../components/common/AdminFilteredView';

const MovementsView = () => {
    const { state } = useContext(AppContext);

    const filterFields = [
         { id: 'fecha', label: 'Rango de Fecha', type: 'date-range' },
         { id: 'usuario', label: 'Usuario', type: 'select', options: [...new Set(state.movimientos.map(m => m.usuario))] },
         { id: 'tipo', label: 'Tipo', type: 'select', options: ['Ingreso', 'Salida', 'Ajuste'] },
         { id: 'producto', label: 'Producto', type: 'select', options: [...new Set(state.movimientos.map(m => m.producto))] },
         { id: 'almacen', label: 'Almacén', type: 'select', options: ['Palencia', 'Vallecas'] },
    ];
    const columns = [
        { header: 'Fecha y Hora', accessor: 'fecha' },
        { header: 'Usuario', accessor: 'usuario' },
        { header: 'Tipo', accessor: 'tipo' },
        { header: 'Producto', accessor: 'producto' },
        { header: 'Almacén', accessor: 'almacen' },
        { header: 'Cantidad', accessor: 'cantidad', cell: (value) => <span className={value > 0 ? 'text-success' : 'text-danger'}>{value > 0 ? '+' : ''}{value}</span> },
    ];
    
     const movimientosNoProduccion = state.movimientos.filter(m => !(m.tipo === 'Ingreso' && m.almacen === 'Vallecas'));

     return <AdminFilteredView title="Movimientos Totales" data={movimientosNoProduccion} columns={columns} filterFields={filterFields} />;
};

export default MovementsView;