/**
 * nosotros.ts
 * Principios, línea de tiempo y equipo de la página "Nosotros".
 * EJEMPLO: los hitos y los perfiles son marcadores de posición.
 */

export interface Principio {
  titulo: string;
  descripcion: string;
}

export const principios: Principio[] = [
  {
    titulo: 'Nada se entrega sin medir',
    descripcion:
      'Un rediseño atractivo que no mueve ningún indicador es decoración cara. Antes de empezar definimos qué debería cambiar y cómo vamos a comprobarlo.'
  },
  {
    titulo: 'El código es del cliente',
    descripcion:
      'Repositorios, dominios y cuentas quedan a tu nombre desde el primer día. Si algún día dejas de necesitarnos, no queremos ser un obstáculo.'
  },
  {
    titulo: 'Menos herramientas, mejor conectadas',
    descripcion:
      'La mayoría de empresas no necesita otra plataforma: necesita que las que ya paga se comuniquen entre sí. Siempre empezamos por ahí.'
  },
  {
    titulo: 'La velocidad es accesibilidad',
    descripcion:
      'Un sitio pesado deja fuera a quien tiene mala señal o un teléfono antiguo. Optimizar la carga no es un lujo técnico, es alcance real.'
  }
];

export interface Hito {
  cuando: string;
  titulo: string;
  descripcion: string;
}

export const hitosEjemplo = true;

export const hitos: Hito[] = [
  {
    cuando: 'Año uno',
    titulo: 'Título del primer hito',
    descripcion: 'Describe cómo empezó el estudio: quiénes lo fundaron y con qué tipo de trabajo.'
  },
  {
    cuando: 'Año dos',
    titulo: 'Título del segundo hito',
    descripcion:
      'Un momento de cambio: el primer cliente grande, un producto propio o una nueva línea de servicio.'
  },
  {
    cuando: 'Año tres',
    titulo: 'Título del tercer hito',
    descripcion:
      'La incorporación de una capacidad nueva, como producción audiovisual o automatización.'
  },
  {
    cuando: 'Hoy',
    titulo: 'Dónde estamos ahora',
    descripcion: 'Tamaño actual del equipo, tipo de proyectos y hacia dónde quiere crecer JAPH.'
  }
];

export interface Persona {
  nombre: string;
  rol: string;
  ejemplo: boolean;
}

export const equipo: Persona[] = [
  {
    nombre: 'Nombre y apellido',
    rol: 'Dirección y arquitectura de producto. Describe aquí su rol en los proyectos.',
    ejemplo: true
  },
  {
    nombre: 'Nombre y apellido',
    rol: 'Diseño de interfaces e identidad visual. Añade su especialidad principal.',
    ejemplo: true
  },
  {
    nombre: 'Nombre y apellido',
    rol: 'Desarrollo y automatización. Indica las tecnologías con las que trabaja.',
    ejemplo: true
  }
];
