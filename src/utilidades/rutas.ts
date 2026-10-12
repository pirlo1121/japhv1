/**
 * rutas.ts
 * Utilidades de rutas que se resuelven en el servidor (build).
 */

/** Normaliza "/servicios", "/servicios/" y "/servicios.html" a "/servicios". */
function normalizar(ruta: string): string {
  const limpia = ruta
    .replace(/\.html$/, '')
    .replace(/\/index$/, '/')
    .replace(/(.)\/$/, '$1');
  return limpia || '/';
}

/** ¿El enlace apunta a la página que se está generando? */
export function esPaginaActual(href: string, rutaActual: string): boolean {
  return normalizar(href) === normalizar(rutaActual);
}
