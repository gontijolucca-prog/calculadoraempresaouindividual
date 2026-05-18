import React, { useState } from 'react';
import type { ClientProfile } from './ClientProfile';
import type { OfficeSettings } from './lib/officeSettings';
import { type HonorariosConfig, type PropostaResultado, calcularProposta } from './lib/honorarios';

interface Props {
  profile: ClientProfile;
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  /** IDs dos serviços extra incluídos na proposta — para alinhar valor com a Proposta. */
  servicosIds?: string[];
  /** Override do tipo de outorgante do cliente (singular/colectivo). Por defeito infere do tipoEntidade. */
  clienteEhPessoaColetiva?: boolean;
  /** Data de início do contrato (ISO ou formato livre). Por defeito = hoje. */
  dataInicio?: string;
  /** Periodicidade dos balancetes. */
  periodicidadeBalancetes?: 'mensal' | 'bimensal' | 'trimestral';
  /** Periodicidade da faturação de material de expediente. */
  periodicidadeMaterial?: 'mensal' | 'trimestral';
  printRootId?: string;
}

const eur = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

const ptDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Texto de fallback a destacar — para placeholders não preenchidos. */
function P({ v, w = '—' }: { v: string | number | undefined | null; w?: string }) {
  if (v === null || v === undefined || v === '' || v === 0) {
    return <span style={{ background: '#FEF3C7', color: '#92400E', padding: '0 4px', borderRadius: 3, fontWeight: 600 }}>{w}</span>;
  }
  return <strong>{v}</strong>;
}

/**
 * Minuta de Contrato de Prestação de Serviços de Contabilidade, fiel ao modelo
 * publicado pela Ordem dos Contabilistas Certificados (OCC). O texto é
 * essencialmente o documento original com os placeholders preenchidos a partir
 * dos dados do escritório (Primeiro Outorgante), cliente (Segundo Outorgante)
 * e honorários acordados. Todas as cláusulas são editáveis em-linha
 * (contenteditable) antes da impressão.
 */
export default function MinutaContrato({
  profile, office, honorarios, servicosIds, clienteEhPessoaColetiva,
  dataInicio, periodicidadeBalancetes = 'mensal', periodicidadeMaterial = 'trimestral',
  printRootId = 'minuta-print-root',
}: Props) {
  const proposta: PropostaResultado = calcularProposta(profile, honorarios, servicosIds);

  // Inferência: se cliente é uma sociedade (não ENI), assume pessoa colectiva.
  const pessoaColetiva = clienteEhPessoaColetiva ?? ['lda', 'unipessoal', 'sa', 'socio_unico'].includes(profile.tipoEntidade);
  const escritorioSociedade = office.tipo === 'sociedade';

  const moradaCliente = [profile.morada, profile.codigoPostal, profile.localidade].filter(Boolean).join(', ');
  const moradaEscritorio = [office.morada, office.codigoPostal, office.localidade].filter(Boolean).join(', ');

  const cor = office.corPrimaria || '#7B98B8';

  // Identificação do contabilista responsável (cláusula 1.ª nº 3).
  const ccResponsavel = escritorioSociedade ? (office.contabilistaResponsavel || office.nome) : office.nome;
  const ccCedula = office.cedulaProfissional;

  const [edits, setEdits] = useState<Record<string, string>>({});
  const Editable = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={e => setEdits(p => ({ ...p, [id]: e.currentTarget.innerText }))}
      style={{ outline: 'none', cursor: 'text' }}
    >{edits[id] ?? children}</span>
  );

  return (
    <div id={printRootId} className="bg-white" style={{ color: '#1E293B' }}>
      <style>{`
        #${printRootId} { font-family: Georgia, 'Times New Roman', Times, serif; }
        #${printRootId} .mc-page { width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 22mm 24mm; margin: 0 auto; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        #${printRootId} h1 { font-size: 18pt; text-align: center; letter-spacing: 1px; margin: 0 0 16px 0; color: ${cor}; }
        #${printRootId} h2 { font-size: 11pt; text-align: center; margin: 22px 0 6px 0; letter-spacing: 1.5px; text-transform: uppercase; color: #0F172A; }
        #${printRootId} .mc-sub { font-size: 9pt; text-align: center; color: #64748B; margin: 0 0 12px 0; font-style: italic; }
        #${printRootId} p { font-size: 11pt; line-height: 1.55; text-align: justify; margin: 6px 0; }
        #${printRootId} ol { padding-left: 22px; }
        #${printRootId} ol li { font-size: 11pt; line-height: 1.55; text-align: justify; margin: 5px 0; }
        #${printRootId} .mc-band { height: 4px; background: ${cor}; margin: -22mm -24mm 12mm -24mm; }
        @media print {
          body * { visibility: hidden; }
          #${printRootId}, #${printRootId} * { visibility: visible; }
          #${printRootId} { position: absolute; top: 0; left: 0; width: 100%; }
          #${printRootId} .mc-page { box-shadow: none; margin: 0; page-break-after: always; zoom: 1 !important; }
          #${printRootId} .mc-page:last-child { page-break-after: auto; }
          @page { size: A4; margin: 0; }
        }
        /* Em ecrãs estreitos a folha A4 não cabe — encolhe com zoom (impressão fica intacta). */
        @media screen and (max-width: 820px) {
          #${printRootId} .mc-page { zoom: 0.46; }
        }
        @media screen and (max-width: 480px) {
          #${printRootId} .mc-page { zoom: 0.42; }
        }
        @media screen and (max-width: 380px) {
          #${printRootId} .mc-page { zoom: 0.38; }
        }
      `}</style>

      <div className="mc-page">
        <div className="mc-band" />

        <h1>Minuta de Contrato de Prestação de Serviços</h1>
        <p className="mc-sub">Adaptada da minuta-modelo publicada pela Ordem dos Contabilistas Certificados</p>

        <p style={{ marginTop: 16 }}><strong>ENTRE:</strong></p>

        {/* Primeiro Outorgante — depende se é individual ou sociedade */}
        {!escritorioSociedade ? (
          <p>
            <strong>PRIMEIRO OUTORGANTE:</strong> Contabilista Certificado <P v={office.nome} w="(nome)" />,
            titular da cédula profissional n.º <P v={office.cedulaProfissional} w="_____" />,
            com domicílio profissional em <P v={moradaEscritorio} w="(morada)" /> e NIF <P v={office.nif} w="_____" />,
            de ora em diante abreviadamente designado por <em>“Primeiro Outorgante”</em>;
          </p>
        ) : (
          <p>
            <strong>PRIMEIRO OUTORGANTE:</strong> <P v={office.nome} w="(firma)" />, com sede em <P v={moradaEscritorio} w="(sede)" />,
            NIPC <P v={office.nif} w="_____" />, inscrita na Ordem dos Contabilistas Certificados sob o n.º <P v={office.numeroInscricaoOCC} w="_____" />,
            aqui representada por <P v={office.representanteLegal} w="(representante legal)" />, com poderes para o ato,
            de ora em diante abreviadamente designada por <em>“Primeiro Outorgante”</em>;
          </p>
        )}

        <p style={{ marginTop: 8 }}><strong>E</strong></p>

        {/* Segundo Outorgante */}
        {!pessoaColetiva ? (
          <p>
            <strong>SEGUNDO OUTORGANTE:</strong> <P v={profile.nomeCliente} w="(nome)" />,
            titular do cartão do cidadão n.º <Editable id="cliente_cc">_____</Editable>,
            NIF <P v={profile.nif} w="_____" />, com domicílio na <P v={moradaCliente} w="(morada)" />,
            de ora em diante abreviadamente designado por <em>“Segundo Outorgante”</em>;
          </p>
        ) : (
          <p>
            <strong>SEGUNDO OUTORGANTE:</strong> <P v={profile.nomeCliente} w="(firma)" />,
            com o n.º de Identificação de Pessoa Coletiva <P v={profile.nif} w="________" />,
            com sede em <P v={moradaCliente} w="___________" />,
            aqui representada pelo gerente/administrador <Editable id="cliente_gerente">__________</Editable> com poderes para o ato,
            conforme certidão comercial permanente com o código <Editable id="certidao_codigo">_____</Editable>{' '}
            e válida até <Editable id="certidao_validade">________</Editable>,
            de ora em diante abreviadamente designada por <em>“Segundo Outorgante”</em>;
          </p>
        )}

        <p>E em conjunto, abreviadamente, designados por <em>“Partes”</em>,</p>

        <p style={{ marginTop: 10 }}>
          É celebrado e reciprocamente aceite o presente Contrato de Prestação de Serviços (<em>Contrato</em>),
          o qual se rege nos termos das cláusulas seguintes:
        </p>

        {/* ─── CLÁUSULA PRIMEIRA ─── */}
        <h2>Cláusula Primeira</h2>
        <p className="mc-sub">(Objeto do Contrato e identificação do contabilista certificado)</p>
        <ol>
          <li>
            Pelo presente contrato, o Primeiro Outorgante obriga-se a executar a contabilidade do Segundo Outorgante de acordo com os
            princípios e normas contabilísticas e as exigências legais em vigor, assumindo a responsabilidade pela regularidade técnica,
            nas áreas contabilística e fiscal, nos termos definidos pelo artigo 10.º, n.os 1 e 3, do Estatuto da Ordem dos Contabilistas
            Certificados, aprovado pelo Decreto-Lei n.º 452/99, de 5 de novembro, com as alterações introduzidas pelo Decreto-Lei n.º 310/09,
            de 26 de outubro, e pela Lei n.º 139/2015, de 7 de setembro (doravante <em>EOCC</em>).
          </li>
          <li>
            Os serviços referidos no número anterior incluem o encerramento das contas do exercício, o preenchimento e envio das declarações
            fiscais e seus anexos, organização do dossier fiscal e o fornecimento de balancetes com periodicidade <strong>{periodicidadeBalancetes}</strong>{' '}
            <Editable id="outros_servicos">(e demais serviços a definir)</Editable>.
          </li>
          <li>
            Nos termos e para os efeitos do n.º 1 da presente Cláusula, o Contabilista Certificado <P v={ccResponsavel} w="(nome do contabilista)" />,
            titular da cédula profissional n.º <P v={ccCedula} w="_____" />,
            {escritorioSociedade && <> registado como Diretor Técnico do Primeiro Outorgante,</>}{' '}
            assumirá a responsabilidade pela regularidade técnica da contabilidade do Segundo Outorgante.
          </li>
        </ol>

        {/* ─── CLÁUSULA SEGUNDA ─── */}
        <h2>Cláusula Segunda</h2>
        <p className="mc-sub">(Termos da Prestação de Serviços)</p>
        <ol>
          <li>Os serviços serão prestados, preferencialmente, nas instalações do Primeiro Outorgante, na morada <P v={moradaEscritorio} w="___________" />.</li>
          <li>O Segundo Outorgante obriga-se a entregar ao Primeiro Outorgante, até ao dia 10 (dez) de cada mês, todas as informações, documentos e elementos de suporte contabilístico respeitantes ao mês anterior, assumindo total responsabilidade pelas consequências decorrentes da falta de entrega ou da entrega extemporânea dos mesmos.</li>
          <li>A não apresentação das referidas informações ou o incumprimento de colaboração pontual desresponsabiliza o contabilista certificado, Primeiro Outorgante, pelas consequências que daí possam advir e confere-lhe o direito à recusa de assinatura das declarações fiscais, nos termos do n.º 2 do artigo 72.º do EOCC.</li>
          <li>O Segundo Outorgante assume total responsabilidade pela verdade e regularidade fiscal dos documentos e elementos de suporte contabilístico entregues ao Primeiro Outorgante, ficando expressamente convencionado que tais documentos e elementos constituem a totalidade e a verdade da realidade contabilística e fiscal do Segundo Outorgante.</li>
          <li>O Primeiro Outorgante obriga-se a dar conhecimento ao Segundo Outorgante, antes do termo do prazo da sua entrega, do teor das declarações fiscais, bem como a entregar a nota de pagamento dos impostos contabilizados, prestando todos os esclarecimentos necessários à compreensão dos relatórios e documentos de análise contabilística, bem como das obrigações contabilísticas e fiscais relacionadas com o exercício das suas funções, sendo da responsabilidade do Segundo Outorgante o pagamento dos impostos nos prazos previstos na lei.</li>
          <li>A falta de pagamento das contribuições ou impostos, nos prazos estabelecidos na lei, é da exclusiva responsabilidade do Segundo Outorgante, desde que os documentos para o efeito elaborados lhe sejam disponibilizados ou seja dado conhecimento até ao termo do prazo dos respetivos montantes a pagar.</li>
          <li>Nos termos da Lei, o Segundo Outorgante toma conhecimento de que as vantagens patrimoniais resultantes do não pagamento de impostos, para além das coimas e juros aplicáveis, são consideradas prática de crimes como fraude e/ou abuso de confiança fiscal, puníveis com multa e pena de prisão.</li>
          <li>Não pode ser imposta qualquer sanção contratual ao Primeiro Outorgante, nem é havida como incumprimento, a não realização pontual das obrigações contratuais a que se vincula pelo presente Contrato, que resulte de caso de força maior, entendendo-se como tal, quer as circunstâncias previstas nos termos do justo impedimento (artigos 12.º-A e 12.º-B do EOCC), quer as circunstâncias que se subsumam a tremores de terra, inundações, incêndios, epidemias, greves, atos de guerra ou terrorismo, determinações governamentais ou administrativas injuntivas.</li>
          <li>O Primeiro Outorgante não poderá subcontratar outra sociedade de contabilidade ou contabilista certificado para prestar os serviços objeto do presente Contrato, sem que para tal seja previamente autorizado pelo Segundo Outorgante.</li>
        </ol>
      </div>

      {/* ─── PÁGINA 2 ─── */}
      <div className="mc-page">
        <div className="mc-band" />

        <h2>Cláusula Terceira</h2>
        <p className="mc-sub">(Duração)</p>
        <ol>
          <li>
            O presente contrato tem início em <strong>{ptDate(dataInicio)}</strong> e durará até ao termo do exercício económico em curso,
            renovando-se por sucessivos períodos de um ano, se não for denunciado, por qualquer das Partes, com a antecedência mínima de
            30 (trinta) dias, em relação à data do termo do prazo inicial ou de qualquer renovação.
          </li>
          <li>A parte que viole o prazo de aviso prévio referido no número anterior, ficará obrigada a indemnizar a outra, no montante correspondente ao período de aviso prévio em falta ou até ao termo do contrato.</li>
        </ol>

        <h2>Cláusula Quarta</h2>
        <p className="mc-sub">(Honorários e Despesas)</p>
        <ol>
          <li>
            Pela prestação dos serviços referidos na Cláusula Primeira, o Segundo Outorgante pagará ao Primeiro Outorgante a importância
            anual de <strong>{eur(proposta.anualSemIVA)}</strong>, em duodécimos de <strong>{eur(proposta.mensalSemIVA)}</strong>, acrescidos
            do IVA à taxa legal em vigor, até ao final do mês a que respeitar.
          </li>
          <li>Sem prejuízo do disposto no n.º 2 do artigo 72.º do EOCC, o pagamento dos honorários contratuais para além do prazo fixado nesta cláusula constitui o Segundo Outorgante em mora, implicando o pagamento de juros moratórios à taxa legal, até efetivo e integral pagamento.</li>
          <li>Aos honorários fixados no n.º 1 da presente Cláusula, acresce o custo do material de expediente utilizado na execução dos serviços contratados, nomeadamente papel, pastas de arquivo, postais e impressos, ou outros, os quais serão expressamente discriminados e objeto de faturação, a efetuar <strong>{periodicidadeMaterial === 'mensal' ? 'mensalmente' : 'trimestralmente'}</strong>, previamente comunicada ao Segundo Outorgante.</li>
          <li>A prestação de quaisquer outros serviços não contemplados na Cláusula Primeira que venham a ser solicitados pelo Segundo Outorgante, serão pontual e especificamente acordados, por escrito, pelas Partes, caso em que serão faturados por acréscimo ao valor ajustado na Cláusula Quarta.</li>
          <li>O Primeiro Outorgante poderá, na data de renovação do contrato, ajustar o preço dos serviços contratados ou a forma de execução dos mesmos, devendo para tanto comunicá-lo ao Segundo Outorgante, por escrito, através de carta registada com aviso de receção, com 45 (quarenta e cinco) dias de antecedência.</li>
          <li>No caso de o Segundo Outorgante não aceitar as alterações propostas pelo Primeiro Outorgante, assiste-lhe o direito de denunciar o Contrato, por escrito e no prazo máximo de 15 (quinze) dias após o recebimento da comunicação do Primeiro Outorgante, através de carta registada com aviso de receção, sob pena de se considerarem tacitamente aceites as alterações propostas.</li>
        </ol>
        {office.iban && (
          <p style={{ fontSize: '10pt', color: '#64748B', fontStyle: 'italic' }}>
            Pagamento por transferência bancária para o IBAN <strong>{office.iban}</strong>.
          </p>
        )}

        <h2>Cláusula Quinta</h2>
        <p className="mc-sub">(Confidencialidade)</p>
        <p>O Primeiro Outorgante, na qualidade de contabilista certificado, e os seus colaboradores, estão obrigados ao sigilo profissional e consequentemente vinculados a manter confidencialidade sobre todos os dossiers, documentos, dados e informações obtidos em virtude da execução do presente Contrato, relativos ao Segundo Outorgante, ou a quaisquer outras pessoas, singulares ou coletivas, que com este se relacionem, nomeadamente quanto à sua organização, atividade ou negócio, e qualquer outro dado de natureza pessoal, comercial e/ou técnica, não podendo, designadamente, extrair deles cópias, divulgá-los ou comunicá-los a terceiros.</p>
        <p>O dever de confidencialidade abrange a reprodução da informação em qualquer suporte informático, ou outro meio de registo de dados.</p>
        <p>A obrigação de sigilo profissional não está limitada no tempo, mantendo-se mesmo após a cessação do presente Contrato.</p>
        <p>Cessa a obrigação de sigilo profissional quando (i) o Primeiro Outorgante tenha sido de tal dispensado pelo Segundo Outorgante ou este tenha tornado manifestamente públicos os dados/informações em questão, (ii) por decisão judicial ou (iii) mediante autorização prévia concedida pela Ordem dos Contabilistas Certificados, em casos devidamente justificados.</p>
      </div>

      {/* ─── PÁGINA 3 ─── */}
      <div className="mc-page">
        <div className="mc-band" />

        <h2>Cláusula Sexta</h2>
        <p className="mc-sub">(Dados Pessoais)</p>
        <p>1. Pela qualidade que assume no presente contrato, o Primeiro Outorgante declara, enquanto Subcontratante que trata dados pessoais, em nome e por conta do Segundo Outorgante, que:</p>
        <ol style={{ listStyleType: 'lower-alpha' }}>
          <li>No tratamento dos dados pessoais obedecerá às instruções documentadas do Segundo Outorgante, incluindo no que respeita às eventuais transferências de dados para países terceiros ou organizações internacionais, exceto se for obrigado a fazê-lo pelo direito da União ou do Estado-Membro a que está sujeito, informando nesse caso o Segundo Outorgante desse requisito, antes de proceder a essa transferência, salvo se tal informação for proibida por motivos de interesse público;</li>
          <li>Garante que os seus colaboradores assumiram um compromisso de sigilo profissional, estando sujeitos a adequadas obrigações legais de confidencialidade;</li>
          <li>Adota todas as medidas de segurança do tratamento, designadamente: (i) a pseudonimização e a cifragem de dados pessoais, quando se revele necessário; (ii) a capacidade de assegurar a confidencialidade, integridade, disponibilidade e resiliência permanentes dos sistemas e dos serviços de tratamento; (iii) a capacidade de restabelecer a disponibilidade e o acesso aos dados pessoais de forma atempada em caso de incidente físico ou técnico; (iv) ter um processo para testar, apreciar e avaliar regularmente a eficácia das medidas técnicas e organizativas para garantir a segurança do tratamento;</li>
          <li>Apenas contratará outro Subcontratante se o Segundo Outorgante o autorizar previamente;</li>
          <li>Prestará assistência ao Segundo Outorgante caso tenha de dar resposta aos pedidos dos titulares dos dados pessoais, tendo em vista o legítimo exercício dos seus direitos;</li>
          <li>Prestará assistência ao Segundo Outorgante no sentido de assegurar o cumprimento das obrigações de segurança no tratamento, notificação à autoridade de controlo e aos titulares dos dados, em caso de violação de dados pessoais, avaliação de impacto sobre a proteção de dados e consulta prévia, tal como previstas nos artigos 32.º a 36.º do RGPD (Regulamento UE 2016/679);</li>
          <li>Dependendo da opção do Primeiro Outorgante, apagará ou devolverá todos os dados pessoais depois de concluída a prestação de serviços relacionados com o tratamento, apagando as cópias existentes, a menos que a conservação dos dados seja exigida ao abrigo do direito da União ou dos Estados-Membros;</li>
          <li>Disponibilizará ao Segundo Outorgante todas as informações necessárias para demonstrar o cumprimento das obrigações que impendem sobre si enquanto Subcontratante;</li>
          <li>Compromete-se a informar imediatamente o Segundo Outorgante se considerar que alguma instrução viola o RGPD ou outras disposições do direito da União ou dos Estados-Membros em matéria de proteção de dados.</li>
        </ol>

        <h2>Cláusula Sétima</h2>
        <p className="mc-sub">(Incumprimento e Resolução do Contrato)</p>
        <ol>
          <li>Qualquer das Partes poderá resolver o presente Contrato, no caso de incumprimento grave, pela outra Parte, das obrigações que dele emergem.</li>
          <li>A rescisão do Contrato, com fundamento em justa causa, não obedece a qualquer aviso prévio, devendo ser comunicada à contraparte, por carta registada com aviso de receção, para a morada constante no presente Contrato, ou para outra que tenha sido indicada previamente em sua substituição.</li>
          <li>Na rescisão do contrato com fundamento em justa causa, deverão invocar-se os motivos concretos que suscitam a resolução do contrato e a data da produção dos seus efeitos.</li>
          <li>A rescisão do contrato com fundamento em justa causa, por iniciativa do Primeiro Outorgante, implica a sua desresponsabilização por todas as consequências inerentes ao incumprimento das obrigações fiscais declarativas respeitantes ao Segundo Outorgante.</li>
        </ol>

        <h2>Cláusula Oitava</h2>
        <p className="mc-sub">(Disposições Finais)</p>
        <ol>
          <li>Toda e qualquer alteração ao presente Contrato apenas será válida se efetuada por escrito, mediante aditamento assinado pelas Partes.</li>
          <li>Salvo expressamente previsto, a demora das Partes em exercer quaisquer direitos ou poderes concedidos pelo presente Contrato não terá por efeito ou significado a renúncia a qualquer desses direitos ou poderes.</li>
          <li>Na eventualidade de qualquer Cláusula do presente Contrato ser declarada inválida ou ineficaz, todas as demais permanecerão válidas, quando o fim prosseguido entre as Partes permita supor que o teriam querido, sem que da eventual nulidade de tal Cláusula possa resultar para qualquer das Partes uma obrigação de indemnização por responsabilidade pré-contratual.</li>
        </ol>

        <h2>Cláusula Nona</h2>
        <p className="mc-sub">(Lei Aplicável e Resolução de Litígios)</p>
        <ol>
          <li>O presente Contrato é regido e interpretado pela Lei Portuguesa.</li>
          <li>As questões que se suscitarem sobre a interpretação, validade e execução do presente Contrato, que não sejam solucionadas por acordo entre as Partes, serão solucionadas com recurso ao foro da comarca de <P v={office.foroComarca} w="(...)" />, com renúncia expressa a qualquer outro.</li>
        </ol>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: '11pt' }}>
          O presente Contrato é feito em duas vias originais, assinadas pelas Partes, ficando um exemplar com o Primeiro Outorgante e outro com o Segundo Outorgante.
        </p>

        <p style={{ marginTop: 16, textAlign: 'center' }}>
          <P v={office.localidade} w="(local)" />, {ptDate(dataInicio)}.
        </p>

        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Signature label="Primeiro Outorgante" sub={escritorioSociedade ? `${office.nome}\n(Representada por ${office.representanteLegal || '...'})` : `${office.nome}\nCédula prof. ${office.cedulaProfissional}`} />
          <Signature label="Segundo Outorgante" sub={profile.nomeCliente} />
        </div>

        <p style={{ marginTop: 28, fontSize: '8pt', color: '#94A3B8', textAlign: 'center', fontStyle: 'italic' }}>
          Esta minuta constitui uma adaptação da minuta-modelo publicada pela Ordem dos Contabilistas Certificados (OCC),
          preenchida automaticamente pelo Estudo 360 com os dados do escritório e do cliente. As Partes devem revê-la antes de assinar.
        </p>
      </div>
    </div>
  );
}

function Signature({ label, sub }: { label: string; sub: string }) {
  return (
    <div>
      <div style={{ borderBottom: '1px solid #94A3B8', height: 50 }} />
      <div style={{ fontSize: '9pt', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '10pt', color: '#1E293B', marginTop: 2, whiteSpace: 'pre-line', fontWeight: 600 }}>{sub}</div>
    </div>
  );
}
