/**
 * Renderer único do deck — usado no editor, no PDF impresso e na página pública.
 *
 * Os cards têm 16:9 e todas as medidas são em `cqw` (percentagem da largura do
 * card), por isso o mesmo markup fica igual a 375px, a 1440px e em A4.
 */
import React from 'react';
import type { DeckCard, DeckTheme } from '../../lib/deck/types';

export interface DeckBrand {
  nome: string;
  corPrimaria: string;
  logoDataUrl?: string;
  email?: string;
  telefone?: string;
  website?: string;
}

interface ThemeColors {
  bg: string;
  fg: string;
  muted: string;
  soft: string;
  accent: string;
  onAccent: string;
}

export function themeColors(tema: DeckTheme, brand: DeckBrand): ThemeColors {
  const accent = brand.corPrimaria || '#0677FF';
  if (tema === 'escuro') {
    return { bg: '#0B1220', fg: '#F8FAFC', muted: '#94A3B8', soft: 'rgba(255,255,255,0.06)', accent, onAccent: '#FFFFFF' };
  }
  if (tema === 'brand') {
    return { bg: accent, fg: '#FFFFFF', muted: 'rgba(255,255,255,0.78)', soft: 'rgba(255,255,255,0.14)', accent: '#FFFFFF', onAccent: accent };
  }
  return { bg: '#FFFFFF', fg: '#0F172A', muted: '#64748B', soft: '#F1F5F9', accent, onAccent: '#FFFFFF' };
}

function Logo({ brand, size = 5.2 }: { brand: DeckBrand; size?: number }) {
  if (brand.logoDataUrl) {
    return <img src={brand.logoDataUrl} alt={brand.nome} style={{ height: `${size}cqw`, maxWidth: `${size * 4}cqw`, objectFit: 'contain' }} />;
  }
  const initials = (brand.nome || 'E360')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <div
      className="flex items-center justify-center font-[800]"
      style={{
        width: `${size}cqw`,
        height: `${size}cqw`,
        borderRadius: `${size * 0.28}cqw`,
        background: 'rgba(127,127,127,0.14)',
        fontSize: `${size * 0.42}cqw`,
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </div>
  );
}

const cardBase: React.CSSProperties = {
  containerType: 'inline-size',
  aspectRatio: '16 / 9',
  width: '100%',
};

function Frame({ card, tema, brand, index, total, children }: {
  card: DeckCard;
  tema: DeckTheme;
  brand: DeckBrand;
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  const t = themeColors(tema, brand);
  return (
    <div className="deck-card relative w-full overflow-hidden" style={{ ...cardBase, background: t.bg, color: t.fg }}>
      {/* cunha de cor — identidade própria, não cópia de layout alheio */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 90% at 100% 0%, ${t.accent}2e, transparent 62%)`,
          pointerEvents: 'none',
        }}
      />
      <div className="relative h-full w-full flex flex-col" style={{ padding: '5.4cqw 6cqw' }}>
        {children}
        {card.kind !== 'cover' && (
          <div className="mt-auto flex items-center justify-between" style={{ paddingTop: '3cqw', color: t.muted, fontSize: '1.35cqw' }}>
            <span>{brand.nome}</span>
            <span>{index + 1} / {total}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Kicker({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="font-[700] uppercase" style={{ color, letterSpacing: '0.16em', fontSize: '1.5cqw', marginBottom: '2cqw' }}>
      {children}
    </div>
  );
}

export function DeckCardView({ card, tema, brand, index = 0, total = 1 }: {
  card: DeckCard;
  tema: DeckTheme;
  brand: DeckBrand;
  index?: number;
  total?: number;
}) {
  const t = themeColors(tema, brand);
  const items = card.items ?? [];

  if (card.kind === 'cover') {
    return (
      <Frame card={card} tema={tema} brand={brand} index={index} total={total}>
        <div className="flex items-center justify-between">
          <Logo brand={brand} />
          <span style={{ color: t.muted, fontSize: '1.6cqw', fontWeight: 600 }}>{brand.website || ''}</span>
        </div>
        <div className="mt-auto">
          <Kicker color={t.accent}>{brand.nome}</Kicker>
          <h1 style={{ fontSize: '5.4cqw', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.02em', maxWidth: '78%' }}>
            {card.title || 'Proposta de Serviços'}
          </h1>
          {card.subtitle && (
            <p style={{ marginTop: '2cqw', fontSize: '2.1cqw', color: t.muted, fontWeight: 500 }}>{card.subtitle}</p>
          )}
        </div>
        <div style={{ marginTop: '3.4cqw', height: '0.7cqw', width: '16%', background: t.accent, borderRadius: 999 }} />
      </Frame>
    );
  }

  if (card.kind === 'stats') {
    return (
      <Frame card={card} tema={tema} brand={brand} index={index} total={total}>
        {card.title && <h2 style={{ fontSize: '3.6cqw', fontWeight: 800, letterSpacing: '-0.02em' }}>{card.title}</h2>}
        <div className="grid grid-cols-2" style={{ gap: '2.4cqw', marginTop: '4cqw' }}>
          {items.slice(0, 4).map((it, i) => (
            <div key={i} style={{ background: t.soft, borderRadius: '1.6cqw', padding: '2.6cqw' }}>
              <div style={{ fontSize: '3.8cqw', fontWeight: 800, color: t.accent, lineHeight: 1 }}>{it.value}</div>
              <div style={{ fontSize: '1.7cqw', color: t.muted, marginTop: '1cqw' }}>{it.label}</div>
              {it.note && <div style={{ fontSize: '1.35cqw', color: t.muted, marginTop: '0.6cqw' }}>{it.note}</div>}
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (card.kind === 'pricing') {
    return (
      <Frame card={card} tema={tema} brand={brand} index={index} total={total}>
        {card.title && <h2 style={{ fontSize: '3.6cqw', fontWeight: 800, letterSpacing: '-0.02em' }}>{card.title}</h2>}
        <div style={{ marginTop: '3cqw', display: 'flex', flexDirection: 'column', gap: '1.2cqw' }}>
          {items.slice(0, 6).map((it, i) => (
            <div key={i} className="flex items-baseline justify-between" style={{ borderBottom: `1px solid ${t.soft}`, paddingBottom: '1.1cqw', gap: '2cqw' }}>
              <span style={{ fontSize: '1.85cqw', fontWeight: 600 }}>{it.label}</span>
              <span style={{ fontSize: '1.85cqw', fontWeight: 800, color: t.accent, whiteSpace: 'nowrap' }}>{it.value}</span>
            </div>
          ))}
        </div>
        {card.subtitle && (
          <div style={{ marginTop: 'auto', background: t.soft, borderRadius: '1.4cqw', padding: '2cqw 2.4cqw', fontSize: '1.7cqw', fontWeight: 700 }}>
            {card.subtitle}
          </div>
        )}
      </Frame>
    );
  }

  if (card.kind === 'timeline') {
    return (
      <Frame card={card} tema={tema} brand={brand} index={index} total={total}>
        {card.title && <h2 style={{ fontSize: '3.6cqw', fontWeight: 800, letterSpacing: '-0.02em' }}>{card.title}</h2>}
        <div style={{ marginTop: '3.4cqw', display: 'flex', flexDirection: 'column', gap: '2cqw' }}>
          {items.slice(0, 5).map((it, i) => (
            <div key={i} className="flex items-start" style={{ gap: '2.2cqw' }}>
              <div className="flex items-center justify-center shrink-0" style={{
                width: '3.2cqw', height: '3.2cqw', borderRadius: 999,
                background: t.accent, color: t.onAccent, fontSize: '1.5cqw', fontWeight: 800,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: '1.35cqw', color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{it.label}</div>
                <div style={{ fontSize: '1.9cqw', fontWeight: 600, marginTop: '0.3cqw' }}>{it.value}</div>
                {it.note && <div style={{ fontSize: '1.4cqw', color: t.muted, marginTop: '0.3cqw' }}>{it.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (card.kind === 'contact') {
    return (
      <Frame card={card} tema={tema} brand={brand} index={index} total={total}>
        <Logo brand={brand} size={4} />
        <div style={{ marginTop: '4.2cqw' }}>
          {card.title && <h2 style={{ fontSize: '4cqw', fontWeight: 800, letterSpacing: '-0.02em' }}>{card.title}</h2>}
          {card.subtitle && <p style={{ fontSize: '2cqw', color: t.muted, marginTop: '1.2cqw' }}>{card.subtitle}</p>}
        </div>
        <div style={{ marginTop: '3.4cqw', display: 'flex', flexDirection: 'column', gap: '1.4cqw' }}>
          {items.slice(0, 5).map((it, i) => (
            <div key={i} className="flex items-baseline" style={{ gap: '1.6cqw' }}>
              <span style={{ fontSize: '1.35cqw', color: t.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, minWidth: '12cqw' }}>{it.label}</span>
              <span style={{ fontSize: '1.9cqw', fontWeight: 600 }}>{it.value}</span>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (card.kind === 'bullets') {
    return (
      <Frame card={card} tema={tema} brand={brand} index={index} total={total}>
        {card.title && <h2 style={{ fontSize: '3.6cqw', fontWeight: 800, letterSpacing: '-0.02em' }}>{card.title}</h2>}
        <div className="grid grid-cols-2" style={{ gap: '1.8cqw 3cqw', marginTop: '3.2cqw' }}>
          {items.slice(0, 6).map((it, i) => (
            <div key={i} className="flex items-start" style={{ gap: '1.4cqw' }}>
              <span style={{ width: '0.9cqw', height: '0.9cqw', borderRadius: 999, background: t.accent, marginTop: '1cqw', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '1.9cqw', fontWeight: 700 }}>{it.label}</div>
                {it.note && <div style={{ fontSize: '1.4cqw', color: t.muted, marginTop: '0.35cqw', lineHeight: 1.4 }}>{it.note}</div>}
                {it.value && <div style={{ fontSize: '1.4cqw', color: t.accent, fontWeight: 700, marginTop: '0.35cqw' }}>{it.value}</div>}
              </div>
            </div>
          ))}
        </div>
        {card.body && <p style={{ marginTop: '2.4cqw', fontSize: '1.7cqw', color: t.muted }}>{card.body}</p>}
      </Frame>
    );
  }

  // section (default)
  return (
    <Frame card={card} tema={tema} brand={brand} index={index} total={total}>
      <div style={{ width: '5cqw', height: '0.7cqw', background: t.accent, borderRadius: 999, marginBottom: '3cqw' }} />
      {card.title && <h2 style={{ fontSize: '4.2cqw', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>{card.title}</h2>}
      {card.body && (
        <p style={{ marginTop: '2.6cqw', fontSize: '2.05cqw', lineHeight: 1.5, color: t.muted, maxWidth: '86%' }}>{card.body}</p>
      )}
      {items.length > 0 && (
        <div style={{ marginTop: '2.6cqw', display: 'flex', flexDirection: 'column', gap: '1.2cqw' }}>
          {items.slice(0, 5).map((it, i) => (
            <div key={i} style={{ fontSize: '1.8cqw' }}>
              <strong>{it.label}</strong>{it.value ? ` — ${it.value}` : ''}
              {it.note && <span style={{ color: t.muted }}> · {it.note}</span>}
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

/** Todos os cards em sequência (página pública e pré-visualização de impressão). */
export function DeckCards({ cards, tema, brand, className = '' }: {
  cards: DeckCard[];
  tema: DeckTheme;
  brand: DeckBrand;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {cards.map((card, i) => (
        <div key={card.id}>
          <DeckCardView card={card} tema={tema} brand={brand} index={i} total={cards.length} />
        </div>
      ))}
    </div>
  );
}

/**
 * CSS de impressão: esconde a app, mostra só `#deck-print-root` e põe um card
 * por página A4 landscape.
 */
export function DeckPrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4 landscape; margin: 0; }
        body { visibility: hidden !important; background: #fff !important; }
        #deck-print-root, #deck-print-root * { visibility: visible !important; }
        #deck-print-root {
          position: absolute; left: 0; top: 0; width: 100%;
          display: block !important;
        }
        #deck-print-root .deck-page {
          width: 1090px; height: 613px; margin: 0 auto;
          break-after: page; page-break-after: always;
        }
        #deck-print-root .deck-page:last-child { break-after: auto; page-break-after: auto; }
        #deck-print-root .deck-card { aspect-ratio: auto; height: 100%; }
      }
    `}</style>
  );
}
