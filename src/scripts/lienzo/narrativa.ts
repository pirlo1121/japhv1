/**
 * narrativa.ts
 * El estado que cuenta la historia: desde dónde mira la cámara, dónde cae
 * la escultura en pantalla, en qué plano está la arquitectura, cuánto se
 * ha estirado la gota en cinta y cuánto ha crecido la red.
 *
 * La historia (scripts/historia) lo anima con el scroll; la escena
 * (escena.ts) lo lee en cada fotograma. Ninguna de las dos conoce a la otra:
 * si WebGL falla, la historia sigue moviendo el texto y la red igual.
 */
import type { Orbita } from './camara';

export interface Escenario extends Readonly<Orbita> {
  /** Velocidad del movimiento interno del líquido (y de la energía de la red). */
  readonly flujo: number;
  /** 0..1: apaga la escultura para que mande el contenido. */
  readonly atenuacion: number;
  /** 0..1: cuánto de la red está despierto (de unos filamentos lejanos al sistema entero). */
  readonly red: number;
  /** 0..1: de ramas orgánicas a una estructura ordenada (proyectos, ecosistema). */
  readonly orden: number;
  /** 0..1: de gota flotante a cinta de cromo. La gota se estira al bajar a la segunda escena. */
  readonly forma: number;
  /**
   * Plano de la arquitectura (arquitectura.ts): 0 = vacío … 8 = llamada.
   * Continuo: entre dos planos, los monolitos se desplazan y se funden.
   */
  readonly escena: number;
}

export type EstadoNarrativo = { -readonly [K in keyof Escenario]: Escenario[K] } & {
  /**
   * Servicio destacado (0..6); -1 si ninguno. No se interpola: cambia de
   * golpe y la escena suaviza la luz de su módulo y su rama.
   */
  foco: number;
  /** 0..4: fase del proceso que se recorre (la pone proceso.ts); enciende sus puertas. */
  etapa: number;
};

/** Escena 01 · El vacío: la gota flota delante del monolito, a la derecha del titular. */
export const ESCENARIO_INICIAL: Escenario = {
  azimut: 0.5,
  elevacion: 0.14,
  distancia: 8,
  objetivoX: 0,
  objetivoY: 0,
  objetivoZ: 0,
  desplazamientoX: 0.4,
  desplazamientoY: 0.02,
  flujo: 0.6,
  atenuacion: 0,
  red: 0.06,
  orden: 0,
  forma: 0,
  escena: 0
};

/**
 * El póster de la gota (assets/gota-inicial.webp): el primer fotograma del
 * escenario inicial, renderizado con el mismo sombreador y sin arquitectura
 * (el monolito emerge de la oscuridad cuando WebGL ya pinta). Cubre
 * ±`extension` unidades del mundo alrededor del centro de la gota. Si
 * cambias la gota, la luz del cromo, la cámara o este escenario, vuelve a
 * renderizarlo (ver "La gota al abrir" en el README).
 */
export const POSTER_DE_LA_GOTA = { extension: 2 } as const;

export const crearEstadoNarrativo = (): EstadoNarrativo => ({
  ...ESCENARIO_INICIAL,
  foco: -1,
  etapa: 0
});
