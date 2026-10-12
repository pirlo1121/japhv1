/**
 * proceso.ts
 * Las cuatro fases de trabajo, en el orden en que ocurren.
 */

export interface Fase {
  titulo: string;
  descripcion: string;
}

export const fases: Fase[] = [
  {
    titulo: 'Diagnóstico',
    descripcion:
      'Revisamos datos, procesos y competencia. Salimos con un mapa del ecosistema actual y las prioridades que más impacto tienen.'
  },
  {
    titulo: 'Diseño del sistema',
    descripcion:
      'Arquitectura, identidad y prototipo navegable. Todo se aprueba contigo antes de escribir el código definitivo.'
  },
  {
    titulo: 'Construcción',
    descripcion:
      'Entregas periódicas en un entorno real. Ves el avance sin esperar al final y puedes corregir el rumbo a tiempo.'
  },
  {
    titulo: 'Acompañamiento',
    descripcion:
      'Medimos, ajustamos y hacemos crecer el sistema. Cada reporte llega con decisiones recomendadas, no solo con gráficas.'
  }
];
