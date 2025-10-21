import React from 'react';

interface StatusIndicatorProps {
  status: string;
  order?: any;
}

export function StatusIndicator({ status, order }: StatusIndicatorProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'start':
        return { text: 'Ready to help', color: '#10b981', icon: '✅' };
      case 'awaiting_token':
        return { text: 'Choose your token', color: '#f59e0b', icon: '🪙' };
      case 'awaiting_deposit':
        return { text: 'Waiting for deposit', color: '#3b82f6', icon: '⏳' };
      case 'confirming':
        return { text: 'Confirming transaction', color: '#8b5cf6', icon: '🔍' };
      case 'awaiting_bank':
        return { text: 'Provide bank details', color: '#f59e0b', icon: '🏦' };
      case 'ready_to_pay':
        return { text: 'Processing payout', color: '#10b981', icon: '💸' };
      case 'paid':
        return { text: 'Transaction complete', color: '#10b981', icon: '🎉' };
      default:
        return { text: 'Ready', color: '#6b7280', icon: '💬' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      fontSize: '12px',
      fontWeight: '500'
    }}>
      <span style={{ fontSize: '14px' }}>{statusInfo.icon}</span>
      <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>
      {order && (
        <span style={{ color: '#6b7280', marginLeft: 'auto' }}>
          Order: {order.id.slice(0, 8)}...
        </span>
      )}
    </div>
  );
}
