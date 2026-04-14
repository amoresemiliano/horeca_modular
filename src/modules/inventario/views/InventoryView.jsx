import React, { useContext, useMemo } from 'react';
import { AppContext } from '../store/store';

const InventoryView = () => {
    const { state, actions } = useContext(AppContext);
    
    const sortedStock = useMemo(() => {
        return [...state.stock].sort((a,b) => a.producto.localeCompare(b.producto) || a.formato.localeCompare(b.formato));
    }, [state.stock]);

    return (
        <div className="container view-container">
            <h1>Inventario</h1>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Formato</th>
                            <th>Palencia (UDS)</th>
                            <th>Vallecas (UDS)</th>
                            <th>Stock Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedStock.map(item => (
                            <tr key={item.id}>
                                <td data-label="Producto" className="font-semibold">{item.producto}</td>
                                <td data-label="Formato">{item.formato}</td>
                                <td data-label="Palencia (UDS)">
                                    <input type="number" value={item.stockP} 
                                        onChange={e => actions.adjustStock(item.producto, item.formato, 'Palencia', Number(e.target.value), item.stockP)} 
                                        className="planning-input" />
                                </td>
                                <td data-label="Vallecas (UDS)">
                                    <input type="number" value={item.stockV} 
                                        onChange={e => actions.adjustStock(item.producto, item.formato, 'Vallecas', Number(e.target.value), item.stockV)} 
                                        className="planning-input" />
                                </td>
                                <td data-label="Stock Total (Kg)"><strong className="text-strong" style={{color: '#3b82f6'}}>{item.stockTotal_kg} Kg</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InventoryView;