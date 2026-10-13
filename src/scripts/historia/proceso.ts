/**
 * proceso.ts
 * Escena 06 · El proceso. Las fases son nodos de un camino orgánico (un
 * SVG que se curva entre ellos). Con el scroll el camino se ilumina hasta
 * la fase actual, que brilla; las anteriores quedan encendidas a medias y
 * una partícula viaja hacia la siguiente. Todo deriva del scroll: es
 * reversible. La fase actual lleva data-guia: el robot la señala.
 *
 * En escritorio las fases van en fila sobre el camino, que se ilumina
 * mientras la escena sube por la pantalla (nunca se queda fija: el scroll
 * baja la página). En móvil son una lista vertical y cada una se enciende
 * al pasar por el centro.
 * Las etiquetas y descripciones son HTML: el dibujo solo acompaña.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Tramo del camino en escritorio: de que la escena asome a que su final pasa por aquí. */
const CAMINO = { inicio: 'top 45%', fin: 'bottom 85%' };

export function iniciarProceso(horizontal: boolean): () => void {
  const seccion = document.querySelector<HTMLElement>('[data-proceso]');
  if (!seccion) return () => {};

  const fases = [...seccion.querySelectorAll<HTMLElement>('[data-fase]')];
  const actual = seccion.querySelector<HTMLElement>('[data-proceso-actual]');
  const camino = seccion.querySelector<SVGPathElement>('[data-camino]');
  const energia = seccion.querySelector<HTMLElement>('[data-energia]');
  const total = fases.length;
  let largo = 0;

  const marcar = (activa: number) => {
    fases.forEach((fase, i) => {
      fase.classList.toggle('activa', i === activa);
      fase.classList.toggle('alcanzada', i < activa);
      if (i === activa) {
        fase.setAttribute('aria-current', 'step');
        fase.dataset.guia = '';
      } else {
        fase.removeAttribute('aria-current');
        delete fase.dataset.guia;
      }
    });
    if (actual) actual.textContent = String(Math.max(1, activa + 1));
  };

  /** Progreso 0..1 a lo largo de todo el camino. */
  const pintar = (progreso: number) => {
    const activa = Math.min(total - 1, Math.floor(progreso * total));
    seccion.style.setProperty('--avance', progreso.toFixed(4));
    marcar(activa);
    if (!camino || !energia || largo === 0) return;
    // La partícula avanza dentro del tramo actual, de una fase a la siguiente.
    const tramo = (progreso * total) % 1;
    const desde = activa / Math.max(1, total - 1);
    const hasta = Math.min(1, (activa + 1) / Math.max(1, total - 1));
    const punto = camino.getPointAtLength(largo * (desde + (hasta - desde) * tramo));
    // El dibujo mide 1000 × 200: la partícula se coloca en porcentaje, sin deformarse.
    energia.style.left = `${(punto.x / 10).toFixed(2)}%`;
    energia.style.top = `${(punto.y / 2).toFixed(2)}%`;
    energia.style.opacity = activa < total - 1 ? String(Math.sin(tramo * Math.PI)) : '0';
  };

  const disparadores: ScrollTrigger[] = [];
  seccion.classList.add('en-escena');
  if (horizontal) seccion.classList.add('horizontal');
  // El camino dibujado solo existe en escritorio; en móvil la línea es CSS.
  if (horizontal && camino) largo = camino.getTotalLength();
  disparadores.push(
    ScrollTrigger.create({
      trigger: horizontal ? seccion : seccion.querySelector('.fases'),
      start: horizontal ? CAMINO.inicio : 'top 60%',
      end: horizontal ? CAMINO.fin : 'bottom 60%',
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
      delete fase.dataset.guia;
    });
  };
}
