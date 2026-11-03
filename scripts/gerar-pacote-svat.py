#!/usr/bin/env python3
"""Gera o dossier SVAT do Estudo360 em documentos A4 de uma página."""

from __future__ import annotations

from pathlib import Path
import re
from textwrap import dedent

import pymupdf
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs-candidatura-svat"
RENDER = ROOT / "tmp" / "pdfs" / "svat"

W, H = A4
M = 17 * mm
CONTENT_W = W - 2 * M
INK = colors.HexColor("#14181E")
MUTED = colors.HexColor("#667085")
SOFT = colors.HexColor("#98A2B3")
LINE = colors.HexColor("#E7E6E1")
PAPER = colors.HexColor("#FAFAF7")
BLUE = colors.HexColor("#0677FF")
BLUE_LIGHT = colors.HexColor("#EEF6FF")
GREEN = colors.HexColor("#0E9F6E")
GREEN_LIGHT = colors.HexColor("#ECFDF3")
AMBER = colors.HexColor("#B45309")
AMBER_LIGHT = colors.HexColor("#FFF7ED")
ROSE = colors.HexColor("#BE123C")
ROSE_LIGHT = colors.HexColor("#FFF1F2")
GOLD = colors.HexColor("#B06D35")

BODY = ParagraphStyle(
    "body",
    fontName="Helvetica",
    fontSize=8.7,
    leading=12.1,
    textColor=INK,
    alignment=TA_LEFT,
    spaceAfter=0,
)
SMALL = ParagraphStyle(
    "small",
    parent=BODY,
    fontSize=7.45,
    leading=9.7,
    textColor=MUTED,
)
TINY = ParagraphStyle(
    "tiny",
    parent=BODY,
    fontSize=6.55,
    leading=8.2,
    textColor=MUTED,
)
LABEL = ParagraphStyle(
    "label",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=6.9,
    leading=9,
    textColor=MUTED,
)


def clean(text: str) -> str:
    return dedent(text).strip().replace("\n", " ")


PT_WORDS = {
    "indice": "índice",
    "tecnico": "técnico",
    "tecnicos": "técnicos",
    "tecnica": "técnica",
    "memoria": "memória",
    "avaliacao": "avaliação",
    "classificacao": "classificação",
    "documentacao": "documentação",
    "producao": "produção",
    "exportacao": "exportação",
    "contabilistica": "contabilística",
    "contabilistico": "contabilístico",
    "autenticacao": "autenticação",
    "permissoes": "permissões",
    "informacao": "informação",
    "alteracao": "alteração",
    "eliminacao": "eliminação",
    "reconstrucao": "reconstrução",
    "aplicacao": "aplicação",
    "versao": "versão",
    "revisao": "revisão",
    "proximo": "próximo",
    "proxima": "próxima",
    "seguranca": "segurança",
    "endereco": "endereço",
    "declaracao": "declaração",
    "identificacao": "identificação",
    "subcertificacao": "subcertificação",
    "atribuicao": "atribuição",
    "certificacao": "certificação",
    "validacao": "validação",
    "regulatoria": "regulatória",
    "area": "área",
    "servico": "serviço",
    "servicos": "serviços",
    "publica": "pública",
    "publico": "público",
    "politicas": "políticas",
    "evidencia": "evidência",
    "conclusao": "conclusão",
    "necessario": "necessário",
    "necessarios": "necessários",
    "necessaria": "necessária",
    "nao": "não",
    "deposito": "depósito",
    "situacao": "situação",
    "transparencia": "transparência",
    "colecao": "coleção",
    "colecoes": "coleções",
    "proprio": "próprio",
    "protecao": "proteção",
    "submissao": "submissão",
    "instrucao": "instrução",
    "codigo": "código",
    "numero": "número",
    "automatico": "automático",
    "formulario": "formulário",
    "disponiveis": "disponíveis",
    "responsaveis": "responsáveis",
    "aplicavel": "aplicável",
    "aplicaveis": "aplicáveis",
    "expressao": "expressão",
    "formulacoes": "formulações",
    "alegacoes": "alegações",
    "pontuacao": "pontuação",
    "aprovacao": "aprovação",
    "utilizacao": "utilização",
    "historico": "histórico",
    "responsavel": "responsável",
    "limitacoes": "limitações",
    "criacao": "criação",
    "reposicao": "reposição",
    "remocao": "remoção",
    "sincronizacao": "sincronização",
    "publicacao": "publicação",
    "unitarios": "unitários",
    "escrituracao": "escrituração",
    "operacoes": "operações",
    "validacoes": "validações",
    "funcoes": "funções",
    "informacoes": "informações",
    "balcao": "balcão",
    "referencia": "referência",
    "ausencia": "ausência",
    "explicita": "explícita",
    "ambito": "âmbito",
    "apos": "após",
    "ja": "já",
    "sao": "são",
}


def pt_text(value: str) -> str:
    output = value
    for source, target in sorted(PT_WORDS.items(), key=lambda item: len(item[0]), reverse=True):
        def replace(match: re.Match[str]) -> str:
            original = match.group(0)
            if original[:1].isupper():
                return target[:1].upper() + target[1:]
            return target

        output = re.sub(
            rf"(?<![A-Za-zÀ-ÖØ-öø-ÿ]){re.escape(source)}(?![A-Za-zÀ-ÖØ-öø-ÿ])",
            replace,
            output,
            flags=re.IGNORECASE,
        )
    return output


def safe_filename(name: str) -> Path:
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


class OnePage:
    def __init__(self, filename: str, doc_number: str, title: str, subtitle: str):
        self.path = safe_filename(filename)
        self.pdf = canvas.Canvas(str(self.path), pagesize=A4, pageCompression=1)
        self.pdf.setTitle(f"Estudo360 - {pt_text(title)}")
        self.pdf.setAuthor("Recofatima - Estudo360")
        self.pdf.setSubject("Dossier técnico SVAT - documento de trabalho")
        self.pdf.setCreator("Estudo360")
        self.pdf.setKeywords("Estudo360, SVAT, Portaria 293/2017, SAF-T")
        self.y = H - M
        self.bottom = 21 * mm
        self._header(doc_number, title, subtitle)

    def _header(self, number: str, title: str, subtitle: str) -> None:
        c = self.pdf
        c.setFillColor(INK)
        c.rect(0, H - 7 * mm, W, 7 * mm, fill=1, stroke=0)
        c.setFillColor(BLUE)
        c.rect(0, H - 7 * mm, 46 * mm, 7 * mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 7.2)
        c.drawString(M, H - 4.7 * mm, "ESTUDO360")
        c.setFont("Helvetica", 6.5)
        c.drawRightString(W - M, H - 4.7 * mm, "DOSSIER TÉCNICO SVAT")

        c.setFillColor(PAPER)
        c.setStrokeColor(LINE)
        c.roundRect(M, H - 42 * mm, CONTENT_W, 25 * mm, 3 * mm, fill=1, stroke=1)
        c.setFillColor(BLUE)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(M + 5 * mm, H - 25 * mm, number)
        c.setFillColor(INK)
        c.setFont("Times-Bold", 17)
        c.drawString(M + 18 * mm, H - 25 * mm, pt_text(title))
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.5)
        c.drawString(M + 18 * mm, H - 32 * mm, pt_text(subtitle))
        self.y = H - 51 * mm

    def space(self, amount: float = 3 * mm) -> None:
        self.y -= amount

    def heading(self, text: str, kicker: str | None = None) -> None:
        if self.y < self.bottom + 18 * mm:
            raise RuntimeError(f"{self.path.name}: espaco insuficiente antes de {text}")
        c = self.pdf
        if kicker:
            c.setFillColor(BLUE)
            c.setFont("Helvetica-Bold", 6.8)
            c.drawString(M, self.y, pt_text(kicker).upper())
            self.y -= 4.4 * mm
        c.setFillColor(INK)
        c.setFont("Times-Bold", 11.5)
        c.drawString(M, self.y, pt_text(text))
        self.y -= 3.1 * mm
        c.setStrokeColor(LINE)
        c.line(M, self.y, W - M, self.y)
        self.y -= 4.1 * mm

    def text(
        self,
        value: str,
        style: ParagraphStyle = BODY,
        gap: float = 2.4 * mm,
        left: float | None = None,
        width: float | None = None,
    ) -> None:
        left = M if left is None else left
        width = CONTENT_W if width is None else width
        paragraph = Paragraph(pt_text(value), style)
        _, height = paragraph.wrap(width, 1000)
        if self.y - height < self.bottom:
            raise RuntimeError(f"{self.path.name}: texto nao cabe ({value[:35]!r})")
        paragraph.drawOn(self.pdf, left, self.y - height)
        self.y -= height + gap

    def bullets(self, items: list[str], style: ParagraphStyle = BODY, gap: float = 1.45 * mm) -> None:
        for item in items:
            bullet_left = M + 1.5 * mm
            paragraph_left = M + 5.2 * mm
            paragraph_width = CONTENT_W - 5.2 * mm
            paragraph = Paragraph(pt_text(item), style)
            _, height = paragraph.wrap(paragraph_width, 1000)
            if self.y - height < self.bottom:
                raise RuntimeError(f"{self.path.name}: lista nao cabe ({item[:35]!r})")
            self.pdf.setFillColor(BLUE)
            self.pdf.circle(bullet_left + 0.8 * mm, self.y - 2.1 * mm, 0.85 * mm, fill=1, stroke=0)
            paragraph.drawOn(self.pdf, paragraph_left, self.y - height)
            self.y -= height + gap

    def callout(self, title: str, body: str, tone: str = "amber") -> None:
        fill = AMBER_LIGHT if tone == "amber" else GREEN_LIGHT if tone == "green" else BLUE_LIGHT
        border = AMBER if tone == "amber" else GREEN if tone == "green" else BLUE
        paragraph = Paragraph(pt_text(body), SMALL)
        title_width = stringWidth(title, "Helvetica-Bold", 7)
        _, body_h = paragraph.wrap(CONTENT_W - 10 * mm, 1000)
        box_h = body_h + 11 * mm
        if self.y - box_h < self.bottom:
            raise RuntimeError(f"{self.path.name}: callout nao cabe")
        self.pdf.setFillColor(fill)
        self.pdf.setStrokeColor(border)
        self.pdf.roundRect(M, self.y - box_h, CONTENT_W, box_h, 2.2 * mm, fill=1, stroke=1)
        self.pdf.setFillColor(border)
        self.pdf.setFont("Helvetica-Bold", 7)
        self.pdf.drawString(M + 4 * mm, self.y - 4 * mm, pt_text(title).upper())
        paragraph.drawOn(self.pdf, M + 4 * mm, self.y - 7.2 * mm - body_h)
        self.y -= box_h + 3 * mm
        # Keep stringWidth referenced so an empty title never produces a stray token.
        _ = title_width

    def table(
        self,
        columns: list[tuple[str, float, str]],
        rows: list[list[str]],
        row_height: float = 11.5 * mm,
        header_height: float = 7 * mm,
    ) -> None:
        total = sum(width for _, width, _ in columns)
        widths = [CONTENT_W * width / total for _, width, _ in columns]
        required = header_height + row_height * len(rows)
        if self.y - required < self.bottom:
            raise RuntimeError(f"{self.path.name}: tabela nao cabe")

        x_positions = [M]
        for width in widths[:-1]:
            x_positions.append(x_positions[-1] + width)

        self.pdf.setFillColor(INK)
        self.pdf.rect(M, self.y - header_height, CONTENT_W, header_height, fill=1, stroke=0)
        self.pdf.setFillColor(colors.white)
        self.pdf.setFont("Helvetica-Bold", 6.5)
        for (heading_text, _, _), x, width in zip(columns, x_positions, widths):
            self.pdf.drawString(x + 2 * mm, self.y - 4.5 * mm, pt_text(heading_text).upper())
        self.y -= header_height

        for index, row in enumerate(rows):
            if index % 2:
                self.pdf.setFillColor(PAPER)
                self.pdf.rect(M, self.y - row_height, CONTENT_W, row_height, fill=1, stroke=0)
            self.pdf.setStrokeColor(LINE)
            self.pdf.line(M, self.y - row_height, W - M, self.y - row_height)
            for (_, _, kind), value, x, width in zip(columns, row, x_positions, widths):
                style = TINY
                if kind == "status":
                    style = ParagraphStyle(
                        "status_cell",
                        parent=TINY,
                        fontName="Helvetica-Bold",
                        textColor=ROSE if value.startswith("Nao") else AMBER if value.startswith("Parcial") else GREEN,
                    )
                elif kind == "strong":
                    style = ParagraphStyle("strong_cell", parent=TINY, fontName="Helvetica-Bold", textColor=INK)
                paragraph = Paragraph(pt_text(value), style)
                _, height = paragraph.wrap(width - 3 * mm, row_height)
                paragraph.drawOn(self.pdf, x + 1.5 * mm, self.y - 2.2 * mm - height)
            self.y -= row_height
        self.y -= 3 * mm

    def fields(self, fields: list[tuple[str, str]]) -> None:
        for label, value in fields:
            self.pdf.setFillColor(MUTED)
            self.pdf.setFont("Helvetica-Bold", 7)
            self.pdf.drawString(M, self.y - 3 * mm, pt_text(label))
            self.pdf.setStrokeColor(LINE)
            self.pdf.line(M + 42 * mm, self.y - 3 * mm, W - M, self.y - 3 * mm)
            if value:
                self.pdf.setFillColor(INK)
                self.pdf.setFont("Helvetica", 8)
                self.pdf.drawString(M + 44 * mm, self.y - 3 * mm, pt_text(value))
            self.y -= 7 * mm
        self.space(1.5 * mm)

    def finish(self) -> None:
        c = self.pdf
        c.setStrokeColor(LINE)
        c.line(M, 15 * mm, W - M, 15 * mm)
        c.setFillColor(SOFT)
        c.setFont("Helvetica", 6.2)
        c.drawString(M, 10 * mm, "Documento de trabalho - 03/11/2026 - não representa aprovação da AT")
        c.drawRightString(W - M, 10 * mm, "Estudo360.pt")
        c.showPage()
        c.save()


def doc_capa() -> None:
    filename = "00-CAPA.pdf"
    d = OnePage(filename, "00", "Dossier SVAT", "Pedido de classificacao e organizacao de provas tecnicas")
    d.text("<b>Produto:</b> Estudo360", BODY)
    d.text("<b>Produtor:</b> Recofatima - NIF 510 770 460", BODY)
    d.text("<b>Data desta revisao:</b> 03/11/2026", BODY)
    d.space(8 * mm)
    d.callout(
        "Estado",
        "Documento preparatorio. Nao existe candidatura submetida, selo atribuido, aprovacao da AT ou parecer de conformidade. O primeiro ato e pedir a classificacao do produto no e-balcao.",
        "amber",
    )
    d.heading("Base legal", "Referencia oficial")
    d.text("Portaria n.º 293/2017, de 2 de outubro, que cria o Selo de Validacao AT (SVAT) e regula a sua atribuicao aos programas de contabilidade quanto a producao do ficheiro de auditoria SAF-T (PT).", BODY)
    d.text("A AT notifica o produtor num prazo de 30 dias apos o pedido para indicar os elementos necessarios aos testes. O selo, quando atribuido, tem validade de 24 meses.", SMALL)
    d.finish()


def doc_indice() -> None:
    d = OnePage(
        "00-INDICE.pdf",
        "00",
        "Indice do dossier",
        "Ordem recomendada para consulta e eventual submissao",
    )
    rows = [
        ["00", "Leia primeiro", "Estado, limites e proxima acao"],
        ["01", "Memoria descritiva", "O que o Estudo360 faz e nao faz"],
        ["02", "Matriz de conformidade", "Requisitos a-i sem inflacao de resultados"],
        ["03", "Dicionario de dados", "Colecoes, campos e permissoes"],
        ["04", "Checklist", "O que esta pronto e o que falta validar"],
        ["05", "Guia do e-balcao", "Percurso oficial de submissao"],
        ["06", "Pedido de classificacao", "Texto para adaptar e enviar"],
        ["07", "Declaracao do produtor", "Minuta condicionada, por preencher"],
        ["08", "Identidade e uso", "Regras para nao antecipar um selo"],
        ["09", "Anexos tecnicos", "Controlos e limitacoes declaradas"],
    ]
    d.table(
        [("N.º", 7, "strong"), ("Documento", 28, "strong"), ("Conteudo", 65, "text")],
        rows,
        row_height=10.2 * mm,
    )
    d.callout(
        "Leitura correta",
        "Os documentos 01-03 e 09 descrevem tecnicamente o produto. O documento 07 so deve ser assinado se a AT confirmar que o produto esta no ambito do SVAT e se todos os requisitos aplicaveis estiverem demonstrados.",
        "blue",
    )
    d.finish()


def doc_leia() -> None:
    d = OnePage(
        "00-LEIA-PRIMEIRO.pdf",
        "00",
        "Leia primeiro",
        "O essencial em dois minutos",
    )
    d.callout(
        "Situacao atual",
        "Nao foi submetido nenhum pedido. Nao existe selo. O Estudo360 nao deve ser apresentado como tendo validacao oficial da AT.",
        "amber",
    )
    d.heading("O que ja esta confirmado", "Factos")
    d.bullets([
        "<b>A Portaria n.º 293/2017 e a base oficial do SVAT.</b> O regime visa programas de contabilidade e a producao/exportacao do SAF-T de contabilidade.",
        "<b>O Estudo360 le e guarda SAF-T, mas nao produz escrituracao contabilistica.</b> Tambem nao gera o ficheiro SAF-T de contabilidade para submissao.",
        "<b>Os requisitos h) e i) nao estao implementados.</b> A matriz 02 marca essa ausencia de forma explicita.",
        "<b>A AT responde num prazo de 30 dias com os elementos necessarios aos testes.</b> Isso nao significa aprovacao em 30 dias.",
        "<b>Se o SVAT for atribuido, o selo tem validade de 24 meses.</b> A renovacao e pedida pelo produtor.",
    ])
    d.heading("Ordem recomendada", "Proximos atos")
    d.bullets([
        "<b>Pedir classificacao:</b> usar o e-balcao em Outras Obrigacoes > SVAT > Submissao e anexar os documentos 01, 02, 03, 06 e 09.",
        "<b>Nao enviar o Mod. 334 como candidatura enquanto o enquadramento nao estiver confirmado.</b>",
        "<b>Completar os dados do produtor:</b> representante legal, assinante, endereco e contactos ainda necessitam confirmacao.",
        "<b>Atualizar o dossier com a resposta da AT.</b> So depois decidir se existe candidatura a preparar.",
    ])
    d.heading("Limites desta pasta", "Transparencia")
    d.text("Este dossier organiza factos e provas. Nao cria direitos, nao substitui o pedido oficial e nao permite usar o nome, logotipo ou selo da Autoridade Tributaria.", BODY)
    d.finish()


def doc_memoria() -> None:
    d = OnePage(
        "01-Memoria-Descritiva.pdf",
        "01",
        "Memoria descritiva",
        "Estudo360 - ambito funcional e tecnico",
    )
    d.heading("Identificacao", "Produto e produtor")
    d.text("<b>Produtor:</b> Recofatima, NIF 510 770 460. <b>Produto:</b> Estudo360, plataforma web para gabinetes de contabilidade. <b>Versao em avaliacao:</b> versao em producao na data de 03/11/2026.", BODY)
    d.heading("Finalidade", "O que e")
    d.text("O Estudo360 organiza trabalho de gabinete: clientes, tarefas, obrigacoes, agenda, documentos, cofre de credenciais, simuladores fiscais e propostas. Ajuda o utilizador a analisar informacao e a preparar trabalho, mas nao substitui o sistema de contabilidade.", BODY)
    d.heading("Funcoes relevantes", "Capacidades")
    d.bullets([
        "<b>Gestao multi-gabinete:</b> separacao de dados e permissoes por gabinete.",
        "<b>Autenticacao:</b> contas normais e acessos de colaborador criados pelo gabinete.",
        "<b>Importacao de SAF-T:</b> leitura de XML, validacao estrutural, extracao de dados e preenchimento de perfil e simuladores.",
        "<b>Consulta de dados importados:</b> visualizacao dos campos e secoes reconhecidas no SAF-T.",
        "<b>Auditoria e controlo:</b> registos de operacoes sensiveis, regras Firestore e controlos server-side.",
        "<b>Exportacao documental:</b> relatorios A4, propostas e documentos de apoio em PDF/Word.",
    ])
    d.heading("Fronteira do ambito", "O que nao e")
    d.callout(
        "Fora do ambito contabilistico",
        "O Estudo360 nao mantem diarios, razao, balancete, lancamentos, inventario ou fecho contabilistico. Nao produz o ficheiro SAF-T de contabilidade nem exporta um SAF-T de auditoria gerado pela aplicacao. O XML importado e conservado como fonte externa e os seus dados sao transformados para apoio ao trabalho.",
        "amber",
    )
    d.heading("Controlo de acesso", "Seguranca")
    d.text("As regras do Firestore isolam clientes, tarefas, cofre e documentos por gabinete. Funcoes server-side criam, atualizam e revogam acessos da equipa. Os segredos de servico nao sao enviados ao browser.", BODY)
    d.text("<b>Conclusao:</b> o produto tem controlos uteis de autenticacao, auditoria e isolamento, mas nao reune os requisitos contabilisticos h) e i) da Portaria n.º 293/2017.", SMALL)
    d.finish()


def doc_matriz() -> None:
    d = OnePage(
        "02-Matriz-Conformidade.pdf",
        "02",
        "Matriz de conformidade",
        "Avaliacao literal dos requisitos a) a i) do artigo 3.º",
    )
    rows = [
        ["a) Utilizadores autenticados e perfis", "Parcial", "Firebase Auth, cargos e regras por gabinete. Nao existe processamento contabilistico para alem dos dados operacionais."],
        ["b) Documentacao abrangente", "Implementado", "Guias internos, dicionario de dados, documentacao funcional e esta memoria."],
        ["c) Integridade, integralidade e fiabilidade", "Parcial", "Escritas validadas e isolamento por gabinete; nao existe livro contabilistico para submeter a esses controlos."],
        ["d) Prevenir, detetar, reverter e corrigir erros", "Parcial", "Validacoes e auditoria em fluxos operacionais; nao existe registo contabilistico nem reconciliacao com normas contabilisticas."],
        ["e) Impedir alteracao/eliminacao de processamentos", "Parcial", "Registos de auditoria imutaveis e lixeira; nao cobre processamentos contabilisticos inexistentes."],
        ["f) Pistas de auditoria e reconstrucao", "Parcial", "Eventos de acesso e operacoes relevantes; nao existe trilho contabilistico completo."],
        ["g) Arquivo, salvaguarda e restauro", "Parcial", "Persistencia em Firestore e politicas de seguranca; nao foi demonstrado um arquivo legal de registos contabilisticos."],
        ["h) Exportacao SAF-T correta e sem erros", "Nao implementado", "A aplicacao importa e conserva SAF-T. Nao gera nem exporta o ficheiro SAF-T de contabilidade."],
        ["i) SAF-T com todos os processamentos necessarios", "Nao implementado", "Nao existe escrituracao contabilistica nem a totalidade de processamentos exigida para preencher o SAF-T."],
    ]
    d.table(
        [("Requisito", 27, "strong"), ("Estado", 14, "status"), ("Evidencia e limite", 59, "text")],
        rows,
        row_height=15.2 * mm,
        header_height=7 * mm,
    )
    d.callout(
        "Conclusao",
        "A classificacao honesta e: 1 requisito implementado, 6 parciais e 2 nao implementados. O Estudo360 nao deve assinar os campos h) e i) como 'Sim' no Mod. 334.",
        "amber",
    )
    d.text("Data da avaliacao: 03/11/2026. Reavaliar sempre que forem adicionadas funcoes contabilisticas ou exportacao SAF-T.", TINY)
    d.finish()


def doc_dicionario() -> None:
    d = OnePage(
        "03-Dicionario-Dados.pdf",
        "03",
        "Dicionario de dados",
        "Colecoes relevantes, finalidade e acesso",
    )
    rows = [
        ["gabinetes/{id}", "Metadados do gabinete, membros, cargos e permissoes.", "Dono e membros efetivos."],
        ["gabinete/{id}/{col}/{doc}", "Clientes, tarefas, obrigacoes, cofre, agenda e documentos operacionais.", "Membros autorizados; cofre exige permissao."],
        ["employeeCredentials/{id}", "Credencial tecnica, cargo, estado e ligacao ao UID normal.", "Exclusivo do servidor."],
        ["employeeLoginIndexes/{hash}", "Indice de credenciais por email sem guardar email em claro na chave.", "Exclusivo do servidor."],
        ["employeeProfiles/{uid}", "Nome real, estado e gabinete mostrados ao colaborador.", "Leitura apenas pelo proprio UID."],
        ["audit_events/{id}", "Eventos imutaveis de acesso e operacoes sensiveis.", "Autor e administrador da aplicacao."],
        ["updates/{id}", "Notas e proximos passos versionados das atualizacoes.", "Leitura publica; escrita so admin."],
        ["empresas/{officeId}/...", "Carteira de clientes e simulacoes por gabinete.", "Membros do gabinete."],
    ]
    d.table(
        [("Colecao / caminho", 31, "strong"), ("Finalidade", 43, "text"), ("Acesso", 26, "text")],
        rows,
        row_height=13.9 * mm,
        header_height=7 * mm,
    )
    d.heading("Fronteira de dados", "SAF-T e contabilidade")
    d.text("O XML SAF-T importado e guardado dentro do registo do cliente para consulta e reprocessamento. A aplicacao deriva perfil, contabilidade e dados de simulacao, mas nao cria livros contabilisticos nem exporta um SAF-T produzido por ela.", BODY)
    d.heading("Protecao", "Controlos")
    d.bullets([
        "Regras Firestore por uid, membro, cargo e permissao.",
        "Cofre com cifra AES-GCM no dispositivo.",
        "Funcoes server-side com conta de servico para gerir credenciais.",
        "Auditoria imutavel para operacoes de acesso e seguranca.",
    ], SMALL)
    d.finish()


def doc_checklist() -> None:
    d = OnePage(
        "04-Checklist-Submissao.pdf",
        "04",
        "Checklist de submissao",
        "Documentos prontos e confirmacoes ainda pendentes",
    )
    d.heading("Pronto para revisao", "Controlo interno")
    d.bullets([
        "<b>Base legal identificada:</b> Portaria n.º 293/2017 e Mod. 334 oficiais.",
        "<b>Produto descrito sem exagerar o ambito:</b> memoria 01 e matriz 02.",
        "<b>Dados e permissoes documentados:</b> dicionario 03 e anexos 09.",
        "<b>Pedido de classificacao redigido:</b> documento 06.",
        "<b>Regra de uso de marca definida:</b> documento 08.",
    ])
    d.heading("Ainda nao pode ser enviado", "Dependencias externas")
    d.bullets([
        "<b>Resposta da AT sobre o enquadramento.</b>",
        "<b>Nome e NIF do representante legal e do assinante.</b>",
        "<b>Endereco, codigo postal e contactos oficiais do produtor.</b>",
        "<b>Versao final do produto e, se aplicavel, n.º de deposito na ASSOFT.</b>",
        "<b>Implementacao efetiva dos requisitos h) e i), caso a AT confirme que o produto esta no ambito.</b>",
        "<b>Testes de conformidade solicitados pela AT.</b>",
    ])
    d.heading("Canal oficial", "E-balcao")
    d.text("<b>Portal das Financas > e-balcao > Outras Obrigacoes > SVAT > Submissao.</b>", BODY)
    d.callout(
        "Antes de carregar qualquer documento",
        "Confirmar que o texto nao afirma que existe selo, candidatura submetida ou conformidade integral. Guardar o comprovativo do pedido nesta pasta apenas depois de o envio ser confirmado pelo portal.",
        "blue",
    )
    d.text("O prazo de 30 dias da AT respeita a notificacao dos elementos necessarios aos testes. O selo tem validade de 24 meses a contar da atribuicao.", SMALL)
    d.finish()


def doc_guia() -> None:
    d = OnePage(
        "05-Guia-E-balcao-Passo-a-Passo.pdf",
        "05",
        "Guia do e-balcao",
        "Pedido de classificacao ao abrigo do SVAT",
    )
    d.callout(
        "Antes de comecar",
        "Este guia e para pedir informacao sobre o enquadramento. Nao e uma instrucao para declarar conformidade integral nem para submeter o Mod. 334 sem resposta previa da AT.",
        "amber",
    )
    d.heading("Percurso oficial", "Passo a passo")
    steps = [
        ("01", "Entrar no Portal das Financas", "Usar as credenciais do produtor. Nao partilhar password ou codigo de acesso."),
        ("02", "Abrir o e-balcao", "Escolher a area de submissao indicada pela AT para assuntos de SVAT."),
        ("03", "Selecionar Outras Obrigacoes > SVAT > Submissao", "Este e o percurso publicado pela AT para a materia."),
        ("04", "Escrever o pedido de classificacao", "Adaptar o texto do documento 06 e indicar que o Estudo360 apenas importa/le SAF-T."),
        ("05", "Anexar provas tecnicas", "Anexar 01, 02, 03, 06 e 09. O 04 e uma checklist interna e pode ficar fora do envio."),
        ("06", "Rever e submeter", "Confirmar que nao existem campos obrigatorios vazios e que o discurso nao promete conformidade."),
        ("07", "Guardar o comprovativo", "Descarregar o comprovativo e registar data, numero do pedido e resposta recebida."),
    ]
    for number, title, body in steps:
        d.pdf.setFillColor(BLUE_LIGHT)
        d.pdf.circle(M + 3 * mm, d.y - 3 * mm, 3 * mm, fill=1, stroke=0)
        d.pdf.setFillColor(BLUE)
        d.pdf.setFont("Helvetica-Bold", 6.7)
        d.pdf.drawCentredString(M + 3 * mm, d.y - 4.1 * mm, number)
        d.text(f"<b>{title}.</b> {body}", BODY, gap=1.7 * mm, left=M + 9 * mm, width=CONTENT_W - 9 * mm)
    d.heading("Depois de submeter", "Resposta")
    d.text("A AT dispõe de 30 dias para notificar o produtor com a indicacao dos elementos necessarios para analise e testes. Nao existe aprovacao automatica decorrido esse prazo.", SMALL)
    d.text("Qualquer resposta oficial deve ser anexada a este dossier e refletida na pagina publica de atualizacoes.", SMALL)
    d.finish()


def doc_texto() -> None:
    d = OnePage(
        "06-Texto-Pronto-para-colar.pdf",
        "06",
        "Pedido de classificacao",
        "Texto para adaptar no e-balcao",
    )
    body = clean(
        """
        Assunto: SVAT - pedido de classificacao de plataforma que importa SAF-T, mas nao produz contabilidade

        Exmos. Senhores,

        A Recofatima, NIF 510 770 460, e produtora do Estudo360, uma aplicacao web de apoio a gabinetes de contabilidade. O produto organiza clientes, tarefas, obrigacoes, documentos, credenciais, simuladores e propostas. Importa e conserva ficheiros SAF-T (PT) fornecidos pelos clientes para extracao e analise de dados.

        O Estudo360 nao mantem escrituracao contabilistica, nao processa lancamentos, nao produz diarios ou razao e nao gera/exporta o ficheiro SAF-T (PT) de contabilidade. Nao foi submetido qualquer pedido de SVAT e nao esta a ser usado o selo ou o nome da AT.

        Tendo em conta a Portaria n.º 293/2017, de 2 de outubro, solicitamos que nos seja confirmado:

        1. Se uma plataforma com estas caracteristicas esta abrangida pelo SVAT;
        2. Estando abrangida, quais os requisitos adicionais e o formulario aplicavel;
        3. Nao estando abrangida, se e necessaria alguma declaracao ou registo;
        4. Qual o formato e canal corretos para apresentar os elementos tecnicos que a AT venha a solicitar.

        Anexamos memoria descritiva, matriz dos requisitos a) a i), dicionario de dados e anexos tecnicos. A matriz identifica de forma expressa que os requisitos h) e i) nao estao implementados.

        Ficamos disponiveis para prestar qualquer esclarecimento.

        Com os melhores cumprimentos,
        Recofatima - Estudo360.pt
        """
    )
    paragraphs = body.split("\n\n")
    for index, paragraph in enumerate(paragraphs):
        d.text(paragraph, BODY if index not in (0,) else ParagraphStyle("subject", parent=BODY, fontName="Helvetica-Bold"), gap=2.4 * mm)
    d.callout(
        "Antes de enviar",
        "Confirmar o nome, NIF e contactos do representante que subscreve o pedido. Nao acrescentar afirmacoes de conformidade que nao estejam sustentadas pela matriz 02.",
        "amber",
    )
    d.finish()


def doc_declaracao() -> None:
    d = OnePage(
        "07-Declaracao-Produtor.pdf",
        "07",
        "Declaracao do produtor",
        "Minuta condicionada - nao assinar antes da confirmacao da AT",
    )
    d.callout(
        "Documento incompleto de proposito",
        "Os campos de representante legal, assinante, endereco e versao devem ser confirmados pelos responsaveis da Recofatima. Esta minuta nao pode ser usada para declarar os requisitos h) e i) enquanto a funcionalidade nao existir.",
        "amber",
    )
    d.heading("Identificacao", "Campos a completar")
    d.fields([
        ("Produtor", "Recofatima"),
        ("NIF", "510 770 460"),
        ("Programa", "Estudo360"),
        ("Versao", "________________________________________"),
        ("Representante legal", "________________________________________"),
        ("NIF do representante", "________________________________________"),
        ("Assinante", "________________________________________"),
        ("Endereco", "________________________________________"),
        ("Email / telefone", "________________________________________"),
        ("Deposito ASSOFT", "Nao aplicavel / a confirmar"),
    ])
    d.heading("Declaracao", "Texto condicionado")
    d.text("Para efeitos do pedido de SVAT, o produtor identifica o programa acima e compromete-se a demonstrar, perante a AT e durante os testes de conformidade, as funcionalidades aplicaveis do artigo 3.º da Portaria n.º 293/2017.", BODY)
    d.text("A assinatura desta minuta apenas pode ocorrer depois de: (1) a AT confirmar o enquadramento; (2) o produto cumprir todos os requisitos aplicaveis; (3) existir evidencia tecnica aprovada internamente; e (4) o representante legal confirmar os dados institucionais.", SMALL)
    d.space(7 * mm)
    d.pdf.setStrokeColor(INK)
    d.pdf.line(M, 45 * mm, M + 72 * mm, 45 * mm)
    d.pdf.line(W - M - 72 * mm, 45 * mm, W - M, 45 * mm)
    d.pdf.setFillColor(MUTED)
    d.pdf.setFont("Helvetica", 6.5)
    d.pdf.drawString(M, 40 * mm, "Assinante / representante legal")
    d.pdf.drawRightString(W - M, 40 * mm, "Data")
    d.finish()


def doc_identidade() -> None:
    d = OnePage(
        "08-Identidade-e-Uso.pdf",
        "08",
        "Identidade e uso",
        "Regras para comunicar o estado do SVAT",
    )
    d.callout(
        "Regra principal",
        "Enquanto a AT nao atribuir oficialmente o SVAT, o Estudo360 nao usa o logotipo da AT, um selo oficial nem qualquer expressao que indique uma certificacao inexistente.",
        "amber",
    )
    d.heading("Formulacoes permitidas", "Comunicacao")
    d.bullets([
        "<b>Antes de resposta:</b> 'Estamos a preparar um pedido de classificacao do enquadramento SVAT.'",
        "<b>Depois de pedir informacao:</b> 'Pedido de classificacao submetido ao e-balcao, aguardando resposta.'",
        "<b>Se a AT confirmar que nao se aplica:</b> 'A AT confirmou que o produto nao esta abrangido pelo SVAT.' Registar a referencia e data.",
        "<b>So depois da atribuicao:</b> usar o selo e a identificacao da versao exatamente como constarem na lista oficial da AT.",
    ])
    d.heading("Formulacoes proibidas", "Antes de atribuicao")
    d.bullets([
        "Nomes ou alegacoes que sugiram certificacao, pontuacao oficial ou aprovacao regulatoria ja obtida.",
        "Uso de imagem, emblema ou tipografia que imite a Autoridade Tributaria.",
        "Associacao da Recofatima ou do Estudo360 a uma certificacao que nao exista.",
    ], SMALL)
    d.heading("Marca do produto", "Estudo360")
    d.text("A identidade visual deve identificar o Estudo360 como produto da Recofatima. A utilizacao por gabinetes clientes nao transfere a propriedade intelectual nem cria uma subcertificacao.", SMALL)
    d.heading("Registo interno", "Historico")
    d.text("Guardar neste dossier: data do pedido, numero do comprovativo, resposta da AT, versao avaliada, responsavel interno e qualquer alteracao posterior do produto.", SMALL)
    d.finish()


def doc_anexos() -> None:
    d = OnePage(
        "09-Anexos-Tecnicos.pdf",
        "09",
        "Anexos tecnicos",
        "Controlos existentes e limitacoes declaradas",
    )
    d.heading("Autenticacao e permissoes", "Controlo de acesso")
    d.bullets([
        "Contas normais usam Firebase Authentication.",
        "Contas de equipa sao criadas pelo gabinete e autenticadas no servidor com claims proprias.",
        "Cargos base e personalizados definem permissoes no cliente e no servidor.",
        "Funcoes server-side verificam perfil, cargo e permissao antes de alterar acessos.",
    ], SMALL)
    d.heading("Isolamento de dados", "Firestore")
    d.bullets([
        "Regras restringem clientes, tarefas, cofre e documentos ao gabinete e ao cargo.",
        "O cofre tem controlo adicional de leitura e escrita.",
        "Colecoes de credenciais sao fechadas ao browser; o servidor usa conta de servico.",
        "Perfis de colaborador e indices de login nao expoem passwords.",
    ], SMALL)
    d.heading("Auditoria e continuidade", "Operacoes")
    d.bullets([
        "Eventos de auditoria sao imutaveis para o utilizador comum.",
        "Criacao, alteracao, reposicao e remocao de acessos sao registadas.",
        "A aplicacao mantem fila de sincronizacao e aviso de falha.",
        "O cofre usa AES-GCM; a passphrase nao e enviada ao servidor.",
    ], SMALL)
    d.heading("Testes e limites", "Evidencia")
    d.text("Antes de cada publicacao devem correr TypeScript, testes unitarios, build, auditoria das regras Firestore e fluxos de equipa. Os resultados nao substituem os testes de conformidade da AT.", SMALL)
    d.callout(
        "Limitacao decisiva",
        "Nao existe modelo de diario/razao contabilistico, geracao do SAF-T de contabilidade, reconciliacao de processamentos nem exportacao validada contra o esquema oficial. Por isso h) e i) permanecem 'Nao implementado'.",
        "amber",
    )
    d.finish()


def generate() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for function in [
        doc_capa,
        doc_indice,
        doc_leia,
        doc_memoria,
        doc_matriz,
        doc_dicionario,
        doc_checklist,
        doc_guia,
        doc_texto,
        doc_declaracao,
        doc_identidade,
        doc_anexos,
    ]:
        function()


def verify() -> None:
    RENDER.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    files = sorted(OUT.glob("*.pdf"))
    expected = {
        "00-CAPA.pdf",
        "00-INDICE.pdf",
        "00-LEIA-PRIMEIRO.pdf",
        "01-Memoria-Descritiva.pdf",
        "02-Matriz-Conformidade.pdf",
        "03-Dicionario-Dados.pdf",
        "04-Checklist-Submissao.pdf",
        "05-Guia-E-balcao-Passo-a-Passo.pdf",
        "06-Texto-Pronto-para-colar.pdf",
        "07-Declaracao-Produtor.pdf",
        "08-Identidade-e-Uso.pdf",
        "09-Anexos-Tecnicos.pdf",
    }
    names = {path.name for path in files}
    if names != expected:
        errors.append(f"Ficheiros inesperados: faltam={sorted(expected - names)} sobram={sorted(names - expected)}")
    forbidden = [
        "9/9",
        "dossier 100% pronto",
        "sem objeto",
        "certificacao.software@at.gov.pt",
        "selo SVAT atribuido",
        "validado pela AT",
    ]
    for path in files:
        document = pymupdf.open(path)
        if len(document) != 1:
            errors.append(f"{path.name}: {len(document)} paginas")
        page = document[0]
        width, height = page.rect.width, page.rect.height
        if abs(width - A4[0]) > 1 or abs(height - A4[1]) > 1:
            errors.append(f"{path.name}: tamanho {width:.2f}x{height:.2f}")
        text = page.get_text().strip()
        if len(text) < 180:
            errors.append(f"{path.name}: texto insuficiente ({len(text)})")
        lower = text.lower()
        for phrase in forbidden:
            if phrase.lower() in lower:
                errors.append(f"{path.name}: frase proibida {phrase!r}")
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6), alpha=False)
        pix.save(RENDER / f"{path.stem}.png")
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"OK - {len(files)} PDFs, todos com 1 pagina A4 e texto verificavel.")


if __name__ == "__main__":
    generate()
    verify()
