/**
 * Prazo para operações de rede. Sem isto, quando o Firestore não responde a
 * promessa fica pendente para sempre e a UI fica presa em «A guardar…».
 */
export async function withTimeout<T>(promessa: Promise<T>, ms = 6000, etiqueta = 'operação'): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promessa,
      new Promise<never>((_, rej) => {
        timer = window.setTimeout(() => rej(new Error(`${etiqueta}: tempo esgotado`)), ms);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}
