// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // El backend autoriza este origen en CLIENT_URL: no cambiarlo sin actualizar server/.env.
  server: { port: 5173 },

  // URLs limpias (/servicios) servidas desde archivos planos (servicios.html).
  trailingSlash: 'never',
  // Las hojas de estilo van dentro del HTML: el sitio es pequeño y así no
  // bloquean la primera pintura con peticiones aparte.
  build: { format: 'file', inlineStylesheets: 'always' },

  // Desde Astro 7 el HTML sigue por defecto las reglas de espacios de JSX, que
  // borran el espacio entre un texto y un enlace escritos en líneas distintas.
  // Este sitio tiene mucho texto corrido (páginas legales, formularios), así
  // que se usa la compresión sin pérdida: quita lo sobrante y conserva los
  // espacios que se ven.
  compressHTML: true,

  env: {
    schema: {
      // Opcional: URL de la API (server/). Se usará al conectar el formulario de contacto.
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public', optional: true })
    }
  },

  // Las fuentes se descargan en el build y se sirven desde el propio dominio.
  // Una sola familia: titulares y texto comparten Instrument Sans (tokens.css).
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Instrument Sans',
      cssVariable: '--fuente-texto',
      weights: [400, 500, 600],
      styles: ['normal'],
      fallbacks: ['sans-serif']
    }
  ]
});
