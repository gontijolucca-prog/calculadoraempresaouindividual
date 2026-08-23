import { useEffect, useState } from 'react';
import {
  subscribeClientes, subscribeTarefas, subscribeObrigacoes, subscribeCofre, subscribeColaboradores,
  listClientesCache, listTarefasCache, listObrigacoesCache, listCofreCache, listColaboradoresCache,
  type GabineteCliente, type Tarefa, type Obrigacao, type CofreEntrada, type Colaborador,
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
