/**
 * narrativa.ts
 * El estado que cuenta la historia: dónde está el guía en la pantalla,
 * desde dónde lo mira la cámara, hacia dónde se gira, cuánto ha crecido la
 * red y qué servicio se destaca.
 *
 * La historia (scripts/historia) lo anima con el scroll; la escena
 * (escena.ts) lo lee en cada fotograma. Ninguna de las dos conoce a la otra:
 * si WebGL falla, la historia sigue moviendo el texto y la red igual.
 */
import type { Orbita } from './camara';

export interface Escenario extends Readonly<Orbita> {
  /** Giro del robot alrededor del eje vertical (radianes). */
  readonly giro: number;
  /** Velocidad del movimiento interno del líquido (y de la energía de la red). */
  readonly flujo: number;
  /** 0..1: apaga la escena para que mande el contenido. */
  readonly atenuacion: number;
  /** 0..1: cuánto de la red está despierto (de unos filamentos lejanos al sistema entero). */
  readonly red: number;
  /** 0..1: de ramas orgánicas a una estructura ordenada (proyectos, ecosistema). */
  readonly orden: number;
  /** 0..1: circuitos de luz encendidos dentro del cuerpo (escena del núcleo). */
  readonly grietas: number;
  /** 0..1: de gota flotante a robot. La gota toma forma al bajar a la segunda escena. */
  readonly forma: number;
}

export type EstadoNarrativo = { -readonly [K in keyof Escenario]: Escenario[K] } & {
  /**
   * Rama destacada (un servicio, 0..6); -1 si ninguna. No se interpola:
   * cambia de golpe y la escena suaviza el brillo.
   */
  foco: number;
  /**
   * 0..1: la gota que se desprende del guía y toma la forma del titular
   * [data-gota] (escena 02). Lo anima su propio tramo de scroll.
   */
  titular: number;
};

/** Escena 01 · El vacío: el guía, aún gota, flota a la derecha del titular. */
export const ESCENARIO_INICIAL: Escenario = {
  // Mira a la cámara: su giro coincide con el azimut.
  giro: 0.5,
  azimut: 0.5,
  elevacion: 0.14,
  distancia: 8,
  desplazamientoX: 0.4,
  desplazamientoY: 0.02,
  flujo: 0.6,
  atenuacion: 0,
  red: 0.06,
  orden: 0,
  grietas: 0,
  forma: 0
};

export const crearEstadoNarrativo = (): EstadoNarrativo => ({
  ...ESCENARIO_INICIAL,
  foco: -1,
  titular: 0
});
