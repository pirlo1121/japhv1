/**
 * cifras.ts
 * EJEMPLO: cifras sin verificar, puestas para ilustrar el diseño.
 * Publicar métricas inventadas puede constituir publicidad engañosa:
 * reemplázalas por datos reales y comprobables, o elimina el bloque.
 */

export interface Cifra {
  /** Valor final del contador. */
  valor: number;
  sufijo?: string;
  descripcion: string;
  ejemplo: boolean;
}

/** Portada: "JAPH en números". */
export const cifrasPortada: Cifra[] = [
  { valor: 0, descripcion: 'Proyectos entregados. Sustituye por tu total real.', ejemplo: true },
  { valor: 0, descripcion: 'Clientes activos. Sustituye por tu cifra real.', ejemplo: true },
  { valor: 0, sufijo: ' años', descripcion: 'Años de trayectoria del equipo.', ejemplo: true },
  {
    valor: 0,
    sufijo: '%',
    descripcion: 'Indicador propio: satisfacción, renovación o el que midas.',
    ejemplo: true
  }
];

/** Nosotros: métricas del estudio. */
export const cifrasEstudio: Cifra[] = [
  { valor: 0, sufijo: ' años', descripcion: 'Trayectoria del estudio', ejemplo: true },
  { valor: 0, descripcion: 'Proyectos entregados', ejemplo: true },
  { valor: 0, descripcion: 'Personas en el equipo', ejemplo: true },
  { valor: 0, descripcion: 'Países donde operan los clientes', ejemplo: true }
];
