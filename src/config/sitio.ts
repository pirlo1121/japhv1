/**
 * sitio.ts
 * Datos globales del sitio: identidad, navegación y canales de contacto.
 * Es el único lugar donde viven el correo, el teléfono y las redes.
 */

export interface Enlace {
  etiqueta: string;
  href: string;
}

export const sitio = {
  nombre: 'JAPH',
  lema: 'Convertimos ideas en ecosistemas digitales',
  descripcion:
    'JAPH diseña y construye ecosistemas digitales: páginas web, apps web y móviles, automatización, marketing digital, producción de video y branding.',
  resumen:
    'Agencia de ecosistemas digitales. Convertimos ideas en sistemas que funcionan: web, aplicaciones, automatización, marketing, video y marca.',
  ciudad: 'Bogotá, Colombia',
  colorTema: '#050505'
} as const;

/** Navegación principal: cabecera, menú móvil y pie de página. */
export const navegacion: Enlace[] = [
  { etiqueta: 'Inicio', href: '/' },
  { etiqueta: 'Servicios', href: '/servicios' },
  { etiqueta: 'Proyectos', href: '/proyectos' },
  { etiqueta: 'Nosotros', href: '/nosotros' },
  { etiqueta: 'Contacto', href: '/contacto' }
];

export const enlacesLegales: Enlace[] = [
  { etiqueta: 'Privacidad', href: '/privacidad' },
  { etiqueta: 'Términos', href: '/terminos' }
];

/**
 * EJEMPLO: correo, WhatsApp y redes son marcadores de posición.
 * Reemplázalos por los datos reales de JAPH antes de publicar y cambia
 * `ejemplo` a false para retirar los avisos del sitio.
 */
export const contacto = {
  ejemplo: true,
  correo: 'hola@japh.studio',
  correoDatos: 'datos@japh.studio',
  correoLegal: 'legal@japh.studio',
  whatsapp: { etiqueta: '+57 300 000 0000', href: 'https://wa.me/573000000000' },
  redes: [
    { etiqueta: 'Instagram', href: 'https://instagram.com' },
    { etiqueta: 'LinkedIn', href: 'https://linkedin.com' }
  ] satisfies Enlace[]
};
