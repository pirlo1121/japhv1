/**
 * planes.ts
 * Modelos de trabajo de la página de servicios.
 * EJEMPLO: los precios son marcadores de posición. Define tus tarifas
 * reales o sustituye la cifra por "Según alcance".
 */

export interface Plan {
  nombre: string;
  precio: string;
  resumen: string;
  incluye: string[];
  destacado?: boolean;
  ejemplo: boolean;
}

export const planes: Plan[] = [
  {
    nombre: 'Pieza suelta',
    precio: 'Desde $000',
    resumen: 'Un entregable concreto con alcance cerrado.',
    incluye: [
      'Sitio, landing o identidad',
      'Cronograma definido al inicio',
      'Periodo de ajustes incluido'
    ],
    ejemplo: true
  },
  {
    nombre: 'Ecosistema',
    precio: 'Desde $000',
    resumen: 'Varios servicios diseñados como un solo sistema.',
    incluye: [
      'Diagnóstico y arquitectura',
      'Construcción por entregas',
      'Traspaso documentado al equipo'
    ],
    destacado: true,
    ejemplo: true
  },
  {
    nombre: 'Acompañamiento mensual',
    precio: 'Desde $000/mes',
    resumen: 'Mantenimiento, mejoras y crecimiento continuo.',
    incluye: [
      'Horas de desarrollo reservadas',
      'Monitoreo y copias de seguridad',
      'Reporte con recomendaciones'
    ],
    ejemplo: true
  }
];
