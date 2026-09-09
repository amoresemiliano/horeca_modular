import React, { useMemo, useState } from 'react';
import { STATUSES, CATEGORIES } from './mockData';

export default function PresenceMap({ channels, activeCategory, selectedNode, onNodeClick }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  // Position calculation for 2D Map
  const nodes = useMemo(() => {
    const center = { x: 400, y: 300 }; // ViewBox center
    const radiusMap = {
      'CRITICAL': 80,
      'HIGH': 150,
      'MEDIUM': 220,
      'MONITOR': 280
    };

    const categoryAngles = {};
    CATEGORIES.forEach((cat, index) => {
      categoryAngles[cat] = (index * (Math.PI * 2)) / CATEGORIES.length;
    });

    return channels.map(channel => {
      // Calculate base angle by category, add some spread based on name length to avoid overlap
      const baseAngle = categoryAngles[channel.category];
      const spread = (channel.name.length % 5 - 2) * 0.15; 
      const angle = baseAngle + spread;
      
      const r = radiusMap[channel.priority] || 200;
      
      return {
        ...channel,
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r
      };
    });
  }, [channels]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', cursor: 'grab' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--c-brand)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--c-brand)" stopOpacity="0" />
          </radialGradient>
          {/* Subtle grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--c-border)" strokeWidth="0.5" strokeOpacity="0.5"/>
          </pattern>
        </defs>

        <rect width="800" height="600" fill="url(#grid)" />

        {/* Central Node - Nova Hábitat */}
        <g transform="translate(400, 300)">
          <circle r="60" fill="url(#centerGlow)" />
          <circle r="30" fill="#fff" stroke="var(--c-border)" strokeWidth="1" />
          <text y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--c-text-1)">Nova</text>
          <text y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--c-text-1)">Hábitat</text>
        </g>

        {/* Connections (Lines from center to nodes) */}
        {nodes.map(node => {
          const isFaded = activeCategory !== 'All' && node.category !== activeCategory;
          if (isFaded) return null; // Or draw very faint lines
          
          return (
            <line 
              key={`link-${node.id}`} 
              x1="400" y1="300" 
              x2={node.x} y2={node.y} 
              stroke={STATUSES[node.status]?.color || 'var(--c-border)'} 
              strokeWidth={selectedNode?.id === node.id || hoveredNode?.id === node.id ? 2 : 0.5}
              strokeOpacity={0.2}
              strokeDasharray={node.status === 'MISSING' || node.status === 'OPPORTUNITY' ? '4,4' : 'none'}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const statusInfo = STATUSES[node.status];
          const isSelected = selectedNode?.id === node.id;
          const isHovered = hoveredNode?.id === node.id;
          const isFaded = activeCategory !== 'All' && node.category !== activeCategory;
          
          const opacity = isFaded ? 0.15 : 1;
          const radius = (node.priority === 'CRITICAL' || node.priority === 'HIGH') ? 14 : 10;
          const color = statusInfo?.color || '#ccc';

          return (
            <g 
              key={`node-${node.id}`} 
              transform={`translate(${node.x}, ${node.y})`}
              opacity={opacity}
              onClick={() => onNodeClick(node)}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s, transform 0.2s' }}
            >
              {/* Pulse effect if selected or hovered */}
              {(isSelected || isHovered) && (
                <circle r={radius + 6} fill={color} opacity="0.15" />
              )}
              
              {/* Main Node Circle */}
              <circle 
                r={radius} 
                fill={node.status === 'MISSING' ? '#fff' : color} 
                stroke={color} 
                strokeWidth={2}
                strokeDasharray={node.status === 'MISSING' ? '2,2' : 'none'}
              />
              
              {/* Icon / Initial inside circle */}
              <text 
                y="3" 
                textAnchor="middle" 
                fontSize={radius * 0.8} 
                fontWeight="700" 
                fill={node.status === 'MISSING' ? color : '#fff'}
                style={{ userSelect: 'none' }}
              >
                {node.name.charAt(0)}
              </text>

              {/* Label */}
              <text 
                y={radius + 14} 
                textAnchor="middle" 
                fontSize="9" 
                fontWeight={isSelected ? 700 : 500} 
                fill={isSelected ? 'var(--c-text-1)' : 'var(--c-text-2)'}
                style={{ userSelect: 'none' }}
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
