// Testes da árvore de ajuda (chatbot sem LLM).
// Garante que o bot não promete caminhos quebrados nem guias inexistentes.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARVORE, NO_RAIZ, nosAlcancaveis, guiasAlcancaveis,
} from '../ai/arvoreAjuda';
import { GUIAS } from './guias';

const ids = Object.keys(ARVORE);

describe('arvoreAjuda', () => {
  it('todos os destinos existem', () => {
    for (const n of Object.values(ARVORE)) {
      for (const o of n.opcoes ?? []) {
        assert.ok(ARVORE[o.proximo], `${n.id} → "${o.rotulo}" aponta para ${o.proximo}, que não existe`);
        assert.ok(o.rotulo.trim().length > 2, `${n.id} tem opção sem rótulo`);
      }
    }
  });

  it('não há nós órfãos (todos alcançáveis a partir da raiz)', () => {
    const alcancaveis = nosAlcancaveis();
    const orfaos = ids.filter((id) => !alcancaveis.has(id));
    assert.deepEqual(orfaos, [], `nós inalcançáveis: ${orfaos.join(', ')}`);
  });

  it('cada nó ou tem opções ou é uma folha com texto', () => {
    for (const n of Object.values(ARVORE)) {
      const temOpcoes = (n.opcoes?.length ?? 0) > 0;
      if (temOpcoes) {
        assert.ok(!n.destino, `${n.id}: nó de escolha não deve ter destino`);
      } else {
        assert.ok(n.texto.trim().length > 10, `${n.id}: folha sem texto útil`);
      }
    }
  });

  it('todos os guias referenciados existem', () => {
    for (const n of Object.values(ARVORE)) {
      if (!n.destino?.guia) continue;
      assert.ok(Object.hasOwn(GUIAS, n.destino.guia), `${n.id} aponta para guia inexistente: ${n.destino.guia}`);
    }
  });

  it('todos os guias existentes são alcançáveis pelo chatbot', () => {
    const alcancados = guiasAlcancaveis();
    const emFalta = Object.keys(GUIAS).filter((k) => !alcancados.has(k));
    assert.deepEqual(emFalta, [], `guias sem caminho no chatbot: ${emFalta.join(', ')}`);
  });

  it('destinos "gab-*" apontam para guias do gabinete', () => {
    for (const n of Object.values(ARVORE)) {
      const v = n.destino?.view;
      if (!v?.startsWith('gab-')) continue;
      assert.ok(Object.hasOwn(GUIAS, v), `${n.id}: destino ${v} não é uma vista com guia`);
    }
  });

  it('a raiz tem entre 5 e 9 categorias', () => {
    const n = ARVORE[NO_RAIZ];
    assert.ok(n.opcoes && n.opcoes.length >= 5 && n.opcoes.length <= 9);
  });

  it('nenhum caminho tem mais de 4 níveis', () => {
    const fila: Array<{ id: string; nivel: number }> = [{ id: NO_RAIZ, nivel: 1 }];
    const visto = new Map<string, number>();
    while (fila.length) {
      const { id, nivel } = fila.shift()!;
      const antes = visto.get(id);
      if (antes !== undefined && antes <= nivel) continue;
      visto.set(id, nivel);
      assert.ok(nivel <= 4, `caminho demasiado fundo em ${id} (nível ${nivel})`);
      for (const o of ARVORE[id]?.opcoes ?? []) fila.push({ id: o.proximo, nivel: nivel + 1 });
    }
  });
});
