/**
 * proceso.ts
 * Capítulo 04 · Método. Las fases son umbrales de un camino (un SVG que se
 * curva entre ellos). Con el scroll el camino se ilumina hasta la fase
 * actual, que se enciende; las anteriores quedan a medias. Todo deriva del
 * scroll: es reversible. La fase actual enciende su puerta en la
 * arquitectura (estado.etapa, arquitectura.ts).
 *
 * En escritorio las fases van en fila sobre el camino, que se ilumina
 * mientras la escena sube por la pantalla (nunca se queda fija: el scroll
 * baja la página). En móvil son una lista vertical y cada una se enciende
 * al pasar por el centro.
 * Las etiquetas y descripciones son HTML: el dibujo solo acompaña.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { EstadoNarrativo } from '@/scripts/lienzo/narrativa';

/**
 * Tramo del camino, medido sobre la fila de fases (no sobre el capítulo,
 * que sigue con los principios): en escritorio, de que la fila asome a que
 * pasa la mitad de la pantalla; en móvil, cada fase al cruzar el centro.
 */
const CAMINO = {
  horizontal: { inicio: 'top 80%', fin: 'bottom 45%' },
  vertical: { inicio: 'top 60%', fin: 'bottom 60%' }
};

export function iniciarProceso(estado: EstadoNarrativo, horizontal: boolean): () => void {
  const seccion = document.querySelector<HTMLElement>('[data-proceso]');
  if (!seccion) return () => {};

  const fases = [...seccion.querySelectorAll<HTMLElement>('[data-fase]')];
  const actual = seccion.querySelector<HTMLElement>('[data-proceso-actual]');
  const total = fases.length;

  const marcar = (activa: number) => {
    fases.forEach((fase, i) => {
      fase.classList.toggle('activa', i === activa);
      fase.classList.toggle('alcanzada', i < activa);
      if (i === activa) fase.setAttribute('aria-current', 'step');
      else fase.removeAttribute('aria-current');
    });
    if (actual) actual.textContent = String(Math.max(1, activa + 1));
  };

  /** Progreso 0..1 a lo largo de todo el camino. */
  const pintar = (progreso: number) => {
    const activa = Math.min(total - 1, Math.floor(progreso * total));
    seccion.style.setProperty('--avance', progreso.toFixed(4));
    // La escena enciende la puerta de la fase actual (continuo: se enciende al llegar).
    estado.etapa = progreso * total;
    marcar(activa);
  };

  const disparadores: ScrollTrigger[] = [];
  seccion.classList.add('en-escena');
  // El camino dibujado solo existe en escritorio; en móvil la línea es CSS.
  if (horizontal) seccion.classList.add('horizontal');
  disparadores.push(
    ScrollTrigger.create({
      trigger: seccion.querySelector('.fases'),
      start: CAMINO[horizontal ? 'horizontal' : 'vertical'].inicio,
      end: CAMINO[horizontal ? 'horizontal' : 'vertical'].fin,
      onUpdate: (self) => pintar(self.progress),
      onRefresh: (self) => pintar(self.progress)
    })
  );

  return () => {
    for (const d of disparadores) d.kill();
    seccion.classList.remove('en-escena', 'horizontal');
    seccion.style.removeProperty('--avance');
    fases.forEach((fase) => {
      fase.classList.remove('activa', 'alcanzada');
      fase.removeAttribute('aria-current');
    });
    estado.etapa = 0;
  };
}
