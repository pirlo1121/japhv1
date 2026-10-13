/**
 * servicios.ts
 * Capítulo 03 · Capacidades. Cada servicio es un módulo de la
 * arquitectura: al activarlo, su losa recoge luz fría en las aristas
 * (escena.ts y arquitectura.ts leen `estado.foco`).
 *
 * Se activa con el puntero, con el foco del teclado o, al desplazarse, el
 * servicio que cruza el centro de la pantalla: en táctil no hace falta
 * hover. El contenido nunca depende de esto: es una lista normal.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { EstadoNarrativo } from '@/scripts/lienzo/narrativa';

export function iniciarServicios(estado: EstadoNarrativo): () => void {
  const seccion = document.querySelector<HTMLElement>('[data-servicios]');
  if (!seccion) return () => {};
  const modulos = [...seccion.querySelectorAll<HTMLElement>('[data-servicio]')];
  const limpieza = new AbortController();
  const { signal } = limpieza;

  let porScroll = -1;
  let porPuntero = -1;
  const pintar = () => {
    const activa = porPuntero >= 0 ? porPuntero : porScroll;
    estado.foco = activa;
    modulos.forEach((modulo, i) => {
      if (i === activa) modulo.dataset.activa = '';
      else delete modulo.dataset.activa;
    });
  };

  modulos.forEach((modulo, i) => {
    const entrar = () => {
      porPuntero = i;
      pintar();
    };
    const salir = () => {
      if (porPuntero === i) porPuntero = -1;
      pintar();
    };
    modulo.addEventListener('pointerenter', entrar, { signal });
    modulo.addEventListener('pointerleave', salir, { signal });
    modulo.addEventListener('focusin', entrar, { signal });
    modulo.addEventListener('focusout', salir, { signal });
  });

  const disparadores = modulos.map((modulo, i) =>
    ScrollTrigger.create({
      trigger: modulo,
      start: 'top 58%',
      end: 'bottom 58%',
      onToggle: (self) => {
        if (self.isActive) porScroll = i;
        else if (porScroll === i) porScroll = -1;
        pintar();
      }
    })
  );

  return () => {
    limpieza.abort();
    for (const d of disparadores) d.kill();
    porScroll = -1;
    porPuntero = -1;
    pintar();
  };
}
