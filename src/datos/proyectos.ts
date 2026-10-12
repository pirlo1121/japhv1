/**
 * proyectos.ts
 * Portafolio, proyectos destacados de la portada y el caso en detalle.
 *
 * EJEMPLO: todo el contenido de este archivo es provisional. Para publicar
 * un caso real:
 *   1. Guarda la imagen en src/assets/proyectos/ (jpg, png o webp).
 *   2. Impórtala arriba:  import verde from '@/assets/proyectos/verde.webp';
 *   3. Ponla en `imagen` junto con un `alt` descriptivo y cambia `ejemplo` a false.
 * Astro generará AVIF/WebP en varios tamaños y la cargará en diferido.
 */

import type { ImageMetadata } from 'astro';

export type Categoria = 'web' | 'app' | 'automatizacion' | 'marketing' | 'marca';

export interface Filtro {
  id: Categoria | 'todo';
  etiqueta: string;
}

export const filtros: Filtro[] = [
  { id: 'todo', etiqueta: 'Todo' },
  { id: 'web', etiqueta: 'Web' },
  { id: 'app', etiqueta: 'Apps' },
  { id: 'automatizacion', etiqueta: 'Automatización' },
  { id: 'marketing', etiqueta: 'Marketing' },
  { id: 'marca', etiqueta: 'Video y marca' }
];

export interface Proyecto {
  titulo: string;
  descripcion: string;
  categorias: Categoria[];
  /** Texto del sello sobre la imagen, por ejemplo "Web · Marca". */
  sello: string;
  anio: string;
  imagen?: ImageMetadata;
  alt?: string;
  /** Degradado provisional (1 a 6) mientras no hay imagen. */
  tono: number;
  ejemplo: boolean;
}

export const proyectos: Proyecto[] = [
  {
    titulo: 'Proyecto de ejemplo uno',
    descripcion: 'Describe el reto del cliente, qué construimos y qué cambió después.',
    categorias: ['web', 'marca'],
    sello: 'Web · Marca',
    anio: 'Año',
    tono: 1,
    ejemplo: true
  },
  {
    titulo: 'Proyecto de ejemplo dos',
    descripcion: 'Resume el alcance del trabajo y el indicador que se movió.',
    categorias: ['app', 'automatizacion'],
    sello: 'App · Automatización',
    anio: 'Año',
    tono: 2,
    ejemplo: true
  },
  {
    titulo: 'Proyecto de ejemplo tres',
    descripcion: 'Indica el sector del cliente para que el visitante se reconozca en el caso.',
    categorias: ['web', 'marketing'],
    sello: 'Web · Marketing',
    anio: 'Año',
    tono: 3,
    ejemplo: true
  },
  {
    titulo: 'Proyecto de ejemplo cuatro',
    descripcion: 'Explica qué proceso manual se eliminó y cuánto tiempo se liberó.',
    categorias: ['automatizacion'],
    sello: 'Automatización',
    anio: 'Año',
    tono: 4,
    ejemplo: true
  },
  {
    titulo: 'Proyecto de ejemplo cinco',
    descripcion: 'Cuenta qué piezas se produjeron y para qué canales.',
    categorias: ['marca', 'marketing'],
    sello: 'Video · Marca',
    anio: 'Año',
    tono: 5,
    ejemplo: true
  },
  {
    titulo: 'Proyecto de ejemplo seis',
    descripcion: 'Describe la herramienta construida y quién la usa a diario.',
    categorias: ['app', 'web'],
    sello: 'App · Portal',
    anio: 'Año',
    tono: 6,
    ejemplo: true
  }
];

export interface Destacado {
  titulo: string;
  /** Qué se creó, en una frase. */
  descripcion: string;
  /** Qué problema resolvía. */
  problema: string;
  /** Qué hizo JAPH. */
  rol: string;
  /** Resultado medido. Solo si está verificado; si no, se omite. */
  resultado?: string;
  /** Enlace al proyecto o a su caso, si existe. */
  enlace?: string;
  imagen?: ImageMetadata;
  alt?: string;
  tono: number;
  ejemplo: boolean;
}

/** Los tres casos de la portada. */
export const destacados: Destacado[] = [
  {
    titulo: 'Nombre del proyecto uno',
    descripcion: 'Qué construimos, en una frase: por ejemplo, un portal de clientes.',
    problema: 'El reto del cliente antes del proyecto.',
    rol: 'Qué hizo JAPH: diseño, desarrollo, automatización...',
    resultado: 'El indicador que cambió, solo si está verificado.',
    tono: 1,
    ejemplo: true
  },
  {
    titulo: 'Nombre del proyecto dos',
    descripcion: 'Qué construimos, en una frase: web, app, automatización o campaña.',
    problema: 'Qué no funcionaba o qué faltaba.',
    rol: 'Las capacidades de JAPH que intervinieron.',
    tono: 2,
    ejemplo: true
  },
  {
    titulo: 'Nombre del proyecto tres',
    descripcion: 'Qué construimos, en una frase, y para qué sector.',
    problema: 'El problema, contado como lo contaría el cliente.',
    rol: 'Qué parte del trabajo fue de JAPH.',
    tono: 3,
    ejemplo: true
  }
];

export const casoDestacado = {
  ejemplo: true,
  titulo: 'Título del caso destacado',
  relato:
    'Usa este espacio para contar el proyecto completo: cómo trabajaba el cliente antes, qué se diseñó y construyó, y qué pasó después del lanzamiento. Es el lugar para explicar decisiones, no solo para mostrar el resultado.',
  indicadores: [
    { cifra: '00', etiqueta: 'Primer indicador' },
    { cifra: '00', etiqueta: 'Segundo indicador' },
    { cifra: '00', etiqueta: 'Duración del proyecto' },
    { cifra: '00', etiqueta: 'Cuarto indicador' }
  ]
};
