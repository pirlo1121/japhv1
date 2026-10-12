/**
 * narrativa.ts
 * El estado que cuenta la historia: qué forma tiene la escultura, desde
 * dónde la mira la cámara, cuánto ha crecido la red y qué pieza se destaca.
 *
 * La historia (scripts/historia) lo anima con el scroll; la escena
 * (escena.ts) lo lee en cada fotograma. Ninguna de las dos conoce a la otra:
 * si WebGL falla, la historia sigue moviendo el texto y la red igual.
 */
import type { Orbita } from './camara';

export interface Escenario extends Readonly<Orbita> {
  /** 0..4: masa, cinta, núcleo, portal, ecosistema (escultura.ts). */
  readonly forma: number;
  /** Velocidad del movimiento interno del líquido (y de la energía de la red). */
  readonly flujo: number;
  /** 0..1: apaga la escena para que mande el contenido. */
  readonly atenuacion: number;
  /** 0..1: cuánto de la red está despierto (de unos filamentos lejanos al sistema entero). */
  readonly red: number;
  /** 0..1: de ramas orgánicas a una estructura ordenada (proyectos, ecosistema). */
  readonly orden: number;
  /** 0..1: grietas encendidas y aperturas del núcleo. */
  readonly grietas: number;
}

export type EstadoNarrativo = { -readonly [K in keyof Escenario]: Escenario[K] } & {
  /**
   * Rama destacada (un servicio, 0..6); -1 si ninguna. No se interpola:
   * cambia de golpe y la escena suaviza el brillo.
   */
  foco: number;
};

/** Escena 01 · El vacío: la gota, a la derecha del titular, con la red dormida al fondo. */
export const ESCENARIO_INICIAL: Escenario = {
  forma: 0,
  azimut: 0.5,
  elevacion: 0.14,
  distancia: 6.4,
  desplazamientoX: 0.38,
  desplazamientoY: 0.04,
  flujo: 0.6,
  atenuacion: 0,
  red: 0.06,
  orden: 0,
  grietas: 0
};

export const crearEstadoNarrativo = (): EstadoNarrativo => ({ ...ESCENARIO_INICIAL, foco: -1 });
