import React, { useState, useMemo, useEffect } from 'react';
import { DateRangeFilter } from '../common/Filters';

const ProductionLineChart = ({ movimientos }) => {
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
    // State to toggle lines. Key = product name, Value = boolean (true=visible)
    const [visibleLines, setVisibleLines] = useState({});

    const { data, products, months, maxVal } = useMemo(() => {
        let filtered = movimientos.filter(m => m.tipo === 'Ingreso');
        if (dateFilter.start) filtered = filtered.filter(m => new Date(m.fecha) >= new Date(dateFilter.start));
        if (dateFilter.end) filtered = filtered.filter(m => new Date(m.fecha) <= new Date(dateFilter.end));

        const labels = [];
        const now = new Date();
        for(let i=11; i>=0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(d.toLocaleString('es-ES', { month: 'short' }));
        }

        const monthlyData = {};
        const productList = ['Cochinita', 'Birria', 'Pastor', 'Carnitas', 'Tinga'];
        
        productList.forEach(p => {
            monthlyData[p] = new Array(12).fill(0);
        });

        let max = 0;
        filtered.forEach(m => {
            if (productList.includes(m.producto)) {
                const d = new Date(m.fecha);
                const monthDiff = (now.getMonth() - d.getMonth()) + (12 * (now.getFullYear() - d.getFullYear()));
                if (monthDiff >= 0 && monthDiff < 12) {
                    const idx = 11 - monthDiff;
                    monthlyData[m.producto][idx] += m.cantidad;
                    if(monthlyData[m.producto][idx] > max) max = monthlyData[m.producto][idx];
                }
            }
        });

        max = Math.ceil(max / 50) * 50 || 100;
        return { data: monthlyData, products: productList, months: labels, maxVal: max };
    }, [movimientos, dateFilter]);

    // Initialize visibility on first load
    useEffect(() => {
        if (Object.keys(visibleLines).length === 0) {
            const initial = {};
            products.forEach(p => initial[p] = true);
            setVisibleLines(initial);
        }
    }, [products]);

    const toggleLine = (p) => {
        setVisibleLines(prev => ({...prev, [p]: !prev[p]}));
    };

    const colors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444'];
    
    const pointsToPath = (arr) => {
        return arr.map((val, i) => {
            const x = (i / (arr.length - 1)) * 500;
            // Add some padding to top and bottom to avoid clipping strokes
            // viewBox is -5 to 205 (height 210)
            const y = 200 - (val / maxVal) * 200;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    }

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
            <div className="card-header">
                <h3>Producción Mensual (kgs)</h3>
                <DateRangeFilter value={dateFilter} onChange={setDateFilter} className="card-filter" />
            </div>
            <div className="chart-container line-chart" style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: '200px', display: 'flex' }}>
                <div className="y-axis" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '10px', paddingBottom: '20px' }}>
                    <span>{maxVal}</span><span>{maxVal/2}</span><span>0</span>
                </div>
                <div className="chart-area" style={{ flex: 1, position: 'relative', paddingBottom: '20px' }}>
                    <svg width="100%" height="100%" viewBox="-5 -5 510 210" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                        {products.map((p, i) => (
                            visibleLines[p] && <path key={p} d={pointsToPath(data[p])} stroke={colors[i]} fill="none" strokeWidth="2.5" />
                        ))}
                    </svg>
                </div>
                <div className="x-axis" style={{ display: 'flex', justifyContent: 'space-between', position: 'absolute', bottom: 0, left: '40px', right: '5px' }}>
                    {months.map((m,i) => <span key={i} style={{ fontSize: '10px', transform: 'translateX(-50%)' }}>{m}</span>)}
                </div>
            </div>
            <div className="chart-legend">
                 {products.map((p, i) => (
                    <div key={p} 
                         className="legend-item" 
                         style={{opacity: visibleLines[p] ? 1 : 0.4, cursor: 'pointer'}} 
                         onClick={() => toggleLine(p)}>
                        <span className="legend-color" style={{backgroundColor: colors[i]}}></span>{p}
                    </div>
                 ))}
            </div>
        </div>
    );
};

export default ProductionLineChart;