import React, { useState, useRef } from 'react';

interface TipProps {
  children: string;
}

export function Tip({ children }: TipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span className="relative inline-block ml-1.5 align-middle" ref={ref}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-slate-200 text-slate-500 text-[9px] font-[800] cursor-help hover:bg-[#781D1D] hover:text-white transition-colors select-none"
      >?</span>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[9999] w-60 pointer-events-none">
          <div className="bg-[#0F172A] text-white text-[11px] font-[500] leading-relaxed rounded-[10px] px-3 py-2.5 shadow-2xl">
            {children}
          </div>
          <div className="flex justify-center">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#0F172A]" />
          </div>
        </div>
      )}
    </span>
  );
}
