'use client';

import React from 'react';

interface ProgressBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error';
}

export function ProgressBar({
  value,
  label,
  showPercentage = false,
  size = 'md',
  color = 'primary'
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const colorClasses = {
    primary: 'bg-hui-primary',
    success: 'bg-hui-success',
    warning: 'bg-hui-warning',
    error: 'bg-hui-error',
  };

  const bgClasses = {
    primary: 'bg-hui-primary-light',
    success: 'bg-hui-success-light',
    warning: 'bg-hui-warning-light',
    error: 'bg-hui-error-light',
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm font-medium text-hui-text">{label}</span>}
          {showPercentage && <span className="text-sm font-medium text-hui-text-secondary">{Math.round(clampedValue)}%</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full ${bgClasses[color]}`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
