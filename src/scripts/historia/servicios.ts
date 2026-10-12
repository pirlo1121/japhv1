/**
 * servicios.ts
 * Escena 05 · Servicios. Cada servicio es una rama de la red: al activarlo,
 * su nodo se enciende en verde, un hilo lo une con el texto y la energía
 * fluye por su filamento hacia la escultura (escena.ts y red.ts leen
 * `estado.foco` y el atributo data-activa).
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
  const ramas = [...seccion.querySelectorAll<HTMLElement>('[data-rama]')];
  const limpieza = new AbortController();
  const { signal } = limpieza;

  let porScroll = -1;
  let porPuntero = -1;
  const pintar = () => {
    const activa = porPuntero >= 0 ? porPuntero : porScroll;
    estado.foco = activa;
    ramas.forEach((rama, i) => {
      if (i === activa) rama.dataset.activa = '';
      else delete rama.dataset.activa;
    });
  };

  ramas.forEach((rama, i) => {
    const entrar = () => {
      porPuntero = i;
      pintar();
    };
    const salir = () => {
      if (porPuntero === i) porPuntero = -1;
      pintar();
    };
    rama.addEventListener('pointerenter', entrar, { signal });
    rama.addEventListener('pointerleave', salir, { signal });
    rama.addEventListener('focusin', entrar, { signal });
    rama.addEventListener('focusout', salir, { signal });
  });

  const disparadores = ramas.map((rama, i) =>
    ScrollTrigger.create({
      trigger: rama,
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
