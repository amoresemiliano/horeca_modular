import React, { useMemo } from 'react';

const StockBarChart = ({ stock }) => {
    const productosBase = ['Cochinita', 'Birria', 'Pastor', 'Carnitas', 'Tinga', 'Tuna', 'Picadillo', 'Champiñón'];
    const colorsMap = {
        'Cochinita': '#3b82f6', 'Birria': '#10b981', 'Pastor': '#f97316', 
        'Carnitas': '#8b5cf6', 'Tinga': '#ef4444', 'Tuna': '#ec4899', 
        'Picadillo': '#14b8a6', 'Champiñón': '#f59e0b'
    };

    const relevantStock = useMemo(() => {
        const stockByName = stock.reduce((acc, item) => {
            acc[item.producto] = (acc[item.producto] || 0) + (item.stockTotal_kg || item.stockTotal || 0);
            return acc;
        }, {});
        
        Object.keys(stockByName).forEach(p => {
            if (!productosBase.includes(p)) productosBase.push(p);
        });

        return productosBase.map(p => ({
            nombre: p,
            total: stockByName[p] || 0,
            color: colorsMap[p] || '#cbd5e1'
        }));
    }, [stock]);

    const maxStock = relevantStock.length > 0 ? Math.max(...relevantStock.map(s => s.total)) : 1;

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '250px' }}>
            <div className="card-header">
                <h3 style={{ margin: 0 }}>Stock Global (Kg)</h3>
            </div>
            <div className="chart-container bar-chart" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '20px', overflowX: 'auto', padding: '30px 10px 10px', minHeight: '180px', alignItems: 'flex-end', marginTop: '10px' }}>
                {relevantStock.map((item) => {
                    const heightPercent = maxStock > 0 ? (item.total / maxStock) * 100 : 0;
                    return (
                        <div key={item.nombre} className="bar-item" style={{ flex: '1 0 45px', maxWidth: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div className="bar-wrapper" style={{ height: '150px', width: '100%', maxWidth: '50px', backgroundColor: '#f1f5f9', borderRadius: '6px', position: 'relative', display: 'flex', alignItems: 'flex-end', margin: '0 auto' }}>
                                <div className="bar" style={{ height: `${heightPercent}%`, width: '100%', backgroundColor: item.color, borderRadius: '6px', transition: 'height 0.3s', position: 'relative' }}>
                                    {/* Posicionamos el número de forma absoluta respecto a toda la columna (bar-wrapper) para asegurar que siempre quede AFUERA de la barra */}
                                </div>
                                <span className="bar-value" style={{ position: 'absolute', bottom: `calc(${heightPercent}% + 5px)`, left: '50%', transform: 'translateX(-50%)', fontSize: '0.8rem', fontWeight: 'bold', color: '#334155' }}>
                                    {item.total > 0 ? item.total.toFixed(1) : '0'}
                                </span>
                            </div>
                            <span className="bar-label" style={{ fontSize: '0.75rem', marginTop: '8px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', color: '#475569' }}>{item.nombre}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default StockBarChart;