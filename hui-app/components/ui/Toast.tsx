'use client';

import React from 'react';
import { useHui } from '@/lib/huiContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useHui();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-3 w-[90vw] sm:w-auto max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            className="bg-white border border-hui-border shadow-lg rounded-xl p-4 flex items-start gap-3 pointer-events-auto animate-slideUp"
          >
            <div className="flex-shrink-0 mt-0.5">
              {isSuccess && (
                <div className="w-5 h-5 rounded-full bg-hui-success-light text-hui-success flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              )}
              {isError && (
                <div className="w-5 h-5 rounded-full bg-hui-error-light text-hui-error flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
              )}
              {isInfo && (
                <div className="w-5 h-5 rounded-full bg-hui-primary-light text-hui-primary flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm text-hui-text">{toast.message}</p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-hui-text-tertiary hover:text-hui-text transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
