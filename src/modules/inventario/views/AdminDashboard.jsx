import React, { useContext, useMemo } from 'react';
import { AppContext } from '../store/store';
import ProductionLineChart from '../components/charts/ProductionLineChart';
import StockBarChart from '../components/charts/StockBarChart';

const ListItem = ({ label, value, valueClass = "value-red" }) => (
    <li><span className="list-label">{label}</span><span className={`list-value ${valueClass}`}>{value}</span></li>
);

const AdminDashboard = () => {
    const { state } = useContext(AppContext);
    const { movimientos, stock } = state;

    const stockByName_kg = useMemo(() => stock.reduce((acc, item) => {
        acc[item.producto] = (acc[item.producto] || 0) + item.stockTotal_kg;
        return acc;
    }, {}), [stock]);

    const plan = useMemo(() => {
        const defaults = {
            'Cochinita': { min: 30, max: 100 },
            'Birria': { min: 37.5, max: 90 },
            'Pastor': { min: 30, max: 120 },
            'Carnitas': { min: 22.5, max: 75 },
            'Tinga': { min: 15, max: 60 },
        };
        
        return Object.keys(defaults).map(prod => {
            const actual = stockByName_kg[prod] || 0;
            const { min, max } = defaults[prod];
            let estado = 'ÓPTIMO';
            if (actual < min) estado = 'CRÍTICO';
            else if (actual < (min + (max - min) * 0.25)) estado = 'NECESARIO';
            else if (actual > max) estado = 'EXCESO';

            const diff = max - actual;
            const necesidadStr = diff > 0 ? `Producir ${diff.toFixed(2)} Kg` : '-';

            return {
                id: prod, 
                producto: prod, 
                estado, 
                necesidad: actual < min ? necesidadStr : (estado === 'NECESARIO' ? necesidadStr : '-')
            };
        });
    }, [stockByName_kg]);

    const ultimasProduccionesKg = useMemo(() => {
        const ingresosVallecas = movimientos.filter(m => m.tipo === 'Ingreso' && m.almacen === 'Vallecas');
        const recents = ingresosVallecas.slice(0, 4);
        
        return recents.map(m => {
            const formatoItem = state.formatos.find(f => f.nombre === m.formato);
            const pesoKg = formatoItem ? parseFloat(formatoItem.peso_kg) : 1;
            const totalKg = m.cantidad * pesoKg;
            return { ...m, totalKg: totalKg.toFixed(2) };
        });
    }, [movimientos, state.formatos]);

    const ultimosMovsConFormato = movimientos.slice(0, 4);

    return (
        <div className="container view-container">
            <h1>Dashboard</h1>
            <div className="dashboard-grid">
                <div className="card">
                    <h3>Últimos Movimientos</h3>
                    <ul>
                        {ultimosMovsConFormato.map(m => (
                            <ListItem key={m.id} label={`${m.producto} - ${m.formato}`} value={`${m.tipo==='Ingreso'?'+':''}${m.cantidad}`} />
                        ))}
                    </ul>
                </div>
                <div className="card">
                    <h3>Stock Actual (Total)</h3>
                    <ul>
                        {Object.entries(stockByName_kg).slice(0,4).map(([n, t]) => (
                            <ListItem key={n} label={n} value={`${t.toFixed(2)} Kg`} valueClass="value-gray" />
                        ))}
                    </ul>
                </div>
                <div className="card">
                    <h3>Necesidad Producción</h3>
                    <ul>
                        {plan.filter(p => p.estado === 'CRÍTICO' || p.estado === 'NECESARIO').length === 0 
                            ? <li><span className="list-label">Todo OK</span></li> 
                            : plan.filter(p => p.estado === 'CRÍTICO' || p.estado === 'NECESARIO').slice(0,4).map(p => (
                                <ListItem key={p.id} label={p.producto} value={p.necesidad} valueClass={p.estado === 'CRÍTICO' ? 'value-red' : 'value-orange'} />
                            ))
                        }
                    </ul>
                </div>
                <div className="card">
                    <h3>Últimas Producciones</h3>
                    <ul>
                        {ultimasProduccionesKg.map(m => (
                            <ListItem key={m.id} label={m.producto} value={`+${m.totalKg} Kg`} valueClass="value-green" />
                        ))}
                    </ul>
                </div>
            </div>
            <div className="charts-grid">
                <ProductionLineChart movimientos={movimientos} />
                <StockBarChart stock={stock} />
            </div>
        </div>
    );
};

export default AdminDashboard;