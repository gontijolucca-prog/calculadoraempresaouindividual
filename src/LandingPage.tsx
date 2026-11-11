import React from 'react';

interface Props {
  onEnter: () => void;
  onCreateAccount?: () => void;
}

/**
 * Landing pública — azul e branco, grelha editorial.
 * Sem imagens: o «documento» do hero é construído em CSS.
 */
export default function LandingPage({ onEnter, onCreateAccount }: Props) {
  const simuladores: [string, string][] = [
    ['Fiscal', 'ENI (recibos verdes) vs sociedade, lado a lado.'],
    ['IRS', 'Modelo 3: escalões, IRS Jovem, deduções e reembolso.'],
    ['Previsa', 'IRC do Modelo 22: Q07, Q09, Q10, derramas e PPC.'],
    ['Viaturas', 'IVA dedutível e tributação autónoma, por categoria.'],
    ['Aquisição', 'Compra, crédito, leasing e renting com o mesmo regime.'],
    ['Salário', 'Líquido do trabalhador e custo para a empresa.'],
    ['SS Independente', 'Contribuições de quem trabalha por conta própria.'],
    ['Tickets', 'Subsídio de alimentação: limite isento e poupança.'],
    ['IMT', 'Imposto municipal e imposto do selo na compra.'],
    ['Imóveis', 'Arrendar à empresa ou entrar com o imóvel em espécie.'],
    ['Diagnóstico', 'Cinco pilares de solidez financeira da empresa.'],
  ];

  const documentos: [string, string][] = [
    ['Demonstrações', 'Balanço, resultados, capital próprio, fluxos e síntese.'],
    ['Encerramento', 'Ata da assembleia, Previsa e declaração de responsabilidade.'],
    ['Pacote cliente', 'Capa, proposta de honorários e contrato de prestação.'],
    ['Mapas', 'Controlo mensal e recursos humanos, com filtros aplicados ao PDF.'],
    ['Simuladores', 'Uma folha por simulação, com os números-chave em destaque.'],
  ];

  return (
    <div className="lp">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600&family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        .lp { --ink:#0B1D2D; --blue:#0677FF; --blue-btn:#0461D6; --blue-deep:#0A3E8F; --line:#D8E6F8; --soft:#F3F8FF;
              background:#fff; color:var(--ink); font-family:Geist,sans-serif; overflow-x:hidden; }
        .lp * { box-sizing:border-box; }
        .lp-wrap { max-width:1160px; margin:0 auto; padding:0 24px; }
        .lp section[id] { scroll-margin-top: 84px; }
        .lp-mono { font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase; }
        .lp-serif { font-family:Fraunces,Georgia,serif; font-weight:300; letter-spacing:-.02em; }
        .lp-in { animation:lpIn .9s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes lpIn { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        .lp-d1{animation-delay:.05s}.lp-d2{animation-delay:.15s}.lp-d3{animation-delay:.25s}.lp-d4{animation-delay:.35s}
        @media (prefers-reduced-motion: reduce){ .lp-in{animation:none} }
        .lp-btn { display:inline-flex; align-items:center; gap:8px; border-radius:4px; padding:13px 20px; font-weight:600; font-size:14px;
                  transition:transform .25s ease, background .25s ease, color .25s ease; cursor:pointer; }
        .lp-btn:hover { transform:translateY(-1px); }
        .lp-primary { background:var(--blue-btn); color:#fff; }
        .lp-primary:hover { background:#0353B7; }
        .lp-ghost { border:1px solid var(--line); color:var(--ink); background:#fff; }
        .lp-ghost:hover { border-color:var(--blue); color:var(--blue-deep); }
        .lp-sec { padding:64px 0 56px; }
        .lp-head { display:flex; justify-content:space-between; align-items:baseline; gap:24px; flex-wrap:wrap; }
        .lp-overline { display:inline-flex; align-items:center; gap:10px; color:var(--blue-deep); }
        .lp-overline i { width:22px; height:1px; background:var(--blue); display:inline-block; }
        .lp-grid { display:grid; gap:0 56px; }
        .lp-cell { padding:20px 0; border-top:1px solid var(--line); display:grid; grid-template-columns:56px 1fr; gap:16px; }
        .lp-cell:hover .lp-num { color:var(--blue); }
        .lp-num { font-family:"JetBrains Mono",monospace; font-size:12px; color:var(--blue-deep); transition:color .2s; }
        .lp-rule { height:1px; background:var(--line); }
        .lp-faq { border-top:1px solid var(--line); padding:16px 0; }
        .lp-faq summary { cursor:pointer; font-weight:600; font-size:15.5px; list-style:none; display:flex; justify-content:space-between; gap:16px; }
        .lp-faq summary::-webkit-details-marker { display:none; }
        .lp-faq summary::after { content:'+'; color:var(--blue-btn); font-weight:400; }
        .lp-faq[open] summary::after { content:'–'; }
        .lp-faq p { margin:10px 0 0; font-size:14px; line-height:1.7; color:#3E5470; max-width:760px; }
        @media (max-width:900px){
          .lp-hero{grid-template-columns:1fr !important}
          .lp-doc{transform:none !important; margin-top:34px; max-width:100%}
          .lp-grid2{grid-template-columns:1fr !important}
        }
        @media (max-width:700px){
          .lp-hide-sm{display:none !important}
          .lp-btn{padding:11px 14px; font-size:13px}
          .lp-cell{grid-template-columns:34px 1fr; gap:12px}
          .lp-nav{gap:8px !important}
          .lp-sec{padding:44px 0 40px}
        }
      `}</style>

      {/* barra */}
      <header style={{ borderBottom: '1px solid var(--line)', background: '#fff', position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="lp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/" aria-label="Estudo 360 — início" style={{ display: 'inline-flex' }}><img src="/logo.svg" alt="Estudo 360" width={30} height={30} className="logo-orb" style={{ width: 30, height: 30, objectFit: 'contain' }} draggable={false} /></a>
            <span style={{ fontWeight: 700, letterSpacing: '-.02em', fontSize: 17 }}>estudo<span style={{ color: 'var(--blue-btn)' }}>360</span></span>
            <span className="lp-mono lp-hide-sm" style={{ color: '#5A6B7B', marginLeft: 14 }}>contabilidade</span>
          </div>
          <nav className="lp-nav" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <a href="#simuladores" className="lp-mono lp-hide-sm" style={{ color: '#3E5470', textDecoration: 'none' }}>Simuladores</a>
            <a href="#gabinete" className="lp-mono lp-hide-sm" style={{ color: '#3E5470', textDecoration: 'none' }}>Gabinete</a>
            <a href="#documentos" className="lp-mono lp-hide-sm" style={{ color: '#3E5470', textDecoration: 'none' }}>Documentos</a>
            <button onClick={onEnter} className="lp-btn lp-ghost" style={{ padding: '9px 16px' }}>Entrar</button>
            {onCreateAccount && (
              <button onClick={onCreateAccount} className="lp-btn lp-primary" style={{ padding: '9px 16px' }}>Criar conta</button>
            )}
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="lp-wrap" style={{ paddingTop: 72, paddingBottom: 56 }}>
        <div className="lp-hero" style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <div className="lp-in lp-d1 lp-overline lp-mono">
              <i />
              Plataforma de decisão contabilística
            </div>
            <h1 className="lp-in lp-d2 lp-serif" style={{ fontSize: 'clamp(42px, 6vw, 74px)', lineHeight: 1.02, margin: '22px 0 0' }}>
              Decidir com números,
              <br />
              não com pressa.
            </h1>
            <p className="lp-in lp-d3" style={{ marginTop: 24, maxWidth: 470, fontSize: 16.5, lineHeight: 1.65, color: '#3E5470' }}>
              Onze simuladores, um gabinete por cliente e 26 documentos prontos a assinar — no mesmo sítio, com os dados que já tem.
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
        <div className="lp-wrap lp-sec">
          <div className="lp-head">
            <div>
              <div className="lp-overline lp-mono"><i />O que faz</div>
              <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: '14px 0 0' }}>O trabalho todo, por ordem.</h2>
            </div>
            <span className="lp-mono" style={{ color: '#5A6B7B' }}>Quatro frentes</span>
          </div>
          <div className="lp-grid lp-grid2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 28 }}>
            {[
              ['01', 'Gabinete', 'Clientes, obrigações, tarefas, contactos, documentos, cofre e lixeira — por gabinete, com permissões por cargo.'],
              ['02', 'Simuladores', 'Onze simulações fiscais e de gestão, cada uma com o enquadramento escolhido — não com médias.'],
              ['03', 'Documentos', 'Proposta, contrato, demonstrações e mapas: 26 documentos, uma folha A4 cada, com a marca do escritório.'],
              ['04', 'Cofre', 'Credenciais cifradas no browser. Sem a passphrase, o ficheiro não as revela — nem o servidor as vê.'],
            ].map(([n, t, d]) => (
              <div key={n} className="lp-cell">
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

      {/* simuladores */}
      <section id="simuladores" className="lp-wrap lp-sec">
        <div className="lp-head">
          <div>
            <div className="lp-overline lp-mono"><i />Simuladores</div>
            <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: '14px 0 0' }}>Onze contas que costumam dar discussão.</h2>
          </div>
          <span className="lp-mono" style={{ color: '#5A6B7B' }}>11 simuladores</span>
        </div>
        <p style={{ marginTop: 16, maxWidth: 620, fontSize: 15, lineHeight: 1.7, color: '#3E5470' }}>
          Todos partem do perfil do cliente e devolvem valores com base legal, pressupostos e uma folha A4 pronta a entregar.
        </p>
        <div className="lp-grid lp-grid2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
          {simuladores.map(([nome, desc], i) => (
            <div key={nome} className="lp-cell">
              <span className="lp-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>{nome}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13.8, lineHeight: 1.6, color: '#3E5470' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* números */}
      <section id="numeros" style={{ background: 'var(--blue-deep)', color: '#fff' }}>
        <div className="lp-wrap lp-sec">
          <div className="lp-grid lp-grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
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

      {/* gabinete */}
      <section id="gabinete" style={{ background: 'var(--soft)' }}>
        <div className="lp-wrap lp-sec">
          <div className="lp-head">
            <div>
              <div className="lp-overline lp-mono"><i />Gabinete</div>
              <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: '14px 0 0' }}>A carteira toda, com quem fez o quê.</h2>
            </div>
            <span className="lp-mono" style={{ color: '#5A6B7B' }}>Por cliente</span>
          </div>
          <div className="lp-grid lp-grid2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 26 }}>
            {[
              ['Obrigações e calendário', 'IVA, IRC, IRS, retenções e SAF-T, com prazos e alertas por cliente.'],
              ['Tarefas e contactos', 'O que está por fazer, para quem, e o histórico de contactos.'],
              ['Equipa com cargos', 'Acessos por utilizador e password, permissões por cargo, remoção imediata.'],
              ['Isolamento por gabinete', 'Trocar de gabinete troca clientes, tarefas, cofre e documentos.'],
              ['Lixeira com recuperação', 'O que se apaga pode voltar; nada desaparece num clique errado.'],
              ['Cópia de segurança', 'Exportar e restaurar o gabinete inteiro num ficheiro — neste ou noutro computador.'],
            ].map(([t, d]) => (
              <div key={t} className="lp-cell" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>{t}</h3>
                  <p style={{ margin: '5px 0 0', fontSize: 13.8, lineHeight: 1.6, color: '#3E5470' }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* documentos */}
      <section id="documentos" className="lp-wrap lp-sec">
        <div className="lp-head">
          <div>
            <div className="lp-overline lp-mono"><i />Documentos</div>
            <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: '14px 0 0' }}>Sai uma folha. Não um monte.</h2>
          </div>
          <span className="lp-mono" style={{ color: '#5A6B7B' }}>26 / 26 revistos</span>
        </div>
        <div className="lp-grid lp-grid2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 26 }}>
          {documentos.map(([t, d], i) => (
            <div key={t} className="lp-cell">
              <span className="lp-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>{t}</h3>
                <p style={{ margin: '5px 0 0', fontSize: 13.8, lineHeight: 1.6, color: '#3E5470' }}>{d}</p>
              </div>
            </div>
          ))}
          <div className="lp-cell">
            <span className="lp-num">06</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>Formatos</h3>
              <p style={{ margin: '5px 0 0', fontSize: 13.8, lineHeight: 1.6, color: '#3E5470' }}>PDF, Word, Excel e CSV — o mesmo documento, no formato que o cliente pedir.</p>
            </div>
          </div>
        </div>
      </section>

      {/* dados */}
      <section style={{ borderTop: '1px solid var(--line)', background: 'var(--soft)' }}>
        <div className="lp-wrap lp-sec">
          <div className="lp-head">
            <div>
              <div className="lp-overline lp-mono"><i />Dados</div>
              <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: '14px 0 0' }}>Entra o SAF-T, sai o perfil preenchido.</h2>
            </div>
          </div>
          <div className="lp-grid lp-grid2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 26 }}>
            {[
              ['Importar SAF-T', 'Lê o ficheiro do cliente e preenche perfil, contabilidade e simuladores.'],
              ['Importar do TOConline', 'Com conta TOConline, a lista de empresas entra com um clique — sem duplicar NIF.'],
              ['Assistente contabilístico', 'Responde em segundos e sem os nomes dos clientes: só sabe quantos são.'],
              ['Base legal', 'Cada simulação mostra o artigo e o pressuposto que usou.'],
            ].map(([t, d]) => (
              <div key={t} className="lp-cell" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>{t}</h3>
                  <p style={{ margin: '5px 0 0', fontSize: 13.8, lineHeight: 1.6, color: '#3E5470' }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* perguntas */}
      <section id="perguntas" className="lp-wrap lp-sec">
        <div className="lp-head">
          <div>
            <div className="lp-overline lp-mono"><i />Perguntas</div>
            <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: '14px 0 0' }}>O que costumam perguntar.</h2>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          {[
            ['Preciso de instalar alguma coisa?', 'Não. Abre no browser, com sessão própria. Os documentos saem em PDF, Word, Excel ou CSV.'],
            ['Os valores substituem o contabilista?', 'Não. São cálculos indicativos, com base legal e pressupostos à vista; a validação final é sempre de um contabilista certificado.'],
            ['Os meus dados ficam separados?', 'Sim. Cada gabinete tem os seus clientes, tarefas, cofre e documentos; trocar de gabinete troca tudo.'],
            ['O cofre guarda as passwords em claro?', 'Não. As credenciais são cifradas no browser com a sua passphrase (PBKDF2 + AES-GCM) antes de saírem do computador.'],
            ['Posso levar o gabinete comigo?', 'Sim. Exporta um ficheiro único com clientes, fichas, obrigações, tarefas, contactos, documentos e cofre, e restaura noutro computador.'],
          ].map(([q, a]) => (
            <details key={q} className="lp-faq">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* como começar */}
      <section style={{ borderTop: '1px solid var(--line)', background: 'var(--soft)' }}>
        <div className="lp-wrap lp-sec">
          <h2 className="lp-serif" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', margin: 0 }}>Do primeiro clique ao primeiro documento.</h2>
          <div className="lp-grid lp-grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, marginTop: 30 }}>
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
          <div style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={onEnter} className="lp-btn lp-primary">Entrar</button>
            {onCreateAccount && <button onClick={onCreateAccount} className="lp-btn lp-ghost">Criar conta</button>}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div className="lp-wrap lp-mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 22, paddingBottom: 28, color: '#5A6B7B', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="" width={16} height={16} style={{ width: 16, height: 16, objectFit: 'contain' }} draggable={false} aria-hidden="true" />
            Estudo 360 · plataforma de apoio à decisão
          </span>
          <span style={{ display: 'inline-flex', gap: 18, flexWrap: 'wrap' }}><a href="/" style={{ color: 'var(--blue-deep)', textDecoration: 'none' }}>estudo360.pt</a><span>Cálculos indicativos · confirme com o contabilista</span></span>
        </div>
      </footer>
    </div>
  );
}
