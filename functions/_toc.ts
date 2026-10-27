/**
 * Helpers puros do proxy TOConline — testáveis sem rede.
 * O proxy em functions/api/toconline.ts usa estes para montar o URL dos
 * clientes e normalizar cada registo (attributes do JSON:API).
 */

export interface TocCliente {
  /** Id do cliente no TOConline (para reimportar/atualizar no futuro). */
  tocId?: string;
  nome: string;
  nif: string;
  email?: string;
  telefone?: string;
  telefone2?: string;
  website?: string;
  morada?: string;
  localidade?: string;
  codigoPostal?: string;
  regiao?: string;
  pais?: string;
  contacto?: string;
  observacoes?: string;
  observacoesInternas?: string;
  isencaoIva?: boolean;
  naoClienteFinal?: boolean;
  ativo?: boolean;
  saftImportId?: string;
  taxCountryRegion?: string;
  /** Todos os emails do cliente (o primeiro é o principal). */
  emails?: string[];
  /** Moradas extra (além da principal). */
  moradasExtra?: string[];
  /** Condições comerciais do cliente no TOConline. */
  prazoPagamento?: number;
  moeda?: string;
  mecanismoPagamento?: string;
  /** Motivo de isenção de IVA (ex.: M07 — Artigo 9.º do CIVA). */
  isencaoCodigo?: string;
  isencaoLegislacao?: string;
}

/** Recursos relacionados que pedimos na listagem (1 pedido por página). */
export const TOC_INCLUDE = 'main_address,main_email_address,addresses,email_addresses,defaults,tax_exemption_reason';

/** URL da página de clientes (JSON:API, 100 por página). */
export function urlClientes(apiUrl: string, pagina: number): string {
  let base = apiUrl.trim().replace(/\/$/, '');
  if (!base.toLowerCase().includes('/customers')) base = base + '/customers';
  return `${base}?page[number]=${pagina}&page[size]=100&include=${TOC_INCLUDE}`;
}

/**
 * Normaliza um cliente do TOConline juntando os recursos incluídos
 * (`main_address` e `main_email_address`) ao registo principal.
 */
export function mapTocCustomer(it: any, incluidos?: { addresses?: Map<string, any>; emails?: Map<string, any>; defaults?: Map<string, any>; isencoes?: Map<string, any> }): TocCliente {
  const a = it?.attributes ?? it ?? {};
  const rel = it?.relationships ?? {};
  const ids = (x: any) => (Array.isArray(x?.data) ? x.data : x?.data ? [x.data] : []).map((r: any) => String(r?.id)).filter(Boolean);
  const attr = (map: Map<string, any> | undefined, id: string) => (map?.get(id)?.attributes || {});

  const addrId = rel?.main_address?.data?.id ? String(rel.main_address.data.id) : '';
  const mailId = rel?.main_email_address?.data?.id ? String(rel.main_email_address.data.id) : '';
  const addr = attr(incluidos?.addresses, addrId);
  const mail = attr(incluidos?.emails, mailId);
  const def = attr(incluidos?.defaults, String(rel?.defaults?.data?.id || ''));
  const isenc = attr(incluidos?.isencoes, String(rel?.tax_exemption_reason?.data?.id || ''));

  // Principal primeiro; depois os restantes emails do cliente.
  const emails = Array.from(new Set(
    [mail.email, ...ids(rel?.email_addresses).map((id) => attr(incluidos?.emails, id).email), a.email]
      .filter((e): e is string => typeof e === 'string' && e.includes('@')),
  ));
  const moradasExtra = ids(rel?.addresses)
    .filter((id) => id !== addrId)
    .map((id) => {
      const m = attr(incluidos?.addresses, id);
      return [m.address_detail, m.postcode, m.city].filter(Boolean).join(', ');
    })
    .filter(Boolean);

  const rawNif = a.tax_registration_number ?? a.fiscal_id ?? a.nif ?? a.vat_number ?? a.tax_number ?? a.vat ?? '';
  const telemovel = a.mobile_number ?? a.phone_number ?? a.phone ?? a.telephone ?? undefined;
  const telefoneFixo = a.phone_number ?? undefined;

  return {
    tocId: it?.id ? String(it.id) : undefined,
    nome: String(a.business_name ?? a.name ?? a.client_name ?? a.designation ?? a.display_name ?? '').trim(),
    nif: String(rawNif).replace(/\D/g, ''),
    email: emails[0],
    emails,
    telefone: telemovel || undefined,
    telefone2: telefoneFixo && telefoneFixo !== telemovel ? telefoneFixo : undefined,
    website: a.website ?? undefined,
    morada: addr.address_detail ?? a.address_detail ?? a.address ?? a.street ?? undefined,
    localidade: addr.city ?? a.city ?? a.locality ?? undefined,
    codigoPostal: addr.postcode ?? a.postcode ?? a.zip_code ?? a.postal_code ?? undefined,
    regiao: addr.region ?? a.region ?? undefined,
    moradasExtra,
    pais: a.country_iso_alpha_2 ?? undefined,
    contacto: a.contact_name ?? undefined,
    observacoes: a.observations ?? undefined,
    observacoesInternas: a.internal_observations ?? undefined,
    isencaoIva: a.is_tax_exempt === true,
    isencaoCodigo: isenc?.code ?? undefined,
    isencaoLegislacao: isenc?.applicable_legislation ?? undefined,
    naoClienteFinal: a.not_final_customer === true,
    ativo: a.active !== false,
    saftImportId: a.saft_import_id ?? undefined,
    taxCountryRegion: a.tax_country_region ?? undefined,
    prazoPagamento: typeof def.due_days === 'number' ? def.due_days : undefined,
    moeda: def.currency_iso_code ?? undefined,
    mecanismoPagamento: def.payment_mechanism ?? undefined,
  };
}

/** Mensagem clara para os erros de OAuth mais comuns. */
export function explicarErroOauth(status: number, corpo: any): string {
  const code = String(corpo?.error || corpo?.errors?.[0]?.code || '');
  if (code === 'unauthorized_client' || status === 401) {
    return 'redirect_uri_nao_registado';
  }
  if (code === 'invalid_grant') return 'codigo_expirado';
  return code || `erro_${status}`;
}
