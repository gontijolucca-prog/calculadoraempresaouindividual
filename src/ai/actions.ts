// Protocolo de ações do AI Contabilista.
// O modelo pode terminar uma resposta com um bloco:
//   <<<ACTIONS
//   [ { ...ação... } ]
//   ACTIONS>>>
// Este módulo extrai esse bloco, valida-o e deixa o texto limpo para mostrar.

export type ViewId =
  | 'empresas' | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'irs' | 'previsa'
  | 'historico' | 'exportar' | 'office-settings' | 'legal';

export type FillField = { path: string; value: string | number | boolean; label: string };

export type BotAction =
  | { type: 'navigate'; view: ViewId }
  | { type: 'setMode'; mode: 'empresa' | 'novo-cliente' }
  | { type: 'fill'; target: string; fields: FillField[] }
  | { type: 'suggestion'; title: string; detail: string; area?: string }
  | { type: 'openSaftUpload'; mode?: 'novo' | 'empresa' | 'escolher' }
  | { type: 'download'; docId: string }
  | { type: 'downloadPicker' }
  | { type: 'selectClient'; name: string }
  | { type: 'replies'; options: string[] };

const DOWNLOAD_DOC_IDS = new Set<string>([
  'previsa', 'dr', 'declaracao', 'acta', 'alteracoes', 'fluxos', 'balanco', 'df',
]);

const VIEW_IDS = new Set<string>([
  'empresas', 'profile', 'tax', 'vehicle', 'ticket', 'selfss', 'diagnostico',
  'imoveis', 'imt', 'salario', 'irs', 'previsa', 'historico', 'exportar',
  'office-settings', 'legal',
]);

const FILL_TARGETS = new Set<string>([
  'profile', 'tax', 'vehicle', 'ticket', 'selfss', 'diagnostico', 'imoveis',
  'imt', 'salario', 'irs', 'previsa',
]);

const OPEN = '<<<ACTIONS';
const CLOSE = 'ACTIONS>>>';

function sanitizeActions(parsed: unknown): BotAction[] {
  if (!Array.isArray(parsed)) return [];
  const out: BotAction[] = [];
  for (const a of parsed) {
    if (!a || typeof a !== 'object') continue;
    const t = (a as any).type;
    if (t === 'navigate' && VIEW_IDS.has((a as any).view)) {
      out.push({ type: 'navigate', view: (a as any).view });
    } else if (t === 'setMode' && ((a as any).mode === 'empresa' || (a as any).mode === 'novo-cliente')) {
      out.push({ type: 'setMode', mode: (a as any).mode });
    } else if (t === 'fill' && FILL_TARGETS.has((a as any).target) && Array.isArray((a as any).fields)) {
      const fields: FillField[] = (a as any).fields
        .filter((f: any) => f && typeof f.path === 'string' && f.value !== undefined && f.value !== null)
        .map((f: any) => ({
          path: String(f.path),
          value: f.value,
          label: typeof f.label === 'string' && f.label ? f.label : String(f.path),
        }));
      if (fields.length) out.push({ type: 'fill', target: (a as any).target, fields });
    } else if (t === 'suggestion' && typeof (a as any).title === 'string') {
      out.push({
        type: 'suggestion',
        title: String((a as any).title).slice(0, 200),
        detail: String((a as any).detail ?? '').slice(0, 1500),
        area: typeof (a as any).area === 'string' ? (a as any).area.slice(0, 120) : undefined,
      });
    } else if (t === 'openSaftUpload') {
      const m = (a as any).mode;
      const mode = m === 'empresa' ? 'empresa' : m === 'escolher' ? 'escolher' : 'novo';
      out.push({ type: 'openSaftUpload', mode });
    } else if (t === 'downloadPicker') {
      out.push({ type: 'downloadPicker' });
    } else if (t === 'download' && DOWNLOAD_DOC_IDS.has((a as any).docId)) {
      out.push({ type: 'download', docId: (a as any).docId });
    } else if (t === 'selectClient' && typeof (a as any).name === 'string' && (a as any).name.trim()) {
      out.push({ type: 'selectClient', name: String((a as any).name).trim().slice(0, 120) });
    } else if (t === 'replies' && Array.isArray((a as any).options)) {
      const options = ((a as any).options as unknown[])
        .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
        .map((o) => o.trim().slice(0, 80))
        .slice(0, 4);
      if (options.length) out.push({ type: 'replies', options });
    }
  }
  return out;
}

/** Separa o texto visível das ações. Tolerante a cercas markdown à volta do JSON. */
export function parseReply(reply: string): { text: string; actions: BotAction[] } {
  const i = reply.indexOf(OPEN);
  if (i === -1) return { text: reply.trim(), actions: [] };

  const text = reply.slice(0, i).trim();
  let rest = reply.slice(i + OPEN.length);
  const j = rest.indexOf(CLOSE);
  if (j !== -1) rest = rest.slice(0, j);

  // Tira cercas ```json / ``` que alguns modelos colam à volta.
  let jsonStr = rest.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  // Se não começar em '[', tenta apanhar do primeiro '[' ao último ']'.
  if (!jsonStr.startsWith('[')) {
    const a = jsonStr.indexOf('[');
    const b = jsonStr.lastIndexOf(']');
    if (a !== -1 && b > a) jsonStr = jsonStr.slice(a, b + 1);
  }

  let actions: BotAction[] = [];
  try {
    actions = sanitizeActions(JSON.parse(jsonStr));
  } catch {
    actions = [];
  }
  return { text: text || (actions.length ? 'Com certeza.' : reply.trim()), actions };
}

/** Deep-set imutável por caminho com pontos (ex.: "custos.mercadorias"). */
export function setByPath<T extends Record<string, any>>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...obj };
  let cur = clone;
  for (let k = 0; k < keys.length - 1; k++) {
    const key = keys[k];
    const child = cur[key];
    cur[key] = child && typeof child === 'object' ? (Array.isArray(child) ? [...child] : { ...child }) : {};
    cur = cur[key];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}
