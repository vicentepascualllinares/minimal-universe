// CALIDAD DEL MOTOR (OPCIONES → RENDIMIENTO): cuánto trabajo hace el audio por nota.
// Medido con render offline (ver RENDIMIENTO.md §5): en DJ con los dos universos en
// TODO y complejidad máxima, los hats eran más de un tercio del gasto.
//
//   hatSampler  los hats se GRABAN con el mismo motor (en segundo plano) y cada golpe
//               reproduce la grabación: 2 nodos en vez de 9. Mismo sonido.
//   blockFilters  el filtro del PAD (movido por un LFO de 0,05–0,25 Hz) se recalcula por
//               bloques de 128 muestras (~3 ms) en vez de muestra a muestra. Solo ese:
//               en filtros rápidos y resonantes (envolventes del bajo y los acordes,
//               barridos de las transiciones) recalcular por bloques deja una
//               "cremallera" audible — medido: +8 dB de agudos espurios en el bajo.
//   oversample  la saturación con sobremuestreo (menos aliasing en los agudos).
//   lean        voces más sencillas (el perfil móvil de siempre): un oscilador por nota
//               en acordes y pad, bajo sin la cuadrada si casi no se oye, panorama fijo
//               por carril de percusión.

export const QUALITY_MODES = {
  alta: {
    label: 'ALTA', desc: 'todo sintetizado al momento · el que más gasta',
    hatSampler: false, blockFilters: false, oversample: true, lean: false,
  },
  normal: {
    label: 'NORMAL', desc: 'hats grabados del mismo motor · suena igual, gasta mucho menos',
    hatSampler: true, blockFilters: true, oversample: true, lean: false,
  },
  ligera: {
    label: 'LIGERA', desc: 'además, saturación sin sobremuestreo y voces más sencillas · ordenadores flojos y móvil',
    hatSampler: true, blockFilters: true, oversample: false, lean: true,
  },
};

// recalcular un filtro por bloques (solo para filtros lentos, ver arriba)
export function blockRate(filter) {
  for (const p of [filter.frequency, filter.Q, filter.gain, filter.detune]) {
    try { p.automationRate = 'k-rate'; } catch {} // navegadores sin automationRate: se queda como estaba
  }
}
