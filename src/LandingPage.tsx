import React from 'react';

interface Props {
  onEnter: () => void;
  onCreateAccount?: () => void;
}

/**
 * Landing pública — azul e branco, grelha editorial.
 * Sem imagens: o «documento» do hero é construído em CSS para carregar
 * instantaneamente e imprimir bem em qualquer ecrã.
 */
export default function LandingPage({ onEnter, onCreateAccount }: Props) {
  return (
    <div className="lp">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600&family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        .lp { --ink:#0B1D2D; --blue:#0677FF; --blue-btn:#0461D6; --blue-deep:#0A3E8F; --line:#D8E6F8; --soft:#F3F8FF;
              background:#fff; color:var(--ink); font-family:Geist,sans-serif; overflow-x:hidden; }
        .lp * { box-sizing:border-box; }
        .lp-wrap { max-width:1160px; margin:0 auto; padding:0 24px; }
        .lp-mono { font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase; }
        .lp-serif { font-family:Fraunces,Georgia,serif; font-weight:300; letter-spacing:-.02em; }
        .lp-in { animation:lpIn .9s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes lpIn { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        .lp-d1{animation-delay:.05s}.lp-d2{animation-delay:.15s}.lp-d3{animation-delay:.25s}.lp-d4{animation-delay:.35s}
        @media (prefers-reduced-motion: reduce){ .lp-in{animation:none} }
        .lp-btn { display:inline-flex; align-items:center; gap:8px; border-radius:4px; padding:13px 20px; font-weight:600; font-size:14px;
                  transition:transform .25s ease, background .25s ease, color .25s ease; }
        .lp-btn:hover { transform:translateY(-1px); }
        .lp-primary { background:var(--blue-btn); color:#fff; }
        .lp-primary:hover { background:#0353B7; }
        .lp-ghost { border:1px solid var(--line); color:var(--ink); background:#fff; }
        .lp-ghost:hover { border-color:var(--blue); color:var(--blue-deep); }
        .lp-cap { display:grid; grid-template-columns:56px 1fr; gap:18px; padding:26px 0; border-top:1px solid var(--line); }
        .lp-cap:hover .lp-num { color:var(--blue); }
        .lp-num { font-family:"JetBrains Mono",monospace; font-size:12px; color:var(--blue-deep); transition:color .2s; }
        .lp-rule { height:1px; background:var(--line); }
        @media (max-width:900px){ .lp-hero{grid-template-columns:1fr !important} .lp-doc{transform:none !important; margin-top:34px; max-width:100%} .lp-grid2{grid-template-columns:1fr !important} }
        @media (max-width:700px){
          .lp-hide-sm{display:none !important}
          .lp-btn{padding:11px 14px; font-size:13px}
          .lp-cap{grid-template-columns:34px 1fr; gap:12px}
          .lp-nav{gap:8px !important}
        }
      `}</style>

      {/* barra */}
      <header style={{ borderBottom: '1px solid var(--line)', background: '#fff', position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="lp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="Estudo 360" width={30} height={30} className="logo-orb" style={{ width: 30, height: 30, objectFit: 'contain' }} draggable={false} />
            <span style={{ fontWeight: 700, letterSpacing: '-.02em', fontSize: 17 }}>estudo<span style={{ color: 'var(--blue-btn)' }}>360</span></span>
            <span className="lp-mono lp-hide-sm" style={{ color: '#5A6B7B', marginLeft: 14 }}>contabilidade</span>
          </div>
          <nav className="lp-nav" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <a href="#capacidades" className="lp-mono lp-hide-sm" style={{ color: '#3E5470', textDecoration: 'none' }}>O que faz</a>
            <a href="#numeros" className="lp-mono" style={{ color: '#3E5470', textDecoration: 'none', display: 'none' }}>Números</a>
            <button onClick={onEnter} className="lp-btn lp-ghost" style={{ padding: '9px 16px' }}>Entrar</button>
            {onCreateAccount && (
              <button onClick={onCreateAccount} className="lp-btn lp-primary" style={{ padding: '9px 16px' }}>Criar conta</button>
            )}
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="lp-wrap" style={{ paddingTop: 76, paddingBottom: 64 }}>
        <div className="lp-hero" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <div className="lp-in lp-d1 lp-mono" style={{ color: 'var(--blue-deep)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 22, height: 1, background: 'var(--blue)' }} />
              Plataforma de decisão contabilística
            </div>
            <h1 className="lp-in lp-d2 lp-serif" style={{ fontSize: 'clamp(42px, 6vw, 74px)', lineHeight: 1.02, margin: '22px 0 0' }}>
              Decidir com números,
              <br />
              não com pressa.
            </h1>
            <p className="lp-in lp-d3" style={{ marginTop: 24, maxWidth: 460, fontSize: 16.5, lineHeight: 1.65, color: '#3E5470' }}>
              Simuladores fiscais, gestão do gabinete e documentos prontos a assinar — no mesmo sítio, com os dados do cliente.
            </p>
            <div className="lp-in lp-d4" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
              <button onClick={onEnter} className="lp-btn lp-primary">Entrar na plataforma →</button>
              {onCreateAccount && <button onClick={onCreateAccount} className="lp-btn lp-ghost">Começar sem cartão</button>}
            </div>
            <div className="lp-in lp-d4 lp-mono" style={{ marginTop: 30, color: '#5A6B7B', display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <span>Sem instalação</span>
              <span style={{ color: 'var(--line)' }}>/</span>
              <span>Dados por gabinete</span>
              <span style={{ color: 'var(--line)' }}>/</span>
              <span>Exporta em PDF</span>
            </div>
          </div>

          {/* «documento» do hero, em CSS */}
          <div className="lp-doc lp-in lp-d3" style={{ transform: 'rotate(-1.4deg)' }}>
            <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, boxShadow: '18px 22px 0 -10px #EAF3FF', overflow: 'hidden' }}>
              <div style={{ height: 6, background: 'var(--blue)' }} />
              <div style={{ padding: '18px 20px 22px' }}>
                <div className="lp-mono" style={{ color: '#5A6B7B' }}>Previsa · Modelo 22 · 2026</div>
                <div className="lp-serif" style={{ fontSize: 26, marginTop: 6 }}>Padaria do Bairro, Lda.</div>
                <div style={{ marginTop: 18, borderTop: '1px solid var(--line)' }}>
                  {[
                    ['Matéria coletável (Q09)', '43 450 €'],
                    ['IRC liquidado (Q10)', '7 386 €'],
                    ['PPC 2027 · 3 prestações', '5 938 €'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 13, color: '#3E5470' }}>{k}</span>
                      <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13.5, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                  {[92, 58, 30].map((w, i) => (
                    <span key={i} style={{ height: 5, width: `${w}px`, background: i === 0 ? 'var(--blue)' : '#BFD9FF', display: 'inline-block', borderRadius: 1 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* capacidades */}
      <section id="capacidades" style={{ borderTop: '1px solid var(--line)', background: 'var(--soft)' }}>
        <div className="lp-wrap" style={{ paddingTop: 64, paddingBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
            <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: 0 }}>O trabalho todo, por ordem.</h2>
            <span className="lp-mono" style={{ color: '#5A6B7B' }}>Quatro frentes</span>
          </div>
          <div className="lp-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 64px', marginTop: 28 }}>
            {[
              ['01', 'Gabinete', 'Clientes, obrigações, tarefas e alertas por gabinete. Cada pessoa vê apenas o que lhe compete.'],
              ['02', 'Simuladores', 'IRS, IRC, IMT, viaturas, salários e segurança social — com o enquadramento escolhido, não com médias.'],
              ['03', 'Documentos', 'Proposta, contrato e demonstrações numa folha A4, com a marca do escritório.'],
              ['04', 'Cofre', 'Credenciais cifradas no browser; sem a passphrase, o ficheiro não as revela.'],
            ].map(([n, t, d]) => (
              <div key={n} className="lp-cap">
                <span className="lp-num">{n}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 600 }}>{t}</h3>
                  <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.65, color: '#3E5470' }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* números */}
      <section id="numeros" style={{ background: 'var(--blue-deep)', color: '#fff' }}>
        <div className="lp-wrap" style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div className="lp-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              ['26', 'documentos', 'exportáveis, um exemplo de cada'],
              ['11', 'simuladores', 'fiscais e de gestão'],
              ['1', 'folha A4', 'por documento, sem meias páginas'],
            ].map(([n, l, s]) => (
              <div key={l} style={{ borderTop: '1px solid rgba(255,255,255,.35)', paddingTop: 18 }}>
                <div className="lp-serif" style={{ fontSize: 56, lineHeight: 1 }}>{n}</div>
                <div className="lp-mono" style={{ marginTop: 10, color: '#CFE2FF' }}>{l}</div>
                <div style={{ marginTop: 6, fontSize: 13.5, color: '#E6F0FF' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* como começar */}
      <section className="lp-wrap" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: 0 }}>Do primeiro clique ao primeiro documento.</h2>
        <div className="lp-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginTop: 30 }}>
          {[
            ['Criar conta', 'Sem cartão. O gabinete fica seu.'],
            ['Abrir um cliente', 'Do SAF-T ou à mão, em minutos.'],
            ['Exportar', 'PDF, CSV ou Word — com a sua marca.'],
          ].map(([t, d], i) => (
            <div key={t}>
              <div className="lp-mono" style={{ color: 'var(--blue-deep)' }}>{`0${i + 1}`}</div>
              <div className="lp-rule" style={{ margin: '10px 0 14px' }} />
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>{t}</h3>
              <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.65, color: '#3E5470' }}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 44, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onEnter} className="lp-btn lp-primary">Entrar</button>
          <a href="mailto:geral@pontofinal.site" className="lp-btn lp-ghost" style={{ textDecoration: 'none' }}>Falar com quem fez</a>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div className="lp-wrap lp-mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 22, paddingBottom: 28, color: '#5A6B7B', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="" width={16} height={16} style={{ width: 16, height: 16, objectFit: 'contain' }} draggable={false} aria-hidden="true" />
            Estudo 360 · plataforma de apoio à decisão
          </span>
          <span>Cálculos indicativos · confirme com o contabilista</span>
        </div>
      </footer>
    </div>
  );
}
