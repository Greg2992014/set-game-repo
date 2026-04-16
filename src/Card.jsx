import React from 'react';

const STROKE = { green: '#22c55e', red: '#ef4444', purple: '#a855f7' };

function Shape({ shape, color, fill }) {
  const stroke = STROKE[color];
  const patId = `stripe-${color}`;

  const fillAttr = fill === 'solid' ? stroke
    : fill === 'striped' ? `url(#${patId})`
    : 'none';

  const common = { stroke, strokeWidth: 2.5, fill: fillAttr };

  const pat = (
    <defs>
      <pattern id={patId} patternUnits="userSpaceOnUse" width="5" height="5">
        <line x1="0" y1="0" x2="0" y2="5" stroke={stroke} strokeWidth="1.5" />
      </pattern>
    </defs>
  );

  return (
    <svg viewBox="0 0 100 56" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
      {pat}
      {shape === 'rectangle' && <rect x="8" y="8" width="84" height="40" rx="6" {...common} />}
      {shape === 'oval' && <ellipse cx="50" cy="28" rx="40" ry="20" {...common} />}
      {shape === 'wave' && (
        <path d="M10 28 Q28 10,50 28 T90 28 L90 38 Q72 52,50 38 T10 38 Z" {...common} />
      )}
    </svg>
  );
}

export default function Card({ card, selected, hint, flash, disabled, onClick }) {
  const cls = [
    'card',
    selected && 'selected',
    hint && 'hint',
    flash === 'correct' && 'flash-correct',
    flash === 'incorrect' && 'flash-incorrect',
    disabled && 'disabled',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={disabled ? undefined : onClick} data-id={card.id}>
      <div className="shapes">
        {Array.from({ length: card.count }).map((_, i) => (
          <Shape key={i} shape={card.shape} color={card.color} fill={card.fill} />
        ))}
      </div>
    </div>
  );
}
