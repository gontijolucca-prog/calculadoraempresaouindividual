import React from 'react';
import { cn } from '../lib/utils';

/** Input partilhado para todos os simuladores — garante sizing e estilo consistentes. */
export const inputCls = 'w-full px-[14px] py-[11px] bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0677FF] transition-all outline-none';
export const labelCls = 'block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]';
export const selectCls = inputCls;

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
}

export function Field({ label, hint, error, className, ...props }: FieldProps) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={cn(inputCls, error && 'border-red-400', className)} {...props} />
      {hint && <p className="text-[11px] text-[#94A3B8] mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-600 font-[600] mt-1">{error}</p>}
    </div>
  );
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> {
  label: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Select({ label, hint, className, children, ...props }: SelectProps) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={cn(selectCls, className)} {...props}>{children}</select>
      {hint && <p className="text-[11px] text-[#94A3B8] mt-1">{hint}</p>}
    </div>
  );
}
