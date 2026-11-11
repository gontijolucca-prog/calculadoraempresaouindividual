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
import { PDF_RGB } from './pdfTheme';

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
const FATORES = [1, 0.95, 0.9, 0.85, 0.8, 0.76, 0.72];

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
  | { m: 'destaques'; a: [Array<{ label: string; valor: string }>] }
  | { m: 'nota'; a: [string] }
  | { m: 'espaco'; a: [number] };

export class RelatorioPdf {
  private doc: jsPDF;
  private opts: PdfOptions;
  private y: number;
  private largura: number;
  private altura: number;
  private cor: [number, number, number];
  private f: number;
  private ops: Operacao[] = [];
  private aGravar = false;
  private forcarUmaFolha = false;
  private esgotado = false;
  private notaOmitida = false;
  private nSec = 0;

  constructor(opts: PdfOptions, fator = 1) {
    this.opts = opts;
    this.f = Math.min(1, Math.max(0.72, fator));
    this.forcarUmaFolha = this.f <= 0.7201;
    this.doc = new jsPDF({ orientation: opts.paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    this.largura = this.doc.internal.pageSize.getWidth();
    this.altura = this.doc.internal.pageSize.getHeight();
    this.y = MM.topo;
    this.cor = PDF_RGB.blue;
    // Metadados: o PDF fica identificável em qualquer leitor (portabilidade).
    try {
      this.doc.setProperties({
        title: opts.titulo,
        subject: opts.subtitulo || 'Relatório Estudo 360',
        author: (opts.escritorio?.nome || 'Estudo 360').trim(),
        creator: 'Estudo 360',
        keywords: 'Estudo 360, relatório, PDF',
      });
    } catch { /* versões antigas do jsPDF sem setProperties */ }
    this.cabecalho();
  }

  // ── escala ────────────────────────────────────────────────────────────────
  private fs(n: number): number { return Math.max(6.4, n * this.f); }
  private v(n: number): number { return n * this.f; }
  private get margem(): number { return MM.margem; }

  private cabecalho() {
    const d = this.doc;
    const esc = this.opts.escritorio || {};
    const nome = (esc.nome || 'Estudo 360').trim();
    const hoje = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date());

    // Fio de topo — assinatura discreta do documento.
    d.setFillColor(...PDF_RGB.blue);
    d.rect(0, 0, this.largura, 1.6, 'F');

    // Cabeça: marca à esquerda, data à direita.
    d.setFillColor(...PDF_RGB.blue);
    d.roundedRect(this.margem, this.y, 10, 10, 2, 2, 'F');
    d.setTextColor(...PDF_RGB.white);
    d.setFont('helvetica', 'bold');
    d.setFontSize(this.fs(9));
    d.text('360', this.margem + 5, this.y + 6.4, { align: 'center' });

    d.setFont('helvetica', 'bold');
    d.setFontSize(this.fs(9.6));
    d.setTextColor(...PDF_RGB.dark);
    d.text(sanitizePdf(nome), this.margem + 13, this.y + 4.2);
    d.setFont('helvetica', 'normal');
    d.setFontSize(this.fs(6.1));
    d.setTextColor(...PDF_RGB.medium);
    d.text('DOCUMENTO CONFIDENCIAL · ESTUDO 360', this.margem + 13, this.y + 7.9, { charSpace: 0.45 });
    d.text(hoje.toUpperCase(), this.largura - this.margem, this.y + 4.2, { align: 'right', charSpace: 0.45 });

    this.y += this.v(19);

    // Título em serifa — é isto que dá cara de documento, não de ecrã.
    d.setFont('times', 'bold');
    d.setFontSize(this.fs(23));
    d.setTextColor(...PDF_RGB.dark);
    const titulo = d.splitTextToSize(sanitizePdf(this.opts.titulo), this.largura - this.margem * 2);
    d.text(titulo, this.margem, this.y);
    this.y += titulo.length * this.v(8.6) + 1.5;

    if (this.opts.subtitulo) {
      d.setFont('helvetica', 'normal');
      d.setFontSize(this.fs(9));
      d.setTextColor(...PDF_RGB.medium);
      const sub = d.splitTextToSize(sanitizePdf(this.opts.subtitulo), this.largura - this.margem * 2);
      d.text(sub, this.margem, this.y);
      this.y += sub.length * this.v(4.4) + 1;
    }

    // Faixa de identificação: cliente, NIF e emissão em colunas.
    const yBase = this.y + this.v(3);
    d.setDrawColor(...PDF_RGB.blue);
    d.setLineWidth(0.5);
    d.line(this.margem, yBase, this.largura - this.margem, yBase);
    const xNif = this.margem + 108;
    const xData = this.margem + 140;
    const rotulo = (txt: string, x: number) => {
      d.setFont('helvetica', 'bold');
      d.setFontSize(this.fs(5.9));
      d.setTextColor(...PDF_RGB.medium);
      d.text(txt, x, yBase + this.v(4.2), { charSpace: 0.5 });
    };
    rotulo('CLIENTE / EMPRESA', this.margem);
    rotulo('NIF', xNif);
    rotulo('EMITIDO', xData);
    d.setFont('helvetica', 'bold');
    d.setFontSize(this.fs(9.2));
    d.setTextColor(...PDF_RGB.dark);
    const larguraNome = 100;
    const nomeLinhas = d.splitTextToSize(sanitizePdf(this.opts.cliente || '—'), larguraNome);
    d.text(nomeLinhas.length > 1 ? `${String(nomeLinhas[0]).replace(/\s+$/, '')}...` : nomeLinhas[0], this.margem, yBase + this.v(9));
    d.text(sanitizePdf(this.opts.nif || '—'), xNif, yBase + this.v(9));
    d.setFont('helvetica', 'normal');
    d.setFontSize(this.fs(8));
    d.text(sanitizePdf(hoje), xData, yBase + this.v(9));
    d.setDrawColor(...PDF_RGB.line);
    d.setLineWidth(0.3);
    d.line(this.margem, yBase + this.v(11.6), this.largura - this.margem, yBase + this.v(11.6));
    this.y = yBase + this.v(15);
  }

  private cabecaDePagina(): number {
    return MM.topo + this.v(4);
  }
  private limiteInferior(): number {
    // Deixa espaço real para o rodapé (linha a 288 mm e texto a 293 mm).
    return this.altura - 24;
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

  /** Faixa de números-chave (até 3), como a abertura de um relatório anual. */
  destaques(itens: Array<{ label: string; valor: string }>): this {
    if (!itens.length) return this;
    if (!this.aGravar) this.ops.push({ m: 'destaques', a: [itens] });
    return this._destaques(itens);
  }

  private _destaques(itens: Array<{ label: string; valor: string }>): this {
    if (this.esgotado) return this;
    const d = this.doc;
    const vistos = new Set<string>();
    const lista = itens.filter((i) => {
      const chave = String(i.label).trim().toUpperCase().slice(0, 28);
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    }).slice(0, 3);
    const largura = this.largura - this.margem * 2;
    const col = largura / lista.length;
    const altura = this.v(20);
    if (!this.garantirAltura(altura + this.v(4))) return this;

    d.setDrawColor(...PDF_RGB.line);
    d.setLineWidth(0.3);
    d.line(this.margem, this.y, this.largura - this.margem, this.y);

    lista.forEach((item, i) => {
      const x = this.margem + col * i;
      if (i > 0) {
        d.setDrawColor(...PDF_RGB.line);
        d.line(x - 4, this.y + this.v(3), x - 4, this.y + altura - this.v(2));
      }
      d.setFont('helvetica', 'bold');
      d.setFontSize(this.fs(5.9));
      d.setTextColor(...PDF_RGB.medium);
      d.text(String(item.label).toUpperCase().slice(0, 28), x, this.y + this.v(5), { charSpace: 0.5 });
      d.setFont('times', 'bold');
      d.setFontSize(this.fs(18));
      d.setTextColor(...PDF_RGB.dark);
      d.text(sanitizePdf(item.valor), x, this.y + this.v(14.2));
    });

    this.y += altura;
    d.setDrawColor(...PDF_RGB.line);
    d.setLineWidth(0.3);
    d.line(this.margem, this.y, this.largura - this.margem, this.y);
    this.y += this.v(5);
    return this;
  }

  private _seccao(titulo: string): this {
    if (this.esgotado) return this;
    if (!this.garantirAltura(this.v(14))) return this;
    const d = this.doc;
    this.nSec += 1;
    const numero = String(this.nSec).padStart(2, '0');
    d.setFont('helvetica', 'bold');
    d.setFontSize(this.fs(7));
    d.setTextColor(...PDF_RGB.blue);
    d.text(numero, this.margem, this.y + this.v(2.8));
    d.setFontSize(this.fs(8.4));
    d.setTextColor(...PDF_RGB.dark);
    // Micro-rótulo com tracking: hierarquia editorial, sem mudar a paleta.
    d.text(titulo.toUpperCase(), this.margem + 8, this.y + this.v(2.8), { charSpace: 0.7 });
    this.y += this.v(5.4);
    // Filete que arranca no número e vai até à margem direita.
    d.setDrawColor(...PDF_RGB.line);
    d.setLineWidth(0.35);
    d.line(this.margem + 8, this.y, this.largura - this.margem, this.y);
    this.y += this.v(4.4);
    return this;
  }

  private _tabela(linhas: LinhaTabela[], opts: { destaquePrimeira?: boolean } = {}): this {
    if (this.esgotado) return this;
    if (linhas.length === 0) return this._paragrafo('Sem dados para apresentar.');
    const d = this.doc;
    const largura = this.largura - this.margem * 2;
    const alturaLinha = this.v(6.4);
    d.setFontSize(this.fs(8.8));

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const ehTotal = /^(total|soma|resultado|valor final|a pagar|a receber)/i.test(String(linha.label).trim());
      const valorLongo = d.getTextWidth(sanitizePdf(linha.valor || '—')) > largura * 0.42;
      const linhasValor = valorLongo
        ? d.splitTextToSize(sanitizePdf(linha.valor || '—'), largura - 5) as string[]
        : d.splitTextToSize(sanitizePdf(linha.valor || '—'), largura * 0.42) as string[];
      const linhasLabel = d.splitTextToSize(sanitizePdf(linha.label), valorLongo ? largura - 5 : largura * 0.54) as string[];
      const h = valorLongo
        ? Math.max(alturaLinha, (linhasLabel.length + linhasValor.length) * this.v(4.2) + this.v(2.4))
        : Math.max(alturaLinha, Math.max(linhasValor.length, linhasLabel.length) * this.v(4.2) + this.v(3));
      if (!this.garantirAltura(h)) {
        const faltam = linhas.length - i;
        d.setFont('helvetica', 'italic');
        d.setFontSize(this.fs(6.8));
        d.setTextColor(...PDF_RGB.medium);
        const yNota = Math.min(this.y + this.v(3.6), this.limiteInferior() - 2);
        d.text(`… mais ${faltam} linha(s); restantes secções não couberam numa folha A4.`, this.margem + 2.5, yNota);
        this.y = yNota;
        this.esgotado = true;
        break;
      }
      if (ehTotal) {
        d.setDrawColor(...PDF_RGB.dark);
        d.setLineWidth(0.5);
        d.line(this.margem, this.y, this.largura - this.margem, this.y);
        d.setLineWidth(0.2);
        d.line(this.margem, this.y + 0.9, this.largura - this.margem, this.y + 0.9);
      }
      if (opts.destaquePrimeira && i === 0) {
        d.setTextColor(...PDF_RGB.dark);
      } else {
        d.setTextColor(...PDF_RGB.medium);
      }
      const cabecalhoTabela = opts.destaquePrimeira && i === 0;
      // Linha de pontos entre rótulo e valor (só quando o rótulo cabe numa linha).
      if (!cabecalhoTabela && !valorLongo && linhasLabel.length === 1 && !ehTotal) {
        d.setFont('helvetica', 'normal');
        d.setFontSize(this.fs(8.8));
        const fimRotulo = this.margem + 2.5 + d.getTextWidth(String(linha.label));
        const inicioValor = this.largura - this.margem - 2.5 - Math.min(d.getTextWidth(String(linha.valor || '')), largura * 0.42) - 2;
        if (inicioValor - fimRotulo > 6) {
          d.setDrawColor(...PDF_RGB.line);
          d.setLineWidth(0.15);
          d.setLineDashPattern([0.4, 1.4], 0);
          d.line(fimRotulo + 2, this.y + this.v(4.1), inicioValor, this.y + this.v(4.1));
          d.setLineDashPattern([], 0);
        }
      }
      d.setFont('helvetica', (ehTotal || cabecalhoTabela) ? 'bold' : 'normal');
      d.setTextColor(...(ehTotal || cabecalhoTabela ? PDF_RGB.dark : PDF_RGB.medium));
      if (cabecalhoTabela) {
        d.setFontSize(this.fs(6.2));
        d.text(String(linhasLabel).toUpperCase(), this.margem + 2.5, this.y + this.v(4.4), { charSpace: 0.5 });
        d.setFontSize(this.fs(8.6));
      } else {
        d.text(linhasLabel, this.margem + 2.5, this.y + this.v(4.4));
      }
      d.setFont('helvetica', 'bold');
      d.setTextColor(...PDF_RGB.dark);
      if (valorLongo) {
        d.setFont('helvetica', 'normal');
        d.setFontSize(this.fs(7.6));
        d.text(linhasValor, this.largura - this.margem - 2.5, this.y + this.v(4.4) + linhasLabel.length * this.v(4.2), { align: 'right' });
      } else {
        d.text(linhasValor, this.largura - this.margem - 2.5, this.y + this.v(4.4), { align: 'right' });
      }
      d.setDrawColor(...PDF_RGB.line);
      d.setLineWidth(0.2);
      d.line(this.margem, this.y + h, this.largura - this.margem, this.y + h);
      this.y += h;
    }
    this.y += this.v(4);
    return this;
  }

  private _matriz(cabecalho: string[], linhas: string[][]): this {
    if (this.esgotado) return this;
    if (linhas.length === 0) return this._paragrafo('Sem linhas para apresentar.');
    const d = this.doc;
    const largura = this.largura - this.margem * 2;
    const cols = Math.max(1, cabecalho.length);
    const colWidths = cols >= 5
      ? [largura * 0.20, largura * 0.18, ...Array(Math.max(0, cols - 2)).fill(largura * 0.62 / Math.max(1, cols - 2))]
      : [largura * 0.34, ...Array(Math.max(0, cols - 1)).fill(largura * 0.66 / Math.max(1, cols - 1))];
    const xCols = colWidths.map((_, i) => this.margem + colWidths.slice(0, i).reduce((sum, w) => sum + w, 0));
    const alturaLinha = this.v(7.6);
    let cortadas = 0;
    const desenharCabecalho = () => {
      d.setFillColor(...PDF_RGB.dark);
      d.rect(this.margem, this.y, largura, alturaLinha, 'F');
      d.setTextColor(...PDF_RGB.white);
      d.setFont('helvetica', 'bold');
      d.setFontSize(this.fs(6.8));
      cabecalho.forEach((c, i) => {
        const align = i < 2 ? 'left' : 'center';
        const x = i < 2 ? xCols[i] + 1.5 : xCols[i] + colWidths[i] / 2;
        d.text(d.splitTextToSize(sanitizePdf(c), colWidths[i] - 2)[0] || sanitizePdf(c), x, this.y + this.v(4), { align });
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
        d.setFillColor(...PDF_RGB.pale);
        d.rect(this.margem, this.y, largura, alturaLinha, 'F');
      }
      linha.slice(0, cols).forEach((cell, i) => {
        const tom = i === 0 ? PDF_RGB.dark : PDF_RGB.medium;
        d.setTextColor(...tom);
        d.setFont('helvetica', i < 2 ? 'bold' : 'normal');
        const align = i < 2 ? 'left' : 'center';
        const x = i < 2 ? xCols[i] + 1.5 : xCols[i] + colWidths[i] / 2;
        const texto = d.splitTextToSize(sanitizePdf(cell || ''), colWidths[i] - 2).slice(0, 2);
        d.text(texto.length ? texto : [''], x, this.y + this.v(3.4), {
          align,
          lineHeightFactor: 1.05,
        });
      });
      d.setDrawColor(...PDF_RGB.line);
      d.setLineWidth(0.15);
      d.line(this.margem, this.y + alturaLinha, this.largura - this.margem, this.y + alturaLinha);
      this.y += alturaLinha;
    });
    if (cortadas > 0) {
      this.esgotado = true;
      d.setFont('helvetica', 'italic');
      d.setFontSize(this.fs(6.8));
      d.setTextColor(...PDF_RGB.medium);
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
    d.setTextColor(...PDF_RGB.medium);
    const linhas = d.splitTextToSize(sanitizePdf(texto), this.largura - this.margem * 2) as string[];
    d.setCharSpace(0);
    let cortadas = 0;
    for (let i = 0; i < linhas.length; i++) {
      if (!this.garantirAltura(this.v(5))) { cortadas = linhas.length - i; break; }
      d.text(linhas[i], this.margem, this.y + this.v(3));
      this.y += this.v(4.6);
    }
    if (cortadas > 0) {
      this.esgotado = true;
      d.setFont('helvetica', 'italic');
      d.setFontSize(this.fs(6.6));
      d.setTextColor(...PDF_RGB.medium);
      d.text(`… ${cortadas} linha(s) de texto não cabiam nesta folha A4.`, this.margem, Math.min(this.y + this.v(3), this.limiteInferior() - 2));
      this.y = Math.min(this.y + this.v(5), this.altura - 16);
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
    if (!this.garantirAltura(h)) { this.notaOmitida = true; return this; }
    d.setFillColor(...PDF_RGB.pale);
    d.setDrawColor(...PDF_RGB.blue);
    d.setLineWidth(0.7);
    d.line(this.margem, this.y, this.margem, this.y + h);
    d.roundedRect(this.margem, this.y, this.largura - this.margem * 2, h, 1.5, 1.5, 'F');
    d.setTextColor(...PDF_RGB.dark);
    d.setCharSpace(0);
    d.text(linhas, this.margem + 3.5, this.y + this.v(4.4), { lineHeightFactor: 1.35 });
    this.y += h + this.v(4);
    return this;
  }

  private rodapes() {
    const d = this.doc;
    const total = d.getNumberOfPages();
    const escritorio = (this.opts.escritorio?.nome || 'Estudo 360').trim();
    const notaBase = this.opts.rodape
      || `Cálculos indicativos — confirme com o seu Contabilista Certificado.${this.notaOmitida ? ' Nota legal omitida por falta de espaço.' : ''}`;
    for (let p = 1; p <= total; p++) {
      d.setPage(p);
      d.setDrawColor(...PDF_RGB.line);
      d.setLineWidth(0.3);
      d.line(this.margem, this.altura - 12, this.largura - this.margem, this.altura - 12);
      d.setFont('helvetica', 'normal');
      d.setFontSize(6.6);
      d.setTextColor(...PDF_RGB.medium);
      d.text(sanitizePdf(notaBase), this.margem, this.altura - 7.5, { maxWidth: 118 });
      d.setFont('helvetica', 'bold');
      d.setTextColor(...PDF_RGB.blue);
      d.text(String(p), this.largura - this.margem - 6, this.altura - 7.5, { align: 'right' });
      d.setFont('helvetica', 'normal');
      d.setTextColor(...PDF_RGB.medium);
      d.text(`/ ${total}`, this.largura - this.margem, this.altura - 7.5, { align: 'right' });
      d.text(sanitizePdf(escritorio), this.largura - this.margem - 14, this.altura - 7.5, { align: 'right' });
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
        case 'destaques': this._destaques(op.a[0]); break;
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

  /** PDF final em bytes (para testes e geração fora do browser). */
  paraBytes(): Uint8Array {
    const { doc } = this.escolherParaUmaFolha();
    return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
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
