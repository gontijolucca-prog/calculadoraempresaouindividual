import { useEffect, useMemo, useState } from 'react';
import { deduplicarCelulas } from './mapaCelulas';
import { toast } from './toast';
import {
  subscribeClientes, subscribeTarefas, subscribeObrigacoes, subscribeCofre, subscribeColaboradores, subscribeContactosGeral, subscribeAlertasGeral, subscribeOcorrencias, subscribeDocumentosGeral, subscribeConversas, subscribeModelos, subscribeEnvios, subscribeTempos, subscribeActas,
  listClientesCache, listTarefasCache, listObrigacoesCache, listCofreCache, listColaboradoresCache, listContactosCache, listAlertasCache, listOcorrenciasCache, listDocumentosGeralCache, listConversasCache, listModelosCache, listEnviosCache, listTemposCache, listActasCache,
  seedCalendarioFiscal2026,
  type GabineteCliente, type Tarefa, type Obrigacao, type CofreEntrada, type Colaborador, type ContactoGabinete, type AlertaGabinete, type OcorrenciaGabinete, type GabineteDocumento, type Conversa, type ModeloComunicacao, type EnvioComunicacao, type Tempo, type Acta,
} from './gabinete';

function useLocalUpdates<T>(col: string, read: () => T[], setItems: (v: T[]) => void): void {
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent<{ col?: string }>).detail;
      if (detail?.col === col) setItems(read());
    };
    window.addEventListener('estudo360:gabinete-local-update', h as EventListener);
    return () => window.removeEventListener('estudo360:gabinete-local-update', h as EventListener);
  }, [col, read, setItems]);
}

export function useGabineteClientes(): GabineteCliente[] {
  const [items, setItems] = useState<GabineteCliente[]>(() => listClientesCache());
  useEffect(() => subscribeClientes(setItems), []);
  useLocalUpdates('clientes', listClientesCache, setItems);
  return items;
}
export function useGabineteTarefas(): Tarefa[] {
  const [items, setItems] = useState<Tarefa[]>(() => listTarefasCache());
  useEffect(() => subscribeTarefas(setItems), []);
  useLocalUpdates('tarefas', listTarefasCache, setItems);
  return items;
}
/** Duas gravações offline da mesma célula: mostra só a mais recente. */
const AVISO_CELULAS_KEY = 'estudo360:lww:avisado';

function aplicarLww(lista: Obrigacao[]): Obrigacao[] {
  const { lista: limpa, removidos } = deduplicarCelulas(lista);
  if (removidos > 0) {
    try {
      if (!sessionStorage.getItem(AVISO_CELULAS_KEY)) {
        sessionStorage.setItem(AVISO_CELULAS_KEY, '1');
        toast(`${removidos} célula(s) com edição em dois dispositivos — ficou a mais recente.`, 'info');
      }
    } catch { /* sessionStorage bloqueado: sem aviso, o resto funciona */ }
  }
  return limpa;
}

export function useGabineteObrigacoes(): Obrigacao[] {
  const [items, setItems] = useState<Obrigacao[]>(() => aplicarLww(listObrigacoesCache()));
  useLocalUpdates('obrigacoes', listObrigacoesCache, setItems);
  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeObrigacoes(setItems);
    // Preenche também o cache local enquanto o snapshot inicial chega — assim
    // o calendário já funciona offline e continua a atualizar em tempo real.
    void seedCalendarioFiscal2026().then(() => {
      if (alive) setItems(listObrigacoesCache());
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return useMemo(() => aplicarLww(items), [items]);
}
export function useGabineteCofre(): CofreEntrada[] {
  const [items, setItems] = useState<CofreEntrada[]>(() => listCofreCache());
  useEffect(() => subscribeCofre(setItems), []);
  return items;
}
export function useGabineteColaboradores(): Colaborador[] {
  const [items, setItems] = useState<Colaborador[]>(() => listColaboradoresCache());
  useEffect(() => subscribeColaboradores(setItems), []);
  return items;
}
export function useGabineteConversas(): Conversa[] {
  const [items, setItems] = useState<Conversa[]>(() => listConversasCache());
  useEffect(() => subscribeConversas(setItems), []);
  return items;
}
export function useGabineteModelos(): ModeloComunicacao[] {
  const [items, setItems] = useState<ModeloComunicacao[]>(() => listModelosCache());
  useEffect(() => subscribeModelos(setItems), []);
  return items;
}
export function useGabineteEnvios(): EnvioComunicacao[] {
  const [items, setItems] = useState<EnvioComunicacao[]>(() => listEnviosCache());
  useEffect(() => subscribeEnvios(setItems), []);
  return items;
}
export function useGabineteTempos(): Tempo[] {
  const [items, setItems] = useState<Tempo[]>(() => listTemposCache());
  useEffect(() => subscribeTempos(setItems), []);
  return items;
}

export function useGabineteContactosGeral(): ContactoGabinete[] {
  const [items, setItems] = useState<ContactoGabinete[]>(() => listContactosCache());
  useEffect(() => subscribeContactosGeral(setItems), []);
  return items;
}
export function useGabineteAlertas(): AlertaGabinete[] {
  const [items, setItems] = useState<AlertaGabinete[]>(() => listAlertasCache());
  useEffect(() => subscribeAlertasGeral(setItems), []);
  useLocalUpdates('alertasGeral', listAlertasCache, setItems);
  return items;
}
export function useGabineteOcorrencias(): OcorrenciaGabinete[] {
  const [items, setItems] = useState<OcorrenciaGabinete[]>(() => listOcorrenciasCache());
  useEffect(() => subscribeOcorrencias(setItems), []);
  return items;
}
export function useGabineteDocumentos(): GabineteDocumento[] {
  const [items, setItems] = useState<GabineteDocumento[]>(() => listDocumentosGeralCache());
  useEffect(() => subscribeDocumentosGeral(setItems), []);
  return items;
}
export function useGabineteActas(): Acta[] {
  const [items, setItems] = useState<Acta[]>(() => listActasCache());
  useEffect(() => subscribeActas(setItems), []);
  return items;
}
