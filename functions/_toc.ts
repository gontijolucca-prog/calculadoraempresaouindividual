/**
 * Helpers puros do proxy TOConline — testáveis sem rede.
 * O proxy em functions/api/toconline.ts usa estes para montar o URL dos
 * clientes e normalizar cada registo (attributes do JSON:API).
 */

export interface TocCliente {
  nome: string;
  nif: string;
  email?: string;
  telefone?: string;
  morada?: string;
  localidade?: string;
  codigoPostal?: string;
}

/** URL da página de clientes (JSON:API, 100 por página). */
export function urlClientes(apiUrl: string, pagina: number): string {
  let base = apiUrl.trim().replace(/\/$/, '');
  if (!base.toLowerCase().includes('/customers')) base = base + '/customers';
  return `${base}?page[number]=${pagina}&page[size]=100`;
}

/** Normaliza um cliente do TOConline (campos já vistos em várias versões). */
export function mapTocCustomer(it: any): TocCliente {
  const a = it?.attributes ?? it ?? {};
  const rawNif = a.tax_registration_number ?? a.fiscal_id ?? a.nif ?? a.vat_number ?? a.tax_number ?? a.vat ?? '';
  return {
    nome: String(a.business_name ?? a.name ?? a.client_name ?? a.designation ?? a.display_name ?? '').trim(),
    nif: String(rawNif).replace(/\D/g, ''),
    email: a.email ?? a.e_mail ?? undefined,
    telefone: a.mobile_number ?? a.phone_number ?? a.phone ?? a.telephone ?? undefined,
    morada: a.address_detail ?? a.address ?? a.street ?? undefined,
    localidade: a.city ?? a.locality ?? undefined,
    codigoPostal: a.postcode ?? a.zip_code ?? a.postal_code ?? undefined,
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
