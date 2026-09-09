import React from 'react';
import { STATUSES } from './mockData';

export default function IntelligencePanel({ node, onClose, onAction }) {
  const statusInfo = STATUSES[node.status];

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 'var(--r-xl)', 
      border: '1px solid var(--c-border)', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--r-md)', background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', border: '1px solid var(--c-border)' }}>
            {/* Simple icon based on category */}
            {node.category === 'AI' ? '🤖' : node.category === 'SEARCH' ? '🔍' : node.category === 'LOCAL' ? '📍' : node.category === 'SOCIAL' ? '💬' : '🌐'}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--c-text-1)' }}>{node.name}</h3>
            <div style={{ fontSize: '0.6875rem', color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{node.category}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--c-text-3)' }}>&times;</button>
      </div>

      {/* Content */}
      <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
        
        {/* Status */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--c-text-3)', fontWeight: 600, marginBottom: '0.375rem' }}>Status:</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', background: `${statusInfo.color}15`, color: statusInfo.color, borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusInfo.color }}></span>
            {statusInfo.label.toUpperCase()}
          </div>
        </div>

        {/* Score */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--c-text-3)', fontWeight: 600, marginBottom: '0.375rem' }}>Visibility Score:</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--c-text-1)' }}>{node.score}</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--c-text-4)' }}>/100</span>
          </div>
        </div>

        {/* Dynamic Context (Why it matters / Detected Problem) */}
        {node.status === 'OPPORTUNITY' && node.opportunityContext && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: 'var(--r-md)', border: '1px solid var(--c-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--c-text-2)', fontWeight: 600, marginBottom: '0.25rem' }}>Why it matters:</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--c-text-3)', lineHeight: 1.5 }}>"{node.opportunityContext}"</p>
          </div>
        )}

        {node.status === 'ISSUE' && node.issueContext && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fef2f2', borderRadius: 'var(--r-md)', border: '1px solid #fca5a5' }}>
            <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600, marginBottom: '0.25rem' }}>Detected problem:</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#991b1b', lineHeight: 1.5 }}>{node.issueContext}</p>
          </div>
        )}

        {/* Additional Specific Stats */}
        {node.stats && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--c-text-3)', fontWeight: 600, marginBottom: '0.5rem' }}>Observed:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ background: 'var(--c-bg)', padding: '0.5rem', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{node.stats.prompts}</div>
                <div style={{ fontSize: '0.625rem', color: 'var(--c-text-4)', textTransform: 'uppercase' }}>Prompts</div>
              </div>
              <div style={{ background: 'var(--c-bg)', padding: '0.5rem', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--c-brand)' }}>{node.stats.competitorMentions}</div>
                <div style={{ fontSize: '0.625rem', color: 'var(--c-text-4)', textTransform: 'uppercase' }}>Competitors</div>
              </div>
            </div>
          </div>
        )}

        {node.masterData && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--c-text-4)', textTransform: 'uppercase', fontWeight: 600 }}>Master:</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--c-text-1)', fontWeight: 500 }}>{node.masterData}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: '#b91c1c', textTransform: 'uppercase', fontWeight: 600 }}>Detected:</div>
              <div style={{ fontSize: '0.8125rem', color: '#991b1b', fontWeight: 500 }}>{node.detectedData}</div>
            </div>
          </div>
        )}

        {/* Priority / Potential Impact */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--c-text-3)', fontWeight: 600, marginBottom: '0.375rem' }}>Potential Impact:</div>
          <div style={{ fontWeight: 700, color: node.priority === 'CRITICAL' ? 'var(--c-brand)' : 'var(--c-text-1)', fontSize: '0.875rem' }}>{node.priority.toUpperCase()}</div>
        </div>

      </div>

      {/* Footer / CTA */}
      <div style={{ padding: '1.25rem', borderTop: '1px solid var(--c-border)' }}>
        <button 
          onClick={onAction}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--c-text-1)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--r-md)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background 0.2s'
          }}
        >
          {node.status === 'ISSUE' ? 'Review Fix' : 'Review Opportunity'}
        </button>
      </div>
    </div>
  );
}
