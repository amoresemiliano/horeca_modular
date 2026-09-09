import React, { useState } from 'react';
import { CATEGORIES, MOCK_CHANNELS, SUMMARY_METRICS, TOP_OPPORTUNITIES, STATUSES } from './mockData';
import PresenceMap from './PresenceMap';
import IntelligencePanel from './IntelligencePanel';

export default function PresenceApp() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedNode, setSelectedNode] = useState(null);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);

  const filteredChannels = activeCategory === 'All' 
    ? MOCK_CHANNELS 
    : MOCK_CHANNELS.filter(c => c.category === activeCategory);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleReviewAction = () => {
    setActionDrawerOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* Top Header / Subtitle */}
      <div style={{ padding: '0 0 1.5rem 0', borderBottom: '1px solid var(--c-border)', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--c-text-1)' }}>Digital Presence Map</h2>
        <p style={{ margin: 0, color: 'var(--c-text-3)', fontSize: '0.875rem' }}>
          See where your business exists, where it is weak and where the next opportunity is.
        </p>
      </div>

      {/* Top Summary Metrics */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {Object.entries(SUMMARY_METRICS).map(([key, value]) => (
          <div key={key} style={{ 
            background: 'var(--c-bg)', padding: '0.75rem 1rem', borderRadius: 'var(--r-lg)', 
            border: '1px solid var(--c-border)', flex: '1 1 120px', minWidth: '120px'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--c-brand)' }}>{value}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--c-text-4)', fontWeight: 600, letterSpacing: '0.05em' }}>
              {key}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '999px',
              border: '1px solid',
              borderColor: activeCategory === cat ? 'var(--c-brand)' : 'var(--c-border)',
              background: activeCategory === cat ? 'var(--c-brand-light)' : 'transparent',
              color: activeCategory === cat ? 'var(--c-brand)' : 'var(--c-text-2)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, gap: '1.5rem', minHeight: '500px' }}>
        
        {/* Presence Network Map */}
        <div style={{ flex: 1, background: 'var(--c-bg)', borderRadius: 'var(--r-xl)', border: '1px solid var(--c-border)', position: 'relative', overflow: 'hidden' }}>
          <PresenceMap 
            channels={MOCK_CHANNELS} 
            activeCategory={activeCategory} 
            selectedNode={selectedNode}
            onNodeClick={handleNodeClick}
          />
          
          {/* Legend overlay */}
          <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(255,255,255,0.9)', padding: '0.75rem', borderRadius: 'var(--r-md)', fontSize: '0.75rem', border: '1px solid var(--c-border)', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--c-text-1)' }}>Legend</div>
            {Object.values(STATUSES).map(st => (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color }}></span>
                <span style={{ color: 'var(--c-text-3)' }}>{st.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Intelligence */}
        {selectedNode && (
          <div style={{ width: '320px', flexShrink: 0 }}>
            <IntelligencePanel 
              node={selectedNode} 
              onClose={() => setSelectedNode(null)} 
              onAction={handleReviewAction} 
            />
          </div>
        )}
      </div>

      {/* Bottom Strip: Top Opportunities */}
      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--c-border)', paddingTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--c-text-1)' }}>Top Opportunities</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {TOP_OPPORTUNITIES.map(opp => (
            <div key={opp.id} style={{ flex: 1, minWidth: '250px', background: 'var(--c-brand-light)', border: '1px solid rgba(226,35,26,0.1)', padding: '1rem', borderRadius: 'var(--r-lg)' }}>
              <div style={{ fontWeight: 700, color: 'var(--c-brand)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{opp.id}. {opp.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--c-text-3)' }}>{opp.subtitle}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Drawer Mock */}
      {actionDrawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 100, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Action Drawer</h3>
            <button onClick={() => setActionDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--c-text-2)', lineHeight: 1.5 }}>
              Executing action for <strong>{selectedNode?.name}</strong>.
            </p>
            {/* Form or workflow would go here */}
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--c-bg)', borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
               {selectedNode?.status === 'ISSUE' ? 'Resolving data inconsistency...' : 'Initiating opportunity workflow...'}
            </div>
          </div>
          <button 
            onClick={() => {
              // Simulated action: update mock data state here if we were using a global context
              alert('Action executed (Mock). State would be updated now.');
              setActionDrawerOpen(false);
            }}
            style={{ padding: '0.75rem', background: 'var(--c-brand)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 600, cursor: 'pointer' }}
          >
            Confirm Action
          </button>
        </div>
      )}
      
      {/* Drawer Overlay */}
      {actionDrawerOpen && (
        <div onClick={() => setActionDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }} />
      )}
    </div>
  );
}
