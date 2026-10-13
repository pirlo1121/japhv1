/**
 * escenarios.ts
 * Dónde está la cámara y en qué plano está la arquitectura en cada
 * capítulo de la portada (el storyboard en datos), y qué tramo de scroll
 * lleva de uno al siguiente.
 *
 * La historia, en seis capítulos: una intención (la gota) adquiere forma
 * (se estira y atraviesa el monolito abierto), esa forma encuentra
 * estructura (siete módulos, cuatro puertas) y la estructura revela
 * resultados (una galería); al final el pórtico del principio vuelve, en
 * calma, para la invitación.
 *
 * Cada capítulo tiene una composición estable: el movimiento ocurre solo
 * en el tramo corto en que el capítulo siguiente entra en pantalla, y se
 * deshace igual al subir. La cámara cambia poco entre capítulos (sin
 * saltos de escala ni giros amplios): ayuda a leer la composición.
 *
 * En pantallas anchas la escultura vive a un lado del texto (o encima,
 * cuando el texto va debajo). En móvil o vertical es una presentación
 * propia: la escena ocupa la mitad de arriba solo en los capítulos donde es
 * protagonista (presencia, transformación, apertura); en los de contenido
 * queda apagada detrás, quieta (la escena entra en reposo y deja de
 * pintar) y el texto empieza arriba. Por eso los escenarios se calculan al
 * montar la historia (y de nuevo si cambia la orientación).
 */
import { ESCENARIO_INICIAL, type Escenario } from '@/scripts/lienzo/narrativa';

export interface Escenarios {
  /** 01 · Presencia: plano general; la gota flota delante del monolito. */
  presencia: Escenario;
  /** 02 · Transformación: el monolito se abre en pórtico y la gota, estirada, lo atraviesa. */
  transformacion: Escenario;
  /** 03 · Capacidades: siete módulos; se ilumina el del servicio activo. */
  capacidades: Escenario;
  /** 04 · Método: cuatro puertas en un camino; se enciende la de la fase actual. */
  metodo: Escenario;
  /** 05 · Evidencia: una galería de nichos; la escena se calla para los proyectos. */
  evidencia: Escenario;
  /** 06 · Apertura: el pórtico del principio, en calma, enmarca la invitación. */
  apertura: Escenario;
}

/** Móvil o vertical: altura de la escultura en pantalla (desplazamientoY) por defecto. */
export const ALTO_VERTICAL = 0.38;
/**
 * Móvil o vertical: atenuación de los capítulos de contenido. Por encima de
 * REPOSO.atenuacion (escena.ts), la escena deja de pintar cuando no cambia.
 */
const ATENUACION_DE_LECTURA = 0.9;

/**
 * El objetivo de la cámara, escrito en el marco del plano de su capítulo
 * (como las piezas en arquitectura.ts: x a la derecha de la pantalla, z
 * hacia el espectador) y llevado al mundo. `az` es el del plano, que es el
 * azimut de la cámara.
 */
function objetivo(az: number, x: number, y: number, z: number) {
  const c = Math.cos(az);
  const s = Math.sin(az);
  return { azimut: az, objetivoX: x * c + z * s, objetivoY: y, objetivoZ: -x * s + z * c };
}

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
  const presencia = ESCENARIO_INICIAL;
  const transformacion: Escenario = {
    ...presencia,
    // Mira al pórtico, algo por delante de él: queda a la derecha del texto.
    ...objetivo(0.95, 0.9, 0, -3.2),
    elevacion: 0.14,
    distancia: 12.5,
    desplazamientoX: 0.4,
    desplazamientoY: 0,
    flujo: 0.75,
    atenuacion: 0.05,
    forma: 1,
    escena: 1
  };
  const capacidades: Escenario = {
    ...transformacion,
    ...objetivo(0.3, 0.77, 0, -0.81),
    elevacion: 0.2,
    distancia: 9.4,
    desplazamientoX: 0.58,
    desplazamientoY: 0,
    flujo: 0.55,
    atenuacion: 0.4,
    escena: 2
  };
  const metodo: Escenario = {
    ...capacidades,
    // Mira al centro del camino de puertas.
    ...objetivo(0.25, 0.7, -0.2, -7.9),
    elevacion: 0.16,
    distancia: 16,
    desplazamientoX: 0.52,
    desplazamientoY: 0.3,
    atenuacion: 0.25,
    escena: 3
  };
  const evidencia: Escenario = {
    ...metodo,
    ...objetivo(0.55, 1.05, 0, -1.71),
    elevacion: 0.12,
    distancia: 10,
    desplazamientoX: 0.58,
    desplazamientoY: 0.3,
    flujo: 0.45,
    atenuacion: 0.6,
    escena: 4
  };
  const apertura: Escenario = {
    ...evidencia,
    // De frente al pórtico, centrado sobre la invitación.
    ...objetivo(0.3, 0, -1.2, -3),
    elevacion: 0.1,
    distancia: 14,
    desplazamientoX: 0,
    desplazamientoY: 0.22,
    flujo: 0.35,
    atenuacion: 0.15,
    escena: 5
  };

  if (!estrecha) return { presencia, transformacion, capacidades, metodo, evidencia, apertura };

  return {
    presencia: vertical(presencia, 0),
    transformacion: vertical(transformacion, 0.1),
    capacidades: vertical(capacidades, ATENUACION_DE_LECTURA),
    metodo: vertical(metodo, ATENUACION_DE_LECTURA),
    evidencia: vertical(evidencia, ATENUACION_DE_LECTURA),
    apertura: vertical(apertura, 0.2, 0.34)
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
 * El recorrido de la cámara, la arquitectura y la escultura, tramo a tramo
 * y en el orden de la historia: cada capítulo cambia en el tramo corto en
 * que entra en pantalla y se queda quieto mientras se lee. Ninguno se queda
 * fijo: cada movimiento del scroll baja la página.
 */
export function crearTramos(e: Escenarios, movil: boolean): Tramo[] {
  const llegada = (disparador: string, desde: Escenario, hasta: Escenario, fin: string): Tramo => ({
    disparador,
    inicio: 'top 90%',
    fin,
    desde,
    hasta
  });
  // La transformación es el gesto principal: tiene un tramo más largo, con
  // principio (la gota), desarrollo (se estira mientras el monolito se abre)
  // y final (la curva cruza el pórtico) legibles.
  return [
    {
      ...llegada('#transformacion', e.presencia, e.transformacion, 'top top'),
      inicio: 'top bottom'
    },
    llegada('#servicios', e.transformacion, e.capacidades, movil ? 'top 50%' : 'top 35%'),
    llegada('#proceso', e.capacidades, e.metodo, movil ? 'top 50%' : 'top 35%'),
    llegada('#proyectos-destacados', e.metodo, e.evidencia, movil ? 'top 50%' : 'top 40%'),
    llegada('#llamada', e.evidencia, e.apertura, movil ? 'top 40%' : 'top 25%')
  ];
}

/** El escenario en que queda cada capítulo: lo que se ve sin movimiento, capítulo a capítulo. */
export function escenarioDe(e: Escenarios, capitulo: string): Escenario | undefined {
  const mapa: Record<string, Escenario> = {
    inicio: e.presencia,
    transformacion: e.transformacion,
    servicios: e.capacidades,
    proceso: e.metodo,
    'proyectos-destacados': e.evidencia,
    llamada: e.apertura
  };
  return mapa[capitulo];
}
