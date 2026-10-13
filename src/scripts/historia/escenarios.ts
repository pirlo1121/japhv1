/**
 * escenarios.ts
 * Dónde está el guía y cómo se ve la red en cada escena de la portada (el
 * storyboard en datos) y qué tramo de scroll lleva de una a la siguiente.
 * Entre escenas el robot viaja por la pantalla (escena.ts lo hace fluir con
 * un muelle); en cada una se coloca junto al contenido y lo señala.
 *
 * La historia: materia → energía → conexiones → sistema → productos →
 * crecimiento. Una gota flota en el vacío y, al bajar a la segunda escena,
 * toma forma de guía (`forma`); de su cuerpo nace la red,
 * dentro de él se encienden sus circuitos, presenta los servicios, recorre
 * el proceso y los proyectos y termina en el centro de un ecosistema ordenado.
 *
 * En pantallas anchas el guía vive a un lado del texto (o encima, cuando
 * señala hacia abajo); en móvil, en la mitad de arriba, más apagado detrás
 * del texto. Por eso los escenarios se calculan al montar la historia (y de
 * nuevo si cambia la orientación).
 */
import { ESCENARIO_INICIAL, type Escenario } from '@/scripts/lienzo/narrativa';

export interface Escenarios {
  /** 01 · El vacío: una gota flota a la derecha del titular. */
  vacio: Escenario;
  /** 02 · La transformación: la cámara se acerca y la gota ya es el robot... */
  transformacionInicio: Escenario;
  /** 02 · ...y lo rodea mientras señala el manifiesto. Aparecen los primeros filamentos. */
  transformacion: Escenario;
  /** 03 · La red viva: la cámara se aleja y la red crece desde su cuerpo. */
  red: Escenario;
  /** 04 · El núcleo: de cerca... */
  nucleoInicio: Escenario;
  /** 04 · ...se encienden los circuitos dentro de su cuerpo. */
  nucleo: Escenario;
  /** 05 · Servicios: a la derecha de la lista, señala el servicio activo. */
  servicios: Escenario;
  /** 06 · Proceso: arriba a la derecha, señala hacia abajo la fase actual. */
  proceso: Escenario;
  /** 07 · Proyectos: junto al titular, presenta los proyectos; la red se ordena. */
  proyectos: Escenario;
  /** 08 · Ecosistema: en el centro de la red completa, en calma. */
  ecosistema: Escenario;
  /** 09 · Hagámoslo real: arriba y al centro, señala la invitación. */
  llamada: Escenario;
}

/** Móvil o vertical: el guía arriba y centrado, el texto debajo. */
function vertical(e: Escenario, atenuacionMinima: number, alto = 0.42): Escenario {
  return {
    ...e,
    desplazamientoX: 0,
    desplazamientoY: Math.max(e.desplazamientoY, alto),
    atenuacion: Math.max(e.atenuacion, atenuacionMinima)
  };
}

/** El robot mira hacia la cámara (su giro sigue al azimut), con un leve desvío. */
const frente = (e: Omit<Escenario, 'giro'>, desvio = 0): Escenario => ({
  ...e,
  giro: e.azimut + desvio
});

export function crearEscenarios(estrecha: boolean): Escenarios {
  const vacio = ESCENARIO_INICIAL;
  const transformacionInicio = frente({
    ...vacio,
    azimut: 0.7,
    elevacion: 0.2,
    distancia: 7.2,
    desplazamientoX: 0.42,
    desplazamientoY: 0.02,
    flujo: 0.75,
    atenuacion: 0.04,
    red: 0.1,
    // Al llegar a esta escena la gota ya tomó forma de robot (todo el tramo de llegada).
    forma: 1
  });
  const transformacion = frente(
    {
      ...transformacionInicio,
      azimut: 1.0,
      elevacion: 0.2,
      distancia: 6.8,
      desplazamientoX: 0.46,
      desplazamientoY: 0,
      flujo: 0.9,
      atenuacion: 0.06,
      red: 0.27
    },
    -0.15
  );
  const red = frente(
    {
      ...transformacion,
      azimut: 1.3,
      elevacion: 0.16,
      distancia: 9,
      desplazamientoX: 0.34,
      flujo: 0.7,
      atenuacion: 0.03,
      red: 0.82
    },
    -0.2
  );
  const nucleoInicio = frente({
    ...red,
    azimut: 0.6,
    elevacion: 0.24,
    distancia: 7.6,
    desplazamientoX: 0.44,
    flujo: 0.55,
    grietas: 0
  });
  const nucleo = frente({ ...nucleoInicio, azimut: 0.8, distancia: 6.8, grietas: 1 }, -0.1);
  const servicios = frente({
    ...nucleo,
    azimut: 0.3,
    elevacion: 0.3,
    distancia: 9,
    desplazamientoX: 0.62,
    desplazamientoY: 0,
    flujo: 0.55,
    atenuacion: 0.25,
    red: 0.86
  });
  const proceso = frente({
    ...servicios,
    azimut: 0.25,
    elevacion: 0.18,
    distancia: 10.5,
    desplazamientoX: 0.66,
    desplazamientoY: 0.32,
    atenuacion: 0.1,
    grietas: 0
  });
  const proyectos = frente({
    ...proceso,
    azimut: 0.55,
    elevacion: 0.12,
    distancia: 10.5,
    desplazamientoX: 0.66,
    desplazamientoY: 0.32,
    flujo: 0.5,
    atenuacion: 0.15,
    red: 0.9,
    orden: 0.55
  });
  const ecosistema = frente({
    ...proyectos,
    azimut: 0.35,
    elevacion: 0.2,
    distancia: 8.5,
    desplazamientoX: 0.38,
    desplazamientoY: 0.02,
    flujo: 0.45,
    atenuacion: 0,
    red: 1,
    orden: 1
  });
  const llamada = frente({
    ...ecosistema,
    azimut: 0.3,
    elevacion: 0.18,
    distancia: 10,
    desplazamientoX: 0,
    desplazamientoY: 0.36,
    flujo: 0.35,
    atenuacion: 0.1
  });

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

  // En móvil el guía se queda arriba; en las escenas con mucho texto,
  // detrás y apagada: manda la lectura.
  return {
    vacio: vertical(vacio, 0),
    transformacionInicio: vertical(transformacionInicio, 0.15),
    transformacion: vertical(transformacion, 0.3),
    red: vertical({ ...red, distancia: 9.4 }, 0.3),
    nucleoInicio: vertical(nucleoInicio, 0.3),
    nucleo: vertical(nucleo, 0.3),
    servicios: vertical(servicios, 0.55),
    proceso: vertical(proceso, 0.55),
    proyectos: vertical(proyectos, 0.55),
    ecosistema: vertical(ecosistema, 0.15),
    llamada: vertical(llamada, 0.25, 0.4)
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
 * El recorrido del guía, con la cámara y la red, tramo a tramo y en el
 * orden de la historia. En escritorio las escenas 02, 03 y 04 quedan fijas
 * mientras avanzan (dos tramos: llegada y recorrido); en móvil cada escena
 * tiene un solo tramo.
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
    // Termina antes de que el titular llegue arriba: el guía ya está en su sitio.
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
