/**
 * proceso.ts
 * Escena 06 · El proceso. Las fases son nodos de un camino orgánico (un
 * SVG que se curva entre ellos). Con el scroll el camino se ilumina hasta
 * la fase actual, que brilla; las anteriores quedan encendidas a medias y
 * una partícula viaja hacia la siguiente. Todo deriva del scroll: es
 * reversible.
 *
 * En escritorio la escena queda fija mientras avanza. En móvil las fases
 * son una lista vertical y cada una se enciende al pasar por el centro.
 * Las etiquetas y descripciones son HTML: el dibujo solo acompaña.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function iniciarProceso(fija: boolean): () => void {
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
      if (i === activa) fase.setAttribute('aria-current', 'step');
      else fase.removeAttribute('aria-current');
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
  if (fija) seccion.classList.add('fija');
  // El camino dibujado solo existe en la escena fija; en móvil la línea es CSS.
  if (fija && camino) largo = camino.getTotalLength();
  disparadores.push(
    ScrollTrigger.create({
      trigger: fija ? seccion : seccion.querySelector('.fases'),
      start: fija ? 'top top' : 'top 60%',
      end: fija ? 'bottom bottom' : 'bottom 60%',
      onUpdate: (self) => pintar(self.progress),
      onRefresh: (self) => pintar(self.progress)
    })
  );

  return () => {
    for (const d of disparadores) d.kill();
    seccion.classList.remove('en-escena', 'fija');
    seccion.style.removeProperty('--avance');
    fases.forEach((fase) => {
      fase.classList.remove('activa', 'alcanzada');
      fase.removeAttribute('aria-current');
    });
  };
}
