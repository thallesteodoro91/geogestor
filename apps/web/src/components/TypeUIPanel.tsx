import { useState } from 'react';

const expandedStyle = {
  position: 'fixed',
  left: '50%',
  bottom: '24px',
  transform: 'translateX(-50%)',
  zIndex: 2147483647,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '10px 16px',
  background: 'rgba(24,24,27,.92)',
  color: '#fff',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: '9999px',
  font: '500 14px/20px system-ui,sans-serif',
  boxShadow: '0 10px 24px rgba(0,0,0,.25)',
  whiteSpace: 'nowrap',
} as const;

const minimizedStyle = {
  position: 'fixed',
  right: '24px',
  bottom: '24px',
  left: 'auto',
  transform: 'none',
  zIndex: 2147483647,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '44px',
  height: '44px',
  padding: 0,
  background: 'rgba(24,24,27,.92)',
  color: '#fff',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: '9999px',
  font: '500 14px/20px system-ui,sans-serif',
  boxShadow: '0 10px 24px rgba(0,0,0,.25)',
  whiteSpace: 'nowrap',
} as const;

const iconStyle = {
  width: '18px',
  height: '18px',
  display: 'block',
} as const;

export function TypeUIPanel() {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <button
        type="button"
        aria-label="Maximize TypeUI panel"
        onClick={() => setMinimized(false)}
        style={{ ...minimizedStyle, border: 0, cursor: 'pointer' }}
      >
        <img src="https://www.typeui.sh/logo.svg" alt="TypeUI" style={iconStyle} />
      </button>
    );
  }

  return (
    <div style={expandedStyle}>
      <img src="https://www.typeui.sh/logo.svg" alt="TypeUI" style={iconStyle} />
      <span>TypeUI</span>
      <button
        type="button"
        aria-label="Minimize TypeUI panel"
        onClick={() => setMinimized(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          marginLeft: '2px',
          border: 0,
          borderRadius: '9999px',
          background: 'rgba(255,255,255,.14)',
          color: '#fff',
          cursor: 'pointer',
          font: '700 14px/20px system-ui,sans-serif',
        }}
      >
        -
      </button>
    </div>
  );
}
