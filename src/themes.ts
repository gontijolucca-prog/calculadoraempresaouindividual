export interface Theme {
  id: string;
  name: string;
  nav: {
    bg: string;
    border: string;
    logo: string;
    logoSub: string;
    item: string;
    itemActive: string;
    itemActiveProfile: string;
    itemHover: string;
    footer: string;
  };
  main: { bg: string };
  card: { bg: string; border: string; radius: string; shadow: string };
  topBar: { bg: string; text: string };
  input: { bg: string; border: string; text: string; focus: string };
  label: string;
  accent: string;
  accentText: string;
  heading: string;
  body: string;
  muted: string;
  separator: string;
}

export const themes: Theme[] = [
  {
    id: 'profissional',
    name: 'Profissional',
    nav: {
      bg: 'bg-white',
      border: 'border-slate-200',
      logo: 'text-[#333333]',
      logoSub: 'text-[#781D1D]',
      item: 'text-[#475569] hover:text-[#0F172A] hover:bg-[#0F172A]/10',
      itemActive: 'bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20',
      itemActiveProfile: 'bg-[#0F172A] text-white shadow-md shadow-[#0F172A]/20',
      itemHover: 'hover:text-[#781D1D] hover:bg-[#781D1D]/10',
      footer: 'bg-slate-50 border-slate-100 text-slate-500',
    },
    main: { bg: 'bg-[#F8FAFC]' },
    card: { bg: 'bg-white', border: 'border-[#E2E8F0]', radius: 'rounded-[20px]', shadow: 'shadow-sm' },
    topBar: { bg: '#781D1D', text: 'text-white' },
    input: { bg: 'bg-[#F8FAFC]', border: 'border-[#E2E8F0]', text: 'text-[#0F172A]', focus: 'focus:border-[#0F172A]' },
    label: 'text-[#64748B]',
    accent: '#781D1D',
    accentText: 'text-[#781D1D]',
    heading: 'text-[#0F172A]',
    body: 'text-[#1E293B]',
    muted: 'text-[#64748B]',
    separator: 'border-slate-200',
  },
  {
    id: 'dark-pro',
    name: 'Dark Pro',
    nav: {
      bg: 'bg-[#0F172A]',
      border: 'border-slate-700',
      logo: 'text-white',
      logoSub: 'text-[#3B82F6]',
      item: 'text-slate-400 hover:text-white hover:bg-white/10',
      itemActive: 'bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/30',
      itemActiveProfile: 'bg-slate-700 text-white',
      itemHover: 'hover:text-[#3B82F6] hover:bg-[#3B82F6]/10',
      footer: 'bg-slate-800 border-slate-700 text-slate-400',
    },
    main: { bg: 'bg-[#0F172A]' },
    card: { bg: 'bg-[#1E293B]', border: 'border-[#334155]', radius: 'rounded-[16px]', shadow: 'shadow-xl shadow-black/30' },
    topBar: { bg: '#1e3a5f', text: 'text-white' },
    input: { bg: 'bg-[#0F172A]', border: 'border-[#334155]', text: 'text-white', focus: 'focus:border-[#3B82F6]' },
    label: 'text-slate-400',
    accent: '#3B82F6',
    accentText: 'text-[#3B82F6]',
    heading: 'text-white',
    body: 'text-slate-200',
    muted: 'text-slate-400',
    separator: 'border-slate-700',
  },
  {
    id: 'minimalista',
    name: 'Minimalista',
    nav: {
      bg: 'bg-[#FAFAFA]',
      border: 'border-[#E5E5E5]',
      logo: 'text-black',
      logoSub: 'text-black uppercase tracking-widest text-[9px]',
      item: 'text-[#666] hover:text-black hover:bg-black/5',
      itemActive: 'bg-black text-white',
      itemActiveProfile: 'bg-black text-white',
      itemHover: 'hover:text-black hover:bg-black/5',
      footer: 'bg-[#F2F2F2] border-[#E5E5E5] text-[#999]',
    },
    main: { bg: 'bg-[#F2F2F2]' },
    card: { bg: 'bg-white', border: 'border-black', radius: 'rounded-[2px]', shadow: 'shadow-none' },
    topBar: { bg: '#000000', text: 'text-white' },
    input: { bg: 'bg-white', border: 'border-black', text: 'text-black', focus: 'focus:border-black' },
    label: 'text-[#666] uppercase tracking-widest text-[9px]',
    accent: '#000000',
    accentText: 'text-black',
    heading: 'text-black uppercase tracking-wide',
    body: 'text-[#1A1A1A]',
    muted: 'text-[#666]',
    separator: 'border-[#E5E5E5]',
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    nav: {
      bg: 'bg-[#064E3B]',
      border: 'border-[#065F46]',
      logo: 'text-white',
      logoSub: 'text-[#10B981]',
      item: 'text-emerald-200 hover:text-white hover:bg-white/10',
      itemActive: 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/30',
      itemActiveProfile: 'bg-[#065F46] text-white',
      itemHover: 'hover:text-[#10B981] hover:bg-[#10B981]/10',
      footer: 'bg-[#065F46] border-[#064E3B] text-emerald-300',
    },
    main: { bg: 'bg-[#F0FDF4]' },
    card: { bg: 'bg-white', border: 'border-l-4 border-l-[#10B981] border-t border-r border-b border-t-[#D1FAE5] border-r-[#D1FAE5] border-b-[#D1FAE5]', radius: 'rounded-[12px]', shadow: 'shadow-sm shadow-emerald-100' },
    topBar: { bg: '#064E3B', text: 'text-white' },
    input: { bg: 'bg-[#F0FDF4]', border: 'border-[#A7F3D0]', text: 'text-[#064E3B]', focus: 'focus:border-[#10B981]' },
    label: 'text-[#065F46]',
    accent: '#10B981',
    accentText: 'text-[#059669]',
    heading: 'text-[#064E3B]',
    body: 'text-[#1A3A2A]',
    muted: 'text-[#6EE7B7]',
    separator: 'border-[#D1FAE5]',
  },
  {
    id: 'luxo',
    name: 'Luxo',
    nav: {
      bg: 'bg-[#1C1917]',
      border: 'border-[#292524]',
      logo: 'text-[#F5F5F4]',
      logoSub: 'text-[#D97706]',
      item: 'text-stone-400 hover:text-[#F5F5F4] hover:bg-[#D97706]/10',
      itemActive: 'bg-[#D97706] text-white shadow-md shadow-[#D97706]/30',
      itemActiveProfile: 'bg-[#292524] text-white',
      itemHover: 'hover:text-[#D97706] hover:bg-[#D97706]/10',
      footer: 'bg-[#292524] border-[#3C3836] text-stone-400',
    },
    main: { bg: 'bg-[#F5F5F4]' },
    card: { bg: 'bg-[#FAFAF9]', border: 'border-[#E7E5E4]', radius: 'rounded-[0px]', shadow: 'shadow-none' },
    topBar: { bg: '#1C1917', text: 'text-[#D97706]' },
    input: { bg: 'bg-[#FAFAF9]', border: 'border-[#D6D3D1]', text: 'text-[#1C1917]', focus: 'focus:border-[#D97706]' },
    label: 'text-[#78716C]',
    accent: '#D97706',
    accentText: 'text-[#D97706]',
    heading: 'text-[#1C1917]',
    body: 'text-[#292524]',
    muted: 'text-[#78716C]',
    separator: 'border-[#E7E5E4]',
  },
];

export const defaultTheme = themes[0];
