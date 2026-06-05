/**
 * Intenções disparadas pela sidebar ANTES de o ClientProfile montar.
 *
 * Porquê: quando se clica "Exportar documentos" (ou o toggle de vista) estando
 * noutra vista, era preciso (a) mudar para a vista Perfil e (b) executar a ação.
 * A implementação antiga usava `setTimeout(dispatch, 80)` — uma race: se o
 * ClientProfile ainda não tivesse montado e registado o listener nesses 80 ms, o
 * evento perdia-se e o botão "não fazia nada" (era preciso refresh).
 *
 * Solução (mesmo padrão já usado para o deep-link Ficha→Legal): a sidebar regista
 * a intenção aqui e muda de vista; o ClientProfile CONSOME a intenção no seu
 * próprio mount, independentemente de quanto tempo a montagem demore. Sem races.
 */
let openPackagePending = false;
let flowTogglePending = false;

export const requestOpenPackage = () => { openPackagePending = true; };
export const consumeOpenPackage = (): boolean => {
  const p = openPackagePending; openPackagePending = false; return p;
};

export const requestFlowToggle = () => { flowTogglePending = true; };
export const consumeFlowToggle = (): boolean => {
  const p = flowTogglePending; flowTogglePending = false; return p;
};
