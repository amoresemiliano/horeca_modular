import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../store/store';

const PlanningView = () => {
    const { state } = useContext(AppContext);
    
    const stockByName_kg = useMemo(() => state.stock.reduce((acc, item) => {
        acc[item.producto] = (acc[item.producto] || 0) + item.stockTotal_kg;
        return acc;
    }, {}), [state.stock]);

    const [limits, setLimits] = useState({
        'Cochinita': { min: 30, max: 100 },
        'Birria': { min: 37.5, max: 90 },
        'Pastor': { min: 30, max: 120 },
        'Carnitas': { min: 22.5, max: 75 },
        'Tinga': { min: 15, max: 60 },
    });

    const updateLimit = (prod, field, val) => {
        setLimits(prev => ({ ...prev, [prod]: { ...prev[prod], [field]: Number(val) } }));
    };

    const planData = useMemo(() => {
        return Object.keys(limits).map(prod => {
            const actual = stockByName_kg[prod] || 0;
            const { min, max } = limits[prod];
            let estado = 'ÓPTIMO';
            
            if (actual < min) estado = 'CRÍTICO';
            else if (actual < (min + (max - min) * 0.25)) estado = 'NECESARIO';
            else if (actual > max) estado = 'EXCESO';
            
            let necesidad = '-';
            if (estado === 'CRÍTICO' || estado === 'NECESARIO') {
                necesidad = `Producir ${(max - actual).toFixed(2)} Kg`;
            } else if (estado === 'EXCESO') {
                necesidad = `Reducir ${(actual - max).toFixed(2)} Kg`;
            }
            
            return {
                producto: prod, min, max, actual: actual.toFixed(2), estado, necesidad
            };
        });
    }, [stockByName_kg, limits]);

    const getStatusClass = (estado) => {
        switch(estado) {
            case 'CRÍTICO': return 'status-danger';
            case 'NECESARIO': return 'status-warning';
            case 'ÓPTIMO': return 'status-success';
            case 'EXCESO': return 'status-excess'; 
            default: return '';
        }
    };

    return (
        <div className="container view-container">
            <h1>Plan de Producción</h1>
            <div className="table-container">
                <table>
                    <thead>
                        <tr><th>Producto</th><th>Min (Kg)</th><th>Max (Kg)</th><th>Actual (Kg)</th><th>Estado</th><th>Necesidad</th></tr>
                    </thead>
                    <tbody>
                        {planData.map(p => (
                            <tr key={p.producto} className={getStatusClass(p.estado)}>
                                <td data-label="Producto" className="font-semibold">{p.producto}</td>
                                <td data-label="Min (Kg)"><input type="number" value={p.min} onChange={e => updateLimit(p.producto, 'min', e.target.value)} className="planning-input" /></td>
                                <td data-label="Max (Kg)"><input type="number" value={p.max} onChange={e => updateLimit(p.producto, 'max', e.target.value)} className="planning-input" /></td>
                                <td data-label="Actual (Kg)">{p.actual}</td>
                                <td data-label="Estado" className="font-bold">{p.estado}</td>
                                <td data-label="Necesidad" className="font-bold">{p.necesidad}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PlanningView;