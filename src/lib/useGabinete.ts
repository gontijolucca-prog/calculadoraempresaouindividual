import { useEffect, useState } from 'react';
import {
  subscribeClientes, subscribeTarefas, subscribeObrigacoes, subscribeCofre, subscribeColaboradores, subscribeConversas, subscribeModelos, subscribeEnvios, subscribeTempos, subscribeActas,
  listClientesCache, listTarefasCache, listObrigacoesCache, listCofreCache, listColaboradoresCache, listConversasCache, listModelosCache, listEnviosCache, listTemposCache, listActasCache,
  type GabineteCliente, type Tarefa, type Obrigacao, type CofreEntrada, type Colaborador, type Conversa, type ModeloComunicacao, type EnvioComunicacao, type Tempo, type Acta,
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
  useEffect(() => subscribeObrigacoes(setItems), []);
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
export function useGabineteActas(): Acta[] {
  const [items, setItems] = useState<Acta[]>(() => listActasCache());
  useEffect(() => subscribeActas(setItems), []);
  return items;
}
