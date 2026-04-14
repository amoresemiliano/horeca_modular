import React, { useContext } from 'react';
import { AppContext } from '../store/store';
import AdminFilteredView from '../components/common/AdminFilteredView';

const ProductionView = () => {
    const { state } = useContext(AppContext);

    // 1. SEGURIDAD: Nos aseguramos de que movimientos sea un array siempre
    const movimientos = state?.movimientos || [];
    
    // 2. FILTRO DE DATOS
    const produccionVallecas = movimientos.filter(m => m.tipo === 'Ingreso' && m.almacen === 'Vallecas');

    // 3. CONFIGURACIÓN DE FILTROS (con protección para datos vacíos)
    const filterFields = [
         { id: 'fecha', label: 'Rango de Fecha', type: 'date-range' },
         { id: 'producto', label: 'Producto', type: 'select', options: [...new Set(movimientos.map(item => item.producto || 'Sin Nombre'))] },
         { id: 'formato', label: 'Formato', type: 'select', options: [...new Set(movimientos.map(item => item.formato || 'N/A'))] },
         { id: 'usuario', label: 'Usuario', type: 'select', options: [...new Set(movimientos.map(item => item.usuario || 'Sistema'))] },
    ];

    // 4. COLUMNAS (Aquí corregimos el error del split)
    const columns = [
        { 
          header: 'Fecha', 
          accessor: 'fecha', 
          // Si value existe y es string, hace split. Si no, muestra 'S/F' (Sin Fecha)
          cell: (value) => (value && typeof value === 'string') ? value.split(' ')[0] : 'S/F' 
        },
        { header: 'Producto', accessor: 'producto' },
        { header: 'Formato', accessor: 'formato' },
        { 
          header: 'Cantidad', 
          accessor: 'cantidad', 
          cell: (value) => <span className="text-success font-bold">+{value || 0}</span> 
        },
        { header: 'Usuario', accessor: 'usuario' },
    ];

    return (
        <AdminFilteredView 
            title="Reporte de Producción" 
            data={produccionVallecas} 
            columns={columns} 
            filterFields={filterFields} 
        />
    );
};

export default ProductionView;