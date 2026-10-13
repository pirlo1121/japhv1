/**
 * escenarios.ts
 * Dónde está la cámara y en qué plano está la arquitectura en cada escena
 * de la portada (el storyboard en datos), y qué tramo de scroll lleva de
 * una a la siguiente.
 *
 * La historia: misterio → descubrimiento → transformación → estructura →
 * conexión → creación → resolución. Un plano general del monolito con la
 * gota delante; un acercamiento mientras el monolito se abre y la gota se
 * estira en cinta; el espacio se ensancha para la red; la cámara avanza
 * hacia la cámara interior del núcleo; siete módulos; cuatro puertas; una
 * galería; el plano amplio del ecosistema completo y un pórtico final.
 * Cada escena se escribe entera (cámara, plano, red): el movimiento ocurre
 * en los tramos entre escenas y cada una se asienta para leerla.
 *
 * En pantallas anchas la escultura vive a un lado del texto (o encima,
 * cuando el texto va debajo); en móvil, en la mitad de arriba, más apagada
 * detrás del texto. Por eso los escenarios se calculan al montar la
 * historia (y de nuevo si cambia la orientación).
 */
import { ESCENARIO_INICIAL, type Escenario } from '@/scripts/lienzo/narrativa';

export interface Escenarios {
  /** 01 · El vacío: plano general; la gota flota delante del monolito. */
  vacio: Escenario;
  /** 02 · La transformación: el monolito se abre en pórtico y la gota se estira en cinta. */
  transformacion: Escenario;
  /** 03 · La red viva: el espacio se ensancha y la red crece desde la cinta. */
  red: Escenario;
  /** 04 · El núcleo: la cámara avanza hacia la cámara interior. */
  nucleo: Escenario;
  /** 05 · Servicios: siete módulos; se ilumina el del servicio activo. */
  servicios: Escenario;
  /** 06 · Proceso: cuatro puertas en un camino; se enciende la de la fase actual. */
  proceso: Escenario;
  /** 07 · Proyectos: una galería de nichos; la red empieza a ordenarse. */
  proyectos: Escenario;
  /** 08 · Ecosistema: plano amplio; todo alineado y conectado. */
  ecosistema: Escenario;
  /** 09 · Hagámoslo real: un último pórtico enmarca la escultura en calma. */
  llamada: Escenario;
}

/** Móvil o vertical: altura de la escultura en pantalla (desplazamientoY) por defecto. */
export const ALTO_VERTICAL = 0.38;

/** Móvil o vertical: la escultura arriba y centrada, el texto debajo. */
function vertical(e: Escenario, atenuacionMinima: number, alto = ALTO_VERTICAL): Escenario {
  return {
    ...e,
    desplazamientoX: 0,
    desplazamientoY: Math.max(e.desplazamientoY, alto),
    atenuacion: Math.max(e.atenuacion, atenuacionMinima)
  };
}

export function crearEscenarios(estrecha: boolean): Escenarios {
  const vacio = ESCENARIO_INICIAL;
  const transformacion: Escenario = {
    ...vacio,
    azimut: 0.95,
    elevacion: 0.16,
    distancia: 7.4,
    desplazamientoX: 0.42,
    desplazamientoY: 0,
    flujo: 0.8,
    atenuacion: 0.05,
    red: 0.22,
    forma: 1,
    escena: 1
  };
  const red: Escenario = {
    ...transformacion,
    azimut: 1.25,
    elevacion: 0.2,
    distancia: 9.6,
    desplazamientoX: 0.36,
    flujo: 0.7,
    atenuacion: 0.04,
    red: 0.82,
    escena: 2
  };
  const nucleo: Escenario = {
    ...red,
    azimut: 0.72,
    elevacion: 0.1,
    distancia: 7.4,
    objetivoX: 0.35,
    objetivoY: 0.1,
    objetivoZ: -2.4,
    desplazamientoX: 0.44,
    flujo: 0.55,
    atenuacion: 0.06,
    escena: 3
  };
  const servicios: Escenario = {
    ...nucleo,
    azimut: 0.3,
    elevacion: 0.2,
    distancia: 9.4,
    objetivoX: 0.5,
    objetivoY: 0,
    objetivoZ: -1,
    desplazamientoX: 0.58,
    desplazamientoY: 0,
    atenuacion: 0.3,
    red: 0.86,
    escena: 4
  };
  const proceso: Escenario = {
    ...servicios,
    azimut: 0.25,
    elevacion: 0.17,
    distancia: 10.5,
    objetivoX: 0.4,
    objetivoZ: -2.5,
    desplazamientoX: 0.55,
    desplazamientoY: 0.28,
    atenuacion: 0.12,
    escena: 5
  };
  const proyectos: Escenario = {
    ...proceso,
    azimut: 0.55,
    elevacion: 0.12,
    distancia: 10,
    objetivoX: 0,
    objetivoZ: -2,
    desplazamientoX: 0.58,
    desplazamientoY: 0.3,
    flujo: 0.5,
    atenuacion: 0.2,
    red: 0.9,
    orden: 0.55,
    escena: 6
  };
  const ecosistema: Escenario = {
    ...proyectos,
    azimut: 0.35,
    elevacion: 0.26,
    distancia: 13,
    objetivoX: 0,
    objetivoY: 0,
    objetivoZ: -3,
    desplazamientoX: 0.3,
    desplazamientoY: 0,
    flujo: 0.45,
    atenuacion: 0,
    red: 1,
    orden: 1,
    escena: 7
  };
  const llamada: Escenario = {
    ...ecosistema,
    azimut: 0.3,
    elevacion: 0.14,
    distancia: 10,
    objetivoY: 0.3,
    objetivoZ: -2,
    desplazamientoX: 0,
    desplazamientoY: 0.32,
    flujo: 0.35,
    atenuacion: 0.1,
    escena: 8
  };

  const anchos: Escenarios = {
    vacio,
    transformacion,
    red,
    nucleo,
    servicios,
    proceso,
    proyectos,
    ecosistema,
    llamada
  };
  if (!estrecha) return anchos;

  // En móvil la escultura se queda arriba; en las escenas con mucho texto,
  // detrás y apagada: manda la lectura.
  return {
    vacio: vertical(vacio, 0),
    transformacion: vertical(transformacion, 0.3),
    red: vertical(red, 0.3),
    nucleo: vertical(nucleo, 0.3),
    servicios: vertical(servicios, 0.55),
    proceso: vertical(proceso, 0.55),
    proyectos: vertical(proyectos, 0.55),
    ecosistema: vertical(ecosistema, 0.15),
    llamada: vertical(llamada, 0.25, 0.36)
  };
}

export interface Tramo {
  /** Elemento que marca el tramo. */
  disparador: string;
  inicio: string;
  fin: string;
  desde: Escenario;
  hasta: Escenario;
}

/**
 * El recorrido de la cámara, la arquitectura y la red, tramo a tramo y en
 * el orden de la historia: cada escena cambia mientras entra en pantalla y
 * se queda quieta mientras se lee (de su llegada arriba a su salida).
 * Ninguna escena se queda fija: cada movimiento del scroll baja la página
 * (fijarlas se sentía lento, como si el scroll se trabara).
 */
export function crearTramos(e: Escenarios, movil: boolean): Tramo[] {
  const llegada = (
    disparador: string,
    desde: Escenario,
    hasta: Escenario,
    fin = movil ? 'center center' : 'top top'
  ): Tramo => ({ disparador, inicio: 'top bottom', fin, desde, hasta });

  if (movil) {
    return [
      llegada('#transformacion', e.vacio, e.transformacion),
      {
        disparador: '#red',
        inicio: 'top bottom',
        fin: 'bottom 70%',
        desde: e.transformacion,
        hasta: e.red
      },
      llegada('#nucleo', e.red, e.nucleo),
      llegada('#servicios', e.nucleo, e.servicios, 'top 30%'),
      llegada('#proceso', e.servicios, e.proceso, 'top 30%'),
      llegada('#proyectos-destacados', e.proceso, e.proyectos, 'top 40%'),
      llegada('#ecosistema', e.proyectos, e.ecosistema),
      llegada('#llamada', e.ecosistema, e.llamada)
    ];
  }
  return [
    llegada('#transformacion', e.vacio, e.transformacion),
    llegada('#red', e.transformacion, e.red, 'top 15%'),
    llegada('#nucleo', e.red, e.nucleo),
    llegada('#servicios', e.nucleo, e.servicios, 'top 65%'),
    llegada('#proceso', e.servicios, e.proceso),
    // Termina antes de que el titular llegue arriba: la escena ya está en su sitio.
    llegada('#proyectos-destacados', e.proceso, e.proyectos, 'top 55%'),
    llegada('#ecosistema', e.proyectos, e.ecosistema, 'center center'),
    llegada('#llamada', e.ecosistema, e.llamada, 'center center')
  ];
}

/** El escenario en que queda cada escena: lo que se ve sin movimiento, escena a escena. */
export function escenarioDe(e: Escenarios, escena: string): Escenario | undefined {
  const mapa: Record<string, Escenario> = {
    inicio: e.vacio,
    transformacion: e.transformacion,
    red: e.red,
    nucleo: e.nucleo,
    servicios: e.servicios,
    proceso: e.proceso,
    'proyectos-destacados': e.proyectos,
    ecosistema: e.ecosistema,
    llamada: e.llamada
  };
  return mapa[escena];
}
