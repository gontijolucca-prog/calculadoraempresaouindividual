import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Colaborador, ColaboradorRole } from './gabinete';

export interface EmployeeAccessProfile {
  credentialId: string;
  gabineteId: string;
  nome: string;
  email: string;
  role: string;
  status: 'active' | 'revoked' | 'error';
  createdAt: number;
  updatedAt: number;
}

export interface EmployeeClaims {
  employeeOnly?: boolean;
  credentialId?: string;
  gabineteId?: string;
  [key: string]: unknown;
}

interface ErroApi {
  erro?: string;
}

const MENSAGENS: Record<string, string> = {
  email_invalido: 'Indique um utilizador (3 a 40 caracteres) ou um email.',
  identificador_invalido: 'Indique um utilizador (3 a 40 caracteres: letras, números, ponto, hífen ou _) ou um email.',
  email_reservado: 'Este identificador é interno e não pode ser usado como acesso de colaborador.',
  email_do_dono: 'O identificador do dono do gabinete não pode ser usado como acesso de colaborador.',
  email_ja_tem_acesso: 'Este utilizador já tem acesso ativo a este gabinete.',
  acesso_a_ser_criado: 'Este acesso está a ser criado. Aguarde alguns segundos e atualize a página.',
  password_fraca: 'A password deve ter pelo menos 8 caracteres, incluir uma letra, um número e não começar nem terminar com espaços.',
  password_atual_incorreta: 'A password atual não está correta.',
  password_obrigatoria: 'Indique a password criada pelo gabinete.',
  nome_invalido: 'Indique o nome completo do colaborador.',
  cargo_invalido: 'O cargo escolhido já não existe. Atualize a página e tente novamente.',
  cargo_superior_ao_seu: 'Só pode gerir acessos iguais ou inferiores às permissões do seu próprio cargo.',
  sem_permissao_acessos: 'A sua conta não tem permissão para gerir acessos neste gabinete.',
  sessao_invalida: 'A sessão expirou. Volte a entrar.',
  credenciais_invalidas: 'Email ou password incorretos.',
  credenciais_ambiguas: 'Este email tem mais de um acesso com a mesma password. Peça ao gabinete para repor a password.',
  demasiadas_tentativas: 'Demasiadas tentativas. Aguarde um minuto e tente novamente.',
  acesso_revogado: 'Este acesso foi removido pelo gabinete.',
  servico_acessos_indisponivel: 'O serviço de acessos está temporariamente indisponível. Tente novamente.',
  nao_foi_possivel_criar_acesso: 'Não foi possível criar o acesso. Tente novamente.',
  credencial_nao_encontrada: 'Este acesso já não existe. Atualize a página.',
  utilizador_em_uso: 'Já existe um acesso com esse utilizador neste gabinete. Escolha outro.',
  dono_nao_pode_ser_removido: 'O dono do gabinete não pode ser removido.',
  origem_nao_autorizada: 'Este pedido não foi feito a partir do Estudo360.',
};

export class EquipaAcessoError extends Error {
  constructor(public readonly codigo: string, mensagem?: string) {
    super(mensagem || MENSAGENS[codigo] || 'Não foi possível concluir esta operação.');
  }
}

async function idTokenObrigatorio(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new EquipaAcessoError('sessao_invalida');
  return token;
}

async function postApi<T>(path: string, body: Record<string, unknown>, comSessao = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (comSessao) headers.Authorization = `Bearer ${await idTokenObrigatorio()}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as T & ErroApi;
    if (!response.ok) throw new EquipaAcessoError(data.erro || 'falha_servidor');
    return data;
  } catch (error) {
    if (error instanceof EquipaAcessoError) throw error;
    throw new EquipaAcessoError('servico_acessos_indisponivel');
  } finally {
    window.clearTimeout(timer);
  }
}

export function criarAcessoEquipa(input: {
  gabineteId: string;
  nome: string;
  email: string;
  password: string;
  role: ColaboradorRole;
}): Promise<{ ok: true; colaborador: Colaborador; credencialId: string; loginEmail: string }> {
  return postApi('/api/equipa-contas', { action: 'criar', ...input });
}

export function atualizarAcessoEquipa(input: {
  credentialId: string;
  nome: string;
  role: ColaboradorRole;
  identificador?: string;
}): Promise<{ ok: true; colaborador: Colaborador }> {
  return postApi('/api/equipa-contas', { action: 'atualizar', ...input });
}

export function reporPasswordEquipa(input: {
  credentialId: string;
  password: string;
}): Promise<{ ok: true; credencialId: string; loginEmail: string; updatedAt: number }> {
  return postApi('/api/equipa-contas', { action: 'repor_password', ...input });
}

export function removerAcessoEquipa(credentialId: string): Promise<{ ok: true; credencialId: string; status: 'revoked' }> {
  return postApi('/api/equipa-contas', { action: 'remover', credentialId });
}

export function alterarPasswordTecnica(passwordAtual: string, passwordNova: string): Promise<{ ok: true }> {
  return postApi('/api/equipa-contas', {
    action: 'alterar_password',
    passwordAtual,
    passwordNova,
  });
}

export function migrarConvitesLegados(): Promise<{
  ok: true;
  convitesRemovidos: number;
  gabinetesLimpos: number;
}> {
  return postApi('/api/equipa-contas', { action: 'migrar_convites' });
}

export function loginTecnico(email: string, password: string): Promise<{
  ok: true;
  token: string;
  credentialId: string;
  gabineteId: string;
  status: 'active' | 'revoked';
}> {
  return postApi('/api/colaborador-login', { email, password }, false);
}

export async function vincularContaNormal(password: string): Promise<{ ok: true; gabinetesVinculados: string[] }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/vincular-conta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await idTokenObrigatorio()}`,
      },
      body: JSON.stringify({ password }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as { ok?: boolean; gabinetesVinculados?: string[]; erro?: string };
    if (!response.ok || !data.ok) throw new EquipaAcessoError(data.erro || 'falha_vinculacao');
    return { ok: true, gabinetesVinculados: data.gabinetesVinculados || [] };
  } catch (error) {
    if (error instanceof EquipaAcessoError) throw error;
    throw new EquipaAcessoError('servico_acessos_indisponivel');
  } finally {
    window.clearTimeout(timer);
  }
}

export function claimsTecnicas(claims: Record<string, unknown> | null | undefined): EmployeeClaims | null {
  if (!claims || claims.employeeOnly !== true) return null;
  if (typeof claims.credentialId !== 'string' || typeof claims.gabineteId !== 'string') return null;
  return claims as EmployeeClaims;
}

export function subscreverPerfilTecnico(
  uid: string,
  onData: (profile: EmployeeAccessProfile | null) => void,
  onError?: (error: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'employeeProfiles', uid),
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : null;
      onData(data ? {
        ...data,
        credentialId: String(data.credentialId || ''),
        gabineteId: String(data.gabineteId || ''),
        nome: String(data.nome || ''),
        email: String(data.email || ''),
        role: String(data.role || ''),
        status: data.status === 'revoked' ? 'revoked' : data.status === 'error' ? 'error' : 'active',
        createdAt: Number(data.createdAt || 0),
        updatedAt: Number(data.updatedAt || 0),
      } : null);
    },
    (error) => onError?.(error),
  );
}

export async function lerPerfilTecnico(uid: string): Promise<EmployeeAccessProfile | null> {
  const snapshot = await getDoc(doc(db, 'employeeProfiles', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    ...data,
    credentialId: String(data.credentialId || ''),
    gabineteId: String(data.gabineteId || ''),
    nome: String(data.nome || ''),
    email: String(data.email || ''),
    role: String(data.role || ''),
    status: data.status === 'revoked' ? 'revoked' : data.status === 'error' ? 'error' : 'active',
    createdAt: Number(data.createdAt || 0),
    updatedAt: Number(data.updatedAt || 0),
  };
}
