import React from 'react';

interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  const actions = [
    { id: 'sell', label: 'Sell Tokens', icon: '💰' },
    { id: 'rates', label: 'Check Rates', icon: '📊' },
    { id: 'help', label: 'Get Help', icon: '❓' }
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginBottom: '12px'
    }}>
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: disabled ? '#2A2A2A' : 'linear-gradient(135deg, #9945FF 0%, #00FFA3 100%)',
            border: '1px solid #9945FF',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            color: disabled ? '#666666' : '#FFFFFF',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: disabled ? 'none' : '0 3px 12px rgba(153, 69, 255, 0.3)',
            transform: disabled ? 'none' : 'translateY(0)',
            ':hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 5px 15px rgba(153, 69, 255, 0.5)'
            }
          }}
        >
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
