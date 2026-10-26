/**
 * Relatórios PDF reais (jsPDF) — simuladores, mapas e ficha do cliente.
 * Vectorial (texto selecionável), A4/A4 paisagem, logo e cor do escritório,
 * cabeçalho/rodapé.
 *
 * REGRA DE UMA FOLHA: o construtor aceita um `fator` (1 = tamanho normal) que
 * encolhe tipografia e espaçamentos. `save()` reconstrói o documento com
 * fatores cada vez menores até caber numa única página A4. Se nem no piso
 * (0.55) couber, a tabela/matriz é truncada com uma linha "… +N registos",
 * para nunca sair uma segunda folha com uma linha órfã.
 */
import { jsPDF } from 'jspdf';

export interface EscritorioPdf {
  nome?: string;
  corPrimaria?: string;
  logoDataUrl?: string;
}

export interface PdfOptions {
  titulo: string;
  subtitulo?: string;
  cliente?: string;
  nif?: string;
  escritorio?: EscritorioPdf;
  rodape?: string;
  paisagem?: boolean;
  nomeFicheiro?: string;
}

export interface LinhaTabela { label: string; valor: string }

const MM = {
  margem: 16,
  topo: 14,
  rodape: 12,
};

/** Fatores tentados, do maior para o menor. 0.55 é o piso de legibilidade. */
const FATORES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55];

export function slugFicheiro(s: string): string {
  return (s || 'Estudo360')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'Estudo360';
}

/** Quantas linhas cabem em cada página (puro, testável). */
export function paginarLinhas(total: number, alturaLinha: number, alturaUtil: number): number[] {
  if (total <= 0) return [];
  const porPagina = Math.max(1, Math.floor(alturaUtil / Math.max(0.1, alturaLinha)));
  const paginas: number[] = [];
  let restantes = total;
  while (restantes > 0) {
    const n = Math.min(porPagina, restantes);
    paginas.push(n);
    restantes -= n;
  }
  return paginas;
}

function eur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(v) ? v : 0);
}
export { eur as formatarEuros };

/** A fonte Helvetica do jsPDF não tem ✓/✕ — troca por texto ASCII legível. */
const GLIFOS: Record<string, string> = {
  '✓': 'OK', '✔': 'OK', '✕': 'X', '✖': 'X', '×': 'X',
  '—': '-', '–': '-', '→': '->', '←': '<-', '•': '-',
};
export function sanitizePdf(s: string): string {
  return String(s ?? '').replace(/[✓✔✕✖×—–→←•]/g, c => GLIFOS[c] ?? c);
}

type Operacao =
  | { m: 'seccao'; a: [string] }
  | { m: 'tabela'; a: [LinhaTabela[], { destaquePrimeira?: boolean }?] }
  | { m: 'matriz'; a: [string[], string[][]] }
  | { m: 'paragrafo'; a: [string] }
  | { m: 'nota'; a: [string] }
  | { m: 'espaco'; a: [number] };

export class RelatorioPdf {
  private doc: jsPDF;
  private opts: PdfOptions;
  private y: number;
  private largura: number;
  private altura: number;
  private cor: [number, number, number];
  private corPrimaria: string;
  private f: number;
  private ops: Operacao[] = [];
  private aGravar = false;
  private forcarUmaFolha = false;

  constructor(opts: PdfOptions, fator = 1) {
    this.opts = opts;
    this.f = Math.min(1, Math.max(0.55, fator));
    this.forcarUmaFolha = this.f <= 0.5501;
    this.doc = new jsPDF({ orientation: opts.paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    this.largura = this.doc.internal.pageSize.getWidth();
    this.altura = this.doc.internal.pageSize.getHeight();
    this.y = MM.topo;
    this.corPrimaria = /^#[0-9A-Fa-f]{6}$/.test(opts.escritorio?.corPrimaria || '') ? opts.escritorio!.corPrimaria! : '#0677FF';
    this.cor = this.hexParaRgb(this.corPrimaria);
    this.cabecalho();
  }

  // ── escala ────────────────────────────────────────────────────────────────
  private fs(n: number): number { return Math.max(5.2, n * this.f); }
  private v(n: number): number { return n * this.f; }
  private get margem(): number { return MM.margem; }

  private hexParaRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  private setCor(hex: string) {
    const [r, g, b] = this.hexParaRgb(hex);
    this.doc.setTextColor(r, g, b);
  }

  private cabecalho() {
    const d = this.doc;
    const esc = this.opts.escritorio || {};
    const nome = (esc.nome || 'Estudo 360').trim();
    let xTexto = this.margem;

    if (esc.logoDataUrl) {
      try {
        const props = d.getImageProperties(esc.logoDataUrl);
        const maxW = 34, maxH = 14;
        const ratio = Math.min(maxW / props.width, maxH / props.height);
        d.addImage(esc.logoDataUrl, 'PNG', this.margem, this.y, props.width * ratio, props.height * ratio);
        xTexto = this.margem + maxW + 4;
      } catch { /* logo inválido: cai para o bloco 360 */ }
    }
    if (xTexto === this.margem) {
      d.setFillColor(this.cor[0], this.cor[1], this.cor[2]);
      d.roundedRect(this.margem, this.y, 12, 12, 2.5, 2.5, 'F');
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.setFontSize(this.fs(11));
      d.text('360', this.margem + 6, this.y + 7.6, { align: 'center' });
      xTexto = this.margem + 16;
    }

    d.setFont('helvetica', 'bold');
    d.setFontSize(this.fs(10.5));
    d.setTextColor(15, 23, 42);
    d.text(sanitizePdf(nome), xTexto, this.y + 4.6);
    d.setFont('helvetica', 'normal');
    d.setFontSize(this.fs(7.5));
    d.setTextColor(100, 116, 139);
    d.text('Estudo 360 · Análise · Estratégia · Decisão', xTexto, this.y + 8.6);
    d.text(
      `RELATÓRIO · ${new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date())}`,
      this.largura - this.margem, this.y + 4.6, { align: 'right' },
    );

    this.y += this.v(16);
    d.setDrawColor(this.cor[0], this.cor[1], this.cor[2]);
    d.setLineWidth(0.7);
    d.line(this.margem, this.y, this.largura - this.margem, this.y);
    this.y += this.v(8);

    d.setFont('helvetica', 'bold');
    d.setFontSize(this.fs(17));
    d.setTextColor(11, 29, 45);
    const titulo = d.splitTextToSize(sanitizePdf(this.opts.titulo), this.largura - this.margem * 2);
    d.text(titulo, this.margem, this.y);
    this.y += titulo.length * this.v(7) + 1;

    if (this.opts.subtitulo) {
      d.setFont('helvetica', 'normal');
      d.setFontSize(this.fs(9.5));
      d.setTextColor(100, 116, 139);
      const sub = d.splitTextToSize(sanitizePdf(this.opts.subtitulo), this.largura - this.margem * 2);
      d.text(sub, this.margem, this.y);
      this.y += sub.length * this.v(4.6) + 1;
    }

    if (this.opts.cliente || this.opts.nif) {
      const boxH = this.v(13);
      d.setFillColor(245, 247, 250);
      d.setDrawColor(226, 232, 240);
      d.setLineWidth(0.3);
      d.roundedRect(this.margem, this.y, this.largura - this.margem * 2, boxH, 2, 2, 'FD');
      d.setFontSize(this.fs(6.8));
      d.setFont('helvetica', 'bold');
      d.setTextColor(100, 116, 139);
      d.text('CLIENTE / EMPRESA', this.margem + 3, this.y + this.v(4));
      d.text('NIF', this.largura - this.margem - 40, this.y + this.v(4));
      d.setFontSize(this.fs(9.5));
      d.setTextColor(15, 23, 42);
      d.text(d.splitTextToSize(sanitizePdf(this.opts.cliente || '—'), this.largura - this.margem * 2 - 50)[0], this.margem + 3, this.y + this.v(9.2));
      d.text(sanitizePdf(this.opts.nif || '—'), this.largura - this.margem - 40, this.y + this.v(9.2));
      this.y += boxH + this.v(6);
    }
    this.y += this.v(2);
  }

  private cabecaDePagina(): number {
    return MM.topo + this.v(4);
  }
  private limiteInferior(): number {
    return this.altura - MM.rodape - this.v(6);
  }

  private novaPagina() {
    this.doc.addPage();
    this.y = this.cabecaDePagina();
  }

  /**
   * Garante espaço. No piso de escala (`forcarUmaFolha`) nunca abre página:
   * devolve `false` e o chamador trunca/resume. Acima do piso pagina (serve só
   * para medir; a versão final é reconstruída e não terá 2.ª página).
   */
  private garantirAltura(h: number): boolean {
    if (this.y + h <= this.limiteInferior()) return true;
    if (this.forcarUmaFolha) return false;
    this.novaPagina();
    return true;
  }

  // ── API (registada para poder ser reproduzida noutra escala) ─────────────
  seccao(titulo: string): this {
    if (!this.aGravar) this.ops.push({ m: 'seccao', a: [titulo] });
    return this._seccao(titulo);
  }
  tabela(linhas: LinhaTabela[], opts: { destaquePrimeira?: boolean } = {}): this {
    if (!this.aGravar) this.ops.push({ m: 'tabela', a: [linhas, opts] });
    return this._tabela(linhas, opts);
  }
  matriz(cabecalho: string[], linhas: string[][]): this {
    if (!this.aGravar) this.ops.push({ m: 'matriz', a: [cabecalho, linhas] });
    return this._matriz(cabecalho, linhas);
  }
  paragrafo(texto: string): this {
    if (!this.aGravar) this.ops.push({ m: 'paragrafo', a: [texto] });
    return this._paragrafo(texto);
  }
  nota(texto: string): this {
    if (!this.aGravar) this.ops.push({ m: 'nota', a: [texto] });
    return this._nota(texto);
  }
  espaco(mm: number): this {
    if (!this.aGravar) this.ops.push({ m: 'espaco', a: [mm] });
    this.y += this.v(mm);
    return this;
  }

  private _seccao(titulo: string): this {
    if (!this.garantirAltura(this.v(14))) return this;
    const d = this.doc;
    d.setFillColor(this.cor[0], this.cor[1], this.cor[2]);
    d.circle(this.margem + 1.4, this.y + this.v(1.6), 1.2, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(this.fs(8.6));
    this.setCor(this.corPrimaria);
    d.text(titulo.toUpperCase(), this.margem + 5, this.y + this.v(2.8));
    this.y += this.v(5);
    d.setDrawColor(220, 231, 242);
    d.setLineWidth(0.3);
    d.line(this.margem, this.y, this.largura - this.margem, this.y);
    this.y += this.v(4);
    return this;
  }

  private _tabela(linhas: LinhaTabela[], opts: { destaquePrimeira?: boolean } = {}): this {
    if (linhas.length === 0) return this._paragrafo('Sem dados para apresentar.');
    const d = this.doc;
    const largura = this.largura - this.margem * 2;
    const alturaLinha = this.v(6.4);
    d.setFontSize(this.fs(8.8));

    linhas.forEach((linha, i) => {
      const linhasValor = d.splitTextToSize(sanitizePdf(linha.valor || '—'), largura * 0.42) as string[];
      const linhasLabel = d.splitTextToSize(sanitizePdf(linha.label), largura * 0.54) as string[];
      const h = Math.max(alturaLinha, Math.max(linhasValor.length, linhasLabel.length) * this.v(4.2) + this.v(3));
      if (!this.garantirAltura(h)) {
        const faltam = linhas.length - i;
        d.setFont('helvetica', 'italic');
        d.setFontSize(this.fs(6.8));
        d.setTextColor(100, 116, 139);
        d.text(`… mais ${faltam} linha(s) na aplicação (não cabiam numa folha A4).`, this.margem + 2.5, this.y + this.v(3.6));
        this.y += this.v(6);
        return this;
      }
      if (i % 2 === 1) {
        d.setFillColor(250, 252, 254);
        d.rect(this.margem, this.y, largura, h, 'F');
      }
      if (opts.destaquePrimeira && i === 0) {
        d.setFillColor(this.cor[0], this.cor[1], this.cor[2]);
        d.roundedRect(this.margem, this.y, largura, h, 1.5, 1.5, 'F');
        d.setTextColor(255, 255, 255);
      } else {
        d.setTextColor(71, 85, 105);
      }
      d.setFont('helvetica', 'normal');
      d.text(linhasLabel, this.margem + 2.5, this.y + this.v(4.4));
      d.setFont('helvetica', 'bold');
      if (opts.destaquePrimeira && i === 0) d.setTextColor(255, 255, 255);
      else d.setTextColor(15, 23, 42);
      d.text(linhasValor, this.largura - this.margem - 2.5, this.y + this.v(4.4), { align: 'right' });
      if (!(opts.destaquePrimeira && i === 0)) {
        d.setDrawColor(238, 242, 247);
        d.setLineWidth(0.2);
        d.line(this.margem, this.y + h, this.largura - this.margem, this.y + h);
      }
      this.y += h;
    });
    this.y += this.v(4);
    return this;
  }

  private _matriz(cabecalho: string[], linhas: string[][]): this {
    if (linhas.length === 0) return this._paragrafo('Sem linhas para apresentar.');
    const d = this.doc;
    const largura = this.largura - this.margem * 2;
    const cols = Math.max(1, cabecalho.length);
    const colW = largura / cols;
    const alturaLinha = this.v(6);
    let cortadas = 0;
    const desenharCabecalho = () => {
      d.setFillColor(74, 74, 74);
      d.rect(this.margem, this.y, largura, alturaLinha, 'F');
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.setFontSize(this.fs(6.8));
      cabecalho.forEach((c, i) => {
        const align = i === 0 ? 'left' : 'center';
        const x = i === 0 ? this.margem + 1.5 : this.margem + colW * i + colW / 2;
        d.text(d.splitTextToSize(sanitizePdf(c), colW - 2)[0] || sanitizePdf(c), x, this.y + this.v(4), { align });
      });
      this.y += alturaLinha;
    };
    desenharCabecalho();
    d.setFont('helvetica', 'normal');
    d.setFontSize(this.fs(6.6));
    linhas.forEach((linha, idx) => {
      if (this.y + alturaLinha > this.limiteInferior()) {
        // Nunca abre 2.ª folha: conta o que falta e resume no fim.
        cortadas = linhas.length - idx;
        return;
      }
      if (idx % 2 === 1) {
        d.setFillColor(248, 250, 252);
        d.rect(this.margem, this.y, largura, alturaLinha, 'F');
      }
      linha.slice(0, cols).forEach((cell, i) => {
        d.setTextColor(i === 0 ? 15 : 71, i === 0 ? 23 : 85, i === 0 ? 42 : 105);
        if (i === 0) d.setFont('helvetica', 'bold'); else d.setFont('helvetica', 'normal');
        const align = i === 0 ? 'left' : 'center';
        const x = i === 0 ? this.margem + 1.5 : this.margem + colW * i + colW / 2;
        d.text(d.splitTextToSize(sanitizePdf(cell || ''), colW - 2)[0] || '', x, this.y + this.v(4), { align });
      });
      d.setDrawColor(226, 232, 240);
      d.setLineWidth(0.15);
      d.line(this.margem, this.y + alturaLinha, this.largura - this.margem, this.y + alturaLinha);
      this.y += alturaLinha;
    });
    if (cortadas > 0) {
      d.setFont('helvetica', 'italic');
      d.setFontSize(this.fs(6.8));
      d.setTextColor(100, 116, 139);
      d.text(`… mais ${cortadas} registo(s) na aplicação (não cabiam numa folha A4).`, this.margem + 1.5, this.y + this.v(3.6));
      this.y += this.v(6);
    }
    this.y += this.v(4);
    return this;
  }

  private _paragrafo(texto: string): this {
    const d = this.doc;
    d.setFont('helvetica', 'normal');
    d.setFontSize(this.fs(8.8));
    d.setTextColor(71, 85, 105);
    const linhas = d.splitTextToSize(sanitizePdf(texto), this.largura - this.margem * 2) as string[];
    d.setCharSpace(0);
    for (const l of linhas) {
      if (!this.garantirAltura(this.v(5))) break;
      d.text(l, this.margem, this.y + this.v(3));
      this.y += this.v(4.6);
    }
    this.y += this.v(2);
    return this;
  }

  private _nota(texto: string): this {
    const d = this.doc;
    d.setFont('helvetica', 'normal');
    d.setFontSize(this.fs(7.8));
    const linhas = d.splitTextToSize(sanitizePdf(texto), this.largura - this.margem * 2 - 8) as string[];
    const h = linhas.length * this.v(4.2) + this.v(5);
    if (!this.garantirAltura(h)) return this;
    d.setFillColor(255, 251, 235);
    d.setDrawColor(245, 158, 11);
    d.setLineWidth(0.7);
    d.line(this.margem, this.y, this.margem, this.y + h);
    d.roundedRect(this.margem, this.y, this.largura - this.margem * 2, h, 1.5, 1.5, 'F');
    d.setTextColor(146, 64, 14);
    d.setCharSpace(0);
    d.text(linhas, this.margem + 3.5, this.y + this.v(4.4), { lineHeightFactor: 1.35 });
    this.y += h + this.v(4);
    return this;
  }

  private rodapes() {
    const d = this.doc;
    const total = d.getNumberOfPages();
    const escritorio = (this.opts.escritorio?.nome || 'Estudo 360').trim();
    for (let p = 1; p <= total; p++) {
      d.setPage(p);
      d.setDrawColor(226, 232, 240);
      d.setLineWidth(0.3);
      d.line(this.margem, this.altura - 12, this.largura - this.margem, this.altura - 12);
      d.setFont('helvetica', 'normal');
      d.setFontSize(6.8);
      d.setTextColor(100, 116, 139);
      const rodape = 'Cálculos indicativos — confirme com o seu Contabilista Certificado.';
      d.text(this.opts.rodape || rodape, this.margem, this.altura - 7.5);
      d.text(`${escritorio} · ${new Intl.DateTimeFormat('pt-PT').format(new Date())}`, this.largura - this.margem, this.altura - 7.5, { align: 'right' });
    }
  }

  /** Reproduz as operações neste documento (usado na procura do fator certo). */
  private reproduzir(ops: Operacao[]) {
    this.aGravar = true;
    for (const op of ops) {
      switch (op.m) {
        case 'seccao': this._seccao(op.a[0]); break;
        case 'tabela': this._tabela(op.a[0], op.a[1] || {}); break;
        case 'matriz': this._matriz(op.a[0], op.a[1]); break;
        case 'paragrafo': this._paragrafo(op.a[0]); break;
        case 'nota': this._nota(op.a[0]); break;
        case 'espaco': this.y += this.v(op.a[0]); break;
      }
    }
    this.aGravar = false;
  }

  /**
   * Grava sempre uma folha A4: tenta fatores decrescentes até caber.
   * Devolve o fator usado (para testes/telemetria).
   */
  private escolherParaUmaFolha(): { doc: jsPDF; fator: number; paginas: number } {
    let doc = this.doc;
    let fator = this.f;
    let paginas = this.numeroPaginas;
    for (const f of FATORES) {
      const tentativa = new RelatorioPdf(this.opts, f);
      tentativa.reproduzir(this.ops);
      tentativa.rodapes();
      doc = tentativa.doc;
      fator = f;
      paginas = tentativa.doc.getNumberOfPages();
      if (paginas <= 1) break;
    }
    return { doc, fator, paginas };
  }

  save(nome?: string): number {
    const base = nome || this.opts.nomeFicheiro || `Estudo360-${this.opts.titulo}`;
    const { doc, fator } = this.escolherParaUmaFolha();
    doc.save(`${slugFicheiro(base)}.pdf`);
    return fator;
  }

  /** Nº de páginas com que o ficheiro sai (para testes). */
  paginasFinais(): number {
    return this.escolherParaUmaFolha().paginas;
  }

  /** Fator de escala usado para caber numa folha (para testes). */
  fatorFinal(): number {
    return this.escolherParaUmaFolha().fator;
  }

  /** Para testes: quantas páginas sairiam com um dado fator. */
  paginasComFator(fator: number): number {
    const t = new RelatorioPdf(this.opts, fator);
    t.reproduzir(this.ops);
    return t.doc.getNumberOfPages();
  }

  get numeroPaginas(): number {
    return this.doc.getNumberOfPages();
  }
}

export default RelatorioPdf;
