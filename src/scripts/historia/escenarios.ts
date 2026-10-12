/**
 * escenarios.ts
 * Cómo se ven la escultura y la red en cada escena de la portada (el
 * storyboard en datos) y qué tramo de scroll lleva de una a la siguiente.
 *
 * La historia: materia → energía → conexiones → sistema → productos →
 * crecimiento. La gota se estira en cinta, de la cinta nace la red, la
 * cinta se pliega alrededor del núcleo, el núcleo enmarca el trabajo y todo
 * se ordena en un ecosistema.
 *
 * En pantallas anchas la escultura vive a un lado del texto; en móvil, en
 * la mitad de arriba, más apagada detrás del texto. Por eso los escenarios
 * se calculan al montar la historia (y de nuevo si cambia la orientación).
 */
import { ESCENARIO_INICIAL, type Escenario } from '@/scripts/lienzo/narrativa';

export interface Escenarios {
  /** 01 · El vacío: la gota flota; la red duerme al fondo. */
  vacio: Escenario;
  /** 02 · La transformación: la gota empieza a estirarse... */
  transformacionInicio: Escenario;
  /** 02 · ...y termina en la cinta curva. Los primeros filamentos aparecen cerca. */
  transformacion: Escenario;
  /** 03 · La red viva: la cinta se estabiliza y la red crece a su alrededor. */
  red: Escenario;
  /** 04 · El núcleo: la cinta se pliega alrededor de un núcleo oscuro... */
  nucleoInicio: Escenario;
  /** 04 · ...cuyas grietas se encienden y se abren. */
  nucleo: Escenario;
  /** 05 · Servicios: la escena se aparta; cada servicio enciende su rama. */
  servicios: Escenario;
  /** 06 · Proceso: el camino de las fases manda; la escultura queda detrás. */
  proceso: Escenario;
  /** 07 · Proyectos: un aro que enmarca el trabajo; la red se ordena. */
  proyectos: Escenario;
  /** 08 · Ecosistema: núcleo, siete módulos y la red completa, en calma. */
  ecosistema: Escenario;
  /** 09 · Hagámoslo real: la firma de la escultura, detrás de la invitación. */
  llamada: Escenario;
}

/** Móvil o vertical: la escultura arriba y centrada, el texto debajo. */
function vertical(e: Escenario, atenuacionMinima: number, alto = 0.42): Escenario {
  return {
    ...e,
    desplazamientoX: 0,
    desplazamientoY: Math.max(e.desplazamientoY, alto),
    atenuacion: Math.max(e.atenuacion, atenuacionMinima)
  };
}

export function crearEscenarios(estrecha: boolean): Escenarios {
  const vacio = ESCENARIO_INICIAL;
  const transformacionInicio: Escenario = {
    ...vacio,
    forma: 0.35,
    azimut: 0.75,
    elevacion: 0.22,
    distancia: 5.7,
    desplazamientoX: 0.4,
    desplazamientoY: 0.02,
    flujo: 0.75,
    atenuacion: 0.04,
    red: 0.1
  };
  const transformacion: Escenario = {
    ...transformacionInicio,
    forma: 1,
    azimut: 1.2,
    elevacion: 0.24,
    distancia: 5,
    desplazamientoX: 0.42,
    desplazamientoY: 0,
    flujo: 0.9,
    atenuacion: 0.06,
    red: 0.27
  };
  const red: Escenario = {
    ...transformacion,
    azimut: 1.55,
    elevacion: 0.18,
    distancia: 7.6,
    desplazamientoX: 0.34,
    flujo: 0.7,
    atenuacion: 0.03,
    red: 0.82
  };
  const nucleoInicio: Escenario = {
    ...red,
    forma: 2,
    azimut: 0.6,
    elevacion: 0.26,
    distancia: 7.4,
    desplazamientoX: 0.42,
    flujo: 0.55,
    grietas: 0
  };
  const nucleo: Escenario = { ...nucleoInicio, azimut: 0.95, distancia: 6.6, grietas: 1 };
  const servicios: Escenario = {
    ...nucleo,
    azimut: 0.7,
    distancia: 10,
    desplazamientoX: 0.6,
    desplazamientoY: 0,
    flujo: 0.5,
    atenuacion: 0.5,
    red: 0.86
  };
  const proceso: Escenario = {
    ...servicios,
    azimut: 0.4,
    elevacion: 0.3,
    distancia: 9,
    desplazamientoX: 0,
    desplazamientoY: 0.46,
    atenuacion: 0.62
  };
  const proyectos: Escenario = {
    ...proceso,
    forma: 3,
    azimut: 0.55,
    elevacion: 0.1,
    distancia: 7.6,
    desplazamientoX: 0.48,
    desplazamientoY: 0.28,
    flujo: 0.5,
    atenuacion: 0.45,
    red: 0.9,
    orden: 0.55,
    grietas: 0
  };
  const ecosistema: Escenario = {
    ...proyectos,
    forma: 4,
    azimut: 0.35,
    elevacion: 0.34,
    distancia: 8.2,
    desplazamientoX: 0.36,
    desplazamientoY: 0.02,
    flujo: 0.38,
    atenuacion: 0,
    red: 1,
    orden: 1
  };
  const llamada: Escenario = {
    ...ecosistema,
    azimut: 0.25,
    elevacion: 0.4,
    distancia: 10.5,
    desplazamientoX: 0,
    desplazamientoY: 0.3,
    flujo: 0.22,
    atenuacion: 0.3
  };

  const anchos: Escenarios = {
    vacio,
    transformacionInicio,
    transformacion,
    red,
    nucleoInicio,
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
    transformacionInicio: vertical(transformacionInicio, 0.2),
    transformacion: vertical(transformacion, 0.35),
    red: vertical({ ...red, distancia: 8.4 }, 0.35),
    nucleoInicio: vertical(nucleoInicio, 0.35),
    nucleo: vertical(nucleo, 0.35),
    servicios: vertical(servicios, 0.62),
    proceso: vertical(proceso, 0.68),
    proyectos: vertical(proyectos, 0.66),
    ecosistema: vertical(ecosistema, 0.2),
    llamada: vertical(llamada, 0.35, 0.36)
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
 * Tramos de cámara, forma y red, en el orden de la historia. En escritorio
 * las escenas 02, 03 y 04 quedan fijas mientras se transforman (dos tramos:
 * llegada y transformación); en móvil cada escena tiene un solo tramo.
 */
export function crearTramos(e: Escenarios, movil: boolean): Tramo[] {
  const llegada = (
    disparador: string,
    desde: Escenario,
    hasta: Escenario,
    fin = movil ? 'center center' : 'top top'
  ): Tramo => ({ disparador, inicio: 'top bottom', fin, desde, hasta });
  const fija = (disparador: string, desde: Escenario, hasta: Escenario): Tramo => ({
    disparador,
    inicio: 'top top',
    fin: 'bottom bottom',
    desde,
    hasta
  });

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
    llegada('#transformacion', e.vacio, e.transformacionInicio),
    fija('#transformacion', e.transformacionInicio, e.transformacion),
    fija('#red', e.transformacion, e.red),
    llegada('#nucleo', e.red, e.nucleoInicio),
    fija('#nucleo', e.nucleoInicio, e.nucleo),
    llegada('#servicios', e.nucleo, e.servicios, 'top 65%'),
    llegada('#proceso', e.servicios, e.proceso),
    // Termina antes de que el titular llegue arriba: la escultura ya está en su sitio.
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
