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
}

/** Recursos relacionados que pedimos na listagem (1 pedido por página). */
export const TOC_INCLUDE = 'main_address,main_email_address';

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
export function mapTocCustomer(it: any, incluidos?: { addresses?: Map<string, any>; emails?: Map<string, any> }): TocCliente {
  const a = it?.attributes ?? it ?? {};
  const rel = it?.relationships ?? {};
  const addrId = rel?.main_address?.data?.id;
  const mailId = rel?.main_email_address?.data?.id;
  const addr = (addrId && incluidos?.addresses?.get(addrId)?.attributes) || {};
  const mail = (mailId && incluidos?.emails?.get(mailId)?.attributes) || {};

  const rawNif = a.tax_registration_number ?? a.fiscal_id ?? a.nif ?? a.vat_number ?? a.tax_number ?? a.vat ?? '';
  const telemovel = a.mobile_number ?? a.phone_number ?? a.phone ?? a.telephone ?? undefined;
  const telefoneFixo = a.phone_number ?? undefined;

  return {
    tocId: it?.id ? String(it.id) : undefined,
    nome: String(a.business_name ?? a.name ?? a.client_name ?? a.designation ?? a.display_name ?? '').trim(),
    nif: String(rawNif).replace(/\D/g, ''),
    email: mail.email ?? a.email ?? a.e_mail ?? undefined,
    telefone: telemovel || undefined,
    telefone2: telefoneFixo && telefoneFixo !== telemovel ? telefoneFixo : undefined,
    website: a.website ?? undefined,
    morada: addr.address_detail ?? a.address_detail ?? a.address ?? a.street ?? undefined,
    localidade: addr.city ?? a.city ?? a.locality ?? undefined,
    codigoPostal: addr.postcode ?? a.postcode ?? a.zip_code ?? a.postal_code ?? undefined,
    regiao: addr.region ?? a.region ?? undefined,
    pais: a.country_iso_alpha_2 ?? undefined,
    contacto: a.contact_name ?? undefined,
    observacoes: a.observations ?? undefined,
    observacoesInternas: a.internal_observations ?? undefined,
    isencaoIva: a.is_tax_exempt === true,
    naoClienteFinal: a.not_final_customer === true,
    ativo: a.active !== false,
    saftImportId: a.saft_import_id ?? undefined,
    taxCountryRegion: a.tax_country_region ?? undefined,
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
