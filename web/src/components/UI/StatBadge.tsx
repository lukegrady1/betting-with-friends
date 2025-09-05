import React from 'react';

interface StatBadgeProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'error' | 'warning';
  className?: string;
}

export function StatBadge({ label, value, variant = 'default', className = '' }: StatBadgeProps) {
  const variantClasses = {
    default: 'badge-default',
    success: 'badge-success',
    error: 'badge-error',
    warning: 'badge-warning'
  };

  return (
    <div className={`badge ${variantClasses[variant]} ${className}`}>
      <span className="font-semibold">{label}:</span>
      <span className="ml-1.5 font-medium">{value}</span>
    </div>
  );
}