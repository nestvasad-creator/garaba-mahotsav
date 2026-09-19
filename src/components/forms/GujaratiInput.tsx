'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

interface GujaratiInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelGu?: string;
  error?: string;
  helperText?: string;
  isGujarati?: boolean;
}

export const GujaratiInput = React.forwardRef<
  HTMLInputElement,
  GujaratiInputProps
>(
  (
    {
      label,
      labelGu,
      error,
      helperText,
      isGujarati = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">
            {label}
            {labelGu && (
              <span className="ml-1.5 font-normal text-slate-500 font-gujarati">
                ({labelGu})
              </span>
            )}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          {isGujarati && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              <Globe className="w-2.5 h-2.5" />
              ગુજરાતી
            </span>
          )}
        </div>

        <input
          ref={ref}
          {...props}
          className={cn(
            'w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors',
            isGujarati && 'font-gujarati text-sm',
            error && 'border-rose-400 focus:ring-rose-400',
            className
          )}
        />

        {error ? (
          <p className="text-[11px] text-rose-600 mt-0.5">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

GujaratiInput.displayName = 'GujaratiInput';
