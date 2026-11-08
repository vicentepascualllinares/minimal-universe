// OPCIONES: preferencias del instrumento, por apartados (de momento, DJ).
// Se abre encima del escenario como el MIXER; la música sigue sonando.
// (Todavía no se guardan: vendrá con las cuentas.)

import { EQ_TYPES } from '../audio/strip.js';

export function optionsPanel(root, engine, onClose) {
  root.innerHTML = `
    <div class="im-head">
      <span class="im-title">OPCIONES</span>
    </div>
    <div class="op-sec">
      <div class="op-sec-title">DJ</div>
      <div class="op-row">
        <span class="op-lab">EQ DE LA MESA · HI · MID · LOW</span>
        <div class="op-choices">${Object.entries(EQ_TYPES).map(([k, t]) => `
          <button class="op-choice" data-v="${k}"><b>${t.label}</b><small>${t.desc}</small></button>`).join('')}
        </div>
        <span class="op-note">como «EQ Type» en rekordbox · afecta a los dos universos del modo DJ</span>
      </div>
    </div>
    <div class="im-foot">
      <button class="im-close">CERRAR</button>
    </div>`;

  const choices = [...root.querySelectorAll('.op-choice')];
  const show = () => choices.forEach((b) => b.classList.toggle('on', b.dataset.v === engine.eqType));
  for (const b of choices) {
    b.addEventListener('click', () => {
      engine.setEqType(b.dataset.v);
      show();
    });
  }
  root.querySelector('.im-close').addEventListener('click', onClose);
  show();
}
