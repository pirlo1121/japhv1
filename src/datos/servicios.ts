/**
 * servicios.ts
 * Los siete servicios de JAPH. Alimentan la órbita de la portada, el carril
 * de /servicios y el <select> del formulario de contacto.
 *
 * IMPORTANTE: cada `id` debe existir en el enum SERVICIOS de
 * server/src/models/Contact.js. Si agregas o renombras un servicio,
 * actualiza ambos lados.
 */

export type IdServicio =
  'web' | 'app-web' | 'app-movil' | 'automatizacion' | 'marketing' | 'video' | 'branding';

export interface Servicio {
  id: IdServicio;
  nombre: string;
  /** Texto de la opción en el formulario de contacto. */
  etiquetaFormulario: string;
  /** Descripción corta: portada. */
  resumen: string;
  /** Descripción larga: página de servicios. */
  descripcion: string;
  incluye: string[];
}

export const servicios: Servicio[] = [
  {
    id: 'web',
    nombre: 'Páginas web',
    etiquetaFormulario: 'Página web',
    resumen:
      'Sitios corporativos, landings y tiendas rápidos de cargar y fáciles de actualizar por tu equipo.',
    descripcion:
      'Sitios corporativos, landings y tiendas. Rápidos de verdad y con contenido que tu equipo puede editar sin ayuda.',
    incluye: [
      'Diseño a medida, sin plantillas',
      'Optimización de carga y rendimiento',
      'SEO técnico y analítica instalada',
      'Panel de contenido para tu equipo'
    ]
  },
  {
    id: 'app-web',
    nombre: 'Aplicaciones web',
    etiquetaFormulario: 'App web',
    resumen:
      'Portales, paneles y herramientas internas que reemplazan hojas de cálculo compartidas.',
    descripcion:
      'Portales de cliente, paneles internos y herramientas que reemplazan el archivo de Excel compartido.',
    incluye: [
      'Autenticación y perfiles de acceso',
      'Integración con tus sistemas actuales',
      'Reportes en tiempo real',
      'Documentación para tu equipo técnico'
    ]
  },
  {
    id: 'app-movil',
    nombre: 'Apps móviles',
    etiquetaFormulario: 'App móvil',
    resumen:
      'Aplicaciones para iOS y Android desde una sola base de código, con medición desde el primer día.',
    descripcion:
      'Una base de código para iOS y Android, publicada en tiendas y preparada para actualizarse sin fricción.',
    incluye: [
      'Prototipo navegable antes de programar',
      'Notificaciones y modo sin conexión',
      'Publicación en App Store y Google Play',
      'Seguimiento de uso desde el primer día'
    ]
  },
  {
    id: 'automatizacion',
    nombre: 'Automatización',
    etiquetaFormulario: 'Automatización',
    resumen:
      'Conectamos las herramientas que ya pagas para que el trabajo repetitivo deje de ocupar horas.',
    descripcion:
      'Unimos correo, CRM, facturación y mensajería para que las tareas repetitivas dejen de consumir horas del equipo.',
    incluye: [
      'Mapa del proceso actual',
      'Flujos automáticos entre herramientas',
      'Alertas cuando algo falla',
      'Atención automatizada en WhatsApp'
    ]
  },
  {
    id: 'marketing',
    nombre: 'Marketing digital',
    etiquetaFormulario: 'Marketing digital',
    resumen:
      'Estrategia, pauta y correo con reportes que se entienden sin necesidad de traducción técnica.',
    descripcion:
      'Pauta, contenido y correo con una pregunta al frente: cuánto cuesta atraer un cliente que se queda.',
    incluye: [
      'Estrategia por canal y por etapa',
      'Gestión de pauta en Meta y Google',
      'Automatización de correo',
      'Reporte mensual con decisiones'
    ]
  },
  {
    id: 'video',
    nombre: 'Producción de video',
    etiquetaFormulario: 'Producción de video',
    resumen:
      'Piezas corporativas, de producto y formatos verticales pensados para el canal donde van a vivir.',
    descripcion:
      'Piezas audiovisuales pensadas desde el formato y el canal donde van a publicarse, no adaptadas después.',
    incluye: [
      'Guion y dirección',
      'Video corporativo y de producto',
      'Formatos verticales para redes',
      'Banco de recursos reutilizables'
    ]
  },
  {
    id: 'branding',
    nombre: 'Branding',
    etiquetaFormulario: 'Branding',
    resumen:
      'Identidad visual, tono de voz y sistema de diseño para que todo lo anterior se vea como una sola marca.',
    descripcion:
      'Identidad visual y verbal, con un sistema de diseño que mantiene coherente todo lo que publiques después.',
    incluye: [
      'Identidad y manual de marca',
      'Tono de voz y mensajes clave',
      'Sistema de diseño reutilizable',
      'Plantillas para el equipo interno'
    ]
  }
];
