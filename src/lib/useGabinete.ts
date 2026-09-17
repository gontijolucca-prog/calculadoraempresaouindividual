import { useEffect, useState } from 'react';
import {
  subscribeClientes, subscribeTarefas, subscribeObrigacoes, subscribeCofre, subscribeColaboradores, subscribeContactosGeral, subscribeAssuntosGeral, subscribeAlertasGeral, subscribeOcorrencias, subscribeDocumentosGeral, subscribeConversas, subscribeModelos, subscribeEnvios, subscribeTempos, subscribeActas,
  listClientesCache, listTarefasCache, listObrigacoesCache, listCofreCache, listColaboradoresCache, listContactosCache, listAssuntosCache, listAlertasCache, listOcorrenciasCache, listDocumentosGeralCache, listConversasCache, listModelosCache, listEnviosCache, listTemposCache, listActasCache,
  seedCalendarioFiscal2026,
  type GabineteCliente, type Tarefa, type Obrigacao, type CofreEntrada, type Colaborador, type ContactoGabinete, type AssuntoGabinete, type AlertaGabinete, type OcorrenciaGabinete, type GabineteDocumento, type Conversa, type ModeloComunicacao, type EnvioComunicacao, type Tempo, type Acta,
} from './gabinete';

export function useGabineteClientes(): GabineteCliente[] {
  const [items, setItems] = useState<GabineteCliente[]>(() => listClientesCache());
  useEffect(() => subscribeClientes(setItems), []);
  return items;
}
export function useGabineteTarefas(): Tarefa[] {
  const [items, setItems] = useState<Tarefa[]>(() => listTarefasCache());
  useEffect(() => subscribeTarefas(setItems), []);
  return items;
}
export function useGabineteObrigacoes(): Obrigacao[] {
  const [items, setItems] = useState<Obrigacao[]>(() => listObrigacoesCache());
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
  return items;
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
export function useGabineteAssuntos(): AssuntoGabinete[] {
  const [items, setItems] = useState<AssuntoGabinete[]>(() => listAssuntosCache());
  useEffect(() => subscribeAssuntosGeral(setItems), []);
  return items;
}
export function useGabineteAlertas(): AlertaGabinete[] {
  const [items, setItems] = useState<AlertaGabinete[]>(() => listAlertasCache());
  useEffect(() => subscribeAlertasGeral(setItems), []);
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
