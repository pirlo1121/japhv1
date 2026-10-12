/**
 * iniciar.ts
 * La coreografía del scroll en la portada. Todo va ligado al scroll con
 * `scrub`, así que es reversible: al subir, la historia se deshace sola.
 *
 * - Escritorio y móvil tienen su propia configuración (gsap.matchMedia), que
 *   se desmonta y rehace sola al cambiar de tamaño o de orientación.
 * - En escritorio las escenas 02, 03, 04 y 06 quedan fijas (CSS sticky)
 *   mientras se transforman; en móvil son bloques normales y tramos cortos.
 * - Con "reducir movimiento" no hay tramos: la escultura y la red cambian de
 *   estado, sin animación, al cruzar cada escena. El texto es un documento
 *   normal.
 * - Lenis solo con ratón o trackpad; en táctil, el scroll nativo.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { EstadoNarrativo } from '@/scripts/lienzo/narrativa';
import { crearEscenarios, crearTramos, escenarioDe, type Tramo } from './escenarios';
import { iniciarProceso } from './proceso';
import { iniciarServicios } from './servicios';

/** Segundos que tarda la escena en alcanzar al scroll: suaviza sin despegarse. */
const INERCIA = 0.8;
/** Por debajo de esta proporción ancho/alto la escultura va arriba y el texto debajo. */
const ASPECTO_VERTICAL = 0.85;
/** Escenas que quedan fijas en escritorio mientras la escultura se transforma. */
const ESCENAS_FIJAS = ['#transformacion', '#red', '#nucleo'];

/**
 * Lenis con ratón o trackpad; en táctil, el scroll nativo. Lenis se descarga
 * solo cuando hace falta: hasta que llega, se usa el desplazamiento nativo.
 */
function iniciarDesplazamiento(suave: boolean): () => void {
  if (!suave) return () => {};
  let detener = () => {};
  let cancelado = false;
  import('lenis').then(({ default: Lenis }) => {
    if (cancelado) return;
    const lenis = new Lenis({ autoRaf: false, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    const latido = (segundos: number) => lenis.raf(segundos * 1000);
    gsap.ticker.add(latido);
    gsap.ticker.lagSmoothing(0);
    detener = () => {
      gsap.ticker.remove(latido);
      lenis.destroy();
    };
  });
  return () => {
    cancelado = true;
    detener();
  };
}

/** Mueve la escultura y la red de un escenario al siguiente, tramo a tramo. */
function moverEscena(estado: EstadoNarrativo, tramos: Tramo[]): void {
  for (const tramo of tramos) {
    if (!document.querySelector(tramo.disparador)) continue;
    gsap.fromTo(
      estado,
      { ...tramo.desde },
      {
        ...tramo.hasta,
        ease: 'sine.inOut',
        immediateRender: false,
        scrollTrigger: {
          trigger: tramo.disparador,
          start: tramo.inicio,
          end: tramo.fin,
          scrub: INERCIA
        }
      }
    );
  }
}

/** 01 · El mensaje principal sube y se desvanece mientras la gota empieza a estirarse. */
function salidaDelVacio(): void {
  gsap.to('.vacio .contenido', {
    yPercent: -10,
    opacity: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.vacio', start: 'top top', end: 'bottom 15%', scrub: true }
  });
}

/**
 * 02 · 03 · 04 · El texto de cada escena aparece por pasos según su
 * progreso (el CSS lee --p, 0..1). Siempre queda legible: solo cambia el
 * énfasis, nunca el contenido.
 */
function progresoDeEscenas(fija: boolean): () => void {
  const secciones = ESCENAS_FIJAS.map((s) => document.querySelector<HTMLElement>(s)).filter(
    (s): s is HTMLElement => s !== null
  );
  const disparadores = secciones.map((seccion) => {
    const escribir = (p: number) => seccion.style.setProperty('--p', p.toFixed(3));
    return ScrollTrigger.create({
      trigger: fija ? seccion : (seccion.querySelector('[data-pasos]') ?? seccion),
      start: fija ? 'top top' : 'top 75%',
      end: fija ? 'bottom bottom' : 'bottom 45%',
      onUpdate: (self) => escribir(self.progress),
      onRefresh: (self) => escribir(self.progress)
    });
  });
  return () => {
    for (const d of disparadores) d.kill();
    for (const s of secciones) s.style.removeProperty('--p');
  };
}

/** 07 · Cada proyecto se revela con un barrido de luz, una sola vez. */
function revelarProyectos(): void {
  gsap.utils.toArray<HTMLElement>('[data-reflejo]').forEach((visual) => {
    gsap.fromTo(
      visual,
      { '--revelado': 0 },
      {
        '--revelado': 1,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: { trigger: visual, start: 'top 88%', once: true }
      }
    );
  });
}

/** Los bloques sin coreografía propia entran con un fundido corto, una sola vez. */
function revelarBloques(): void {
  ScrollTrigger.batch('[data-revelar]', {
    start: 'top 90%',
    once: true,
    onEnter: (bloques) =>
      gsap.fromTo(
        bloques,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', overwrite: true }
      )
  });
}

/**
 * Sin movimiento: cada escena fija su estado al cruzar el centro de la
 * pantalla, sin interpolar. La escultura repinta al desplazarse (escena.ts).
 */
function escenasSinMovimiento(
  estado: EstadoNarrativo,
  escenarios: ReturnType<typeof crearEscenarios>
): () => void {
  const vigia = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const escenario = escenarioDe(escenarios, (entrada.target as HTMLElement).id);
        if (escenario) Object.assign(estado, escenario);
      }
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  document.querySelectorAll('[data-escena]').forEach((seccion) => vigia.observe(seccion));
  return () => vigia.disconnect();
}

/** Tiempo tras volver con "atrás" en el que los refrescos aún son del navegador, no del usuario. */
const ASENTAMIENTO_MS = 1500;

/**
 * Al volver con "atrás", el navegador puede restaurar la portada congelada
 * (bfcache) y ScrollTrigger, al volver a medir, sube al principio. Aquí se
 * recuerda la posición al salir y se devuelve tras cada refresco mientras
 * la página se asienta.
 */
function conservarPosicionAlVolver(): void {
  let posicion = 0;
  window.addEventListener('pagehide', () => {
    posicion = window.scrollY;
  });
  window.addEventListener('pageshow', (evento) => {
    if (!evento.persisted) return;
    const devolver = () => {
      if (Math.abs(window.scrollY - posicion) > 1) window.scrollTo(0, posicion);
      ScrollTrigger.update();
    };
    ScrollTrigger.addEventListener('refresh', devolver);
    window.setTimeout(
      () => ScrollTrigger.removeEventListener('refresh', devolver),
      ASENTAMIENTO_MS
    );
    devolver();
  });
}

export function iniciarHistoria(estado: EstadoNarrativo): void {
  gsap.registerPlugin(ScrollTrigger);
  conservarPosicionAlVolver();
  const medios = gsap.matchMedia();

  medios.add(
    {
      // Las escenas fijas necesitan ancho y alto: un móvil en horizontal usa la versión móvil.
      escritorio:
        '(min-width: 48rem) and (min-height: 34rem) and (prefers-reduced-motion: no-preference)',
      movil:
        '((max-width: 47.99rem) or (max-height: 33.99rem)) and (prefers-reduced-motion: no-preference)',
      punteroFino: '(pointer: fine)',
      // La escultura cambia de sitio (al lado del texto o encima) con la proporción.
      apaisado: `(min-aspect-ratio: ${ASPECTO_VERTICAL * 100}/100) and (min-width: 48rem)`
    },
    (contexto) => {
      const { escritorio, movil, punteroFino, apaisado } = contexto.conditions ?? {};
      const escenarios = crearEscenarios(!apaisado);
      const inicial = { ...escenarios.vacio, foco: -1 };
      Object.assign(estado, inicial);
      const detenerServicios = iniciarServicios(estado);

      if (!escritorio && !movil) {
        // Reducir movimiento: documento estático y escena por saltos.
        const detenerSaltos = escenasSinMovimiento(estado, escenarios);
        return () => {
          detenerSaltos();
          detenerServicios();
          Object.assign(estado, inicial);
        };
      }

      // Las escenas fijas se alargan antes de medir nada.
      const fijas = ESCENAS_FIJAS.map((s) => document.querySelector<HTMLElement>(s));
      for (const s of fijas) s?.classList.toggle('fija', Boolean(escritorio));
      for (const s of fijas) s?.classList.add('en-escena');

      const detenerDesplazamiento = iniciarDesplazamiento(Boolean(escritorio && punteroFino));
      const detenerProgreso = progresoDeEscenas(Boolean(escritorio));
      const detenerProceso = iniciarProceso(Boolean(escritorio));
      salidaDelVacio();
      revelarProyectos();
      revelarBloques();
      // Todo lo que mueve la escena, en el orden de la historia: si varios
      // tramos se ponen al día en el mismo fotograma (al recargar a mitad de
      // página o al saltar con un ancla), cada uno escribe después del anterior.
      moverEscena(estado, crearTramos(escenarios, Boolean(movil)));
      ScrollTrigger.refresh();

      return () => {
        detenerProgreso();
        detenerProceso();
        detenerServicios();
        detenerDesplazamiento();
        for (const s of fijas) s?.classList.remove('fija', 'en-escena');
        Object.assign(estado, inicial);
      };
    }
  );
}
