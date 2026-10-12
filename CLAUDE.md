# CLAUDE.md

Guía rápida para trabajar en este repo. El detalle de diseño, escenas y rendimiento está en
`README.md`: léelo antes de tocar la portada o la escultura.

## Qué es

Front de JAPH (agencia de ecosistemas digitales, Bogotá). Sitio estático con Astro 7 +
TypeScript. Dirección visual "Liquid Technology × The Living Network": un guía de metal
líquido (un robot que nace de una gota, en un shader WebGL2 propio) recorre la página y
señala el contenido; de su cuerpo nace una red viva en Canvas 2D proyectada con la misma
cámara (`src/scripts/lienzo/`). GSAP y Lenis animan la historia (`src/scripts/historia/`).
El backend vive en `../server` (todavía no conectado). Esta carpeta (`front-japh2`) es una
copia de `front-japh` con el robot del original llevado a este diseño.

## Comandos

```bash
npm run dev           # http://localhost:5173 (puerto fijo: el backend lo autoriza en CLIENT_URL)
                      # si front-japh ya ocupa el 5173: npx astro dev --port 5174
npm run build         # astro check + build estático en dist/
npm run check         # solo tipos
npm run format        # prettier (comillas simples, sin coma final, 100 columnas)
```

Antes de dar algo por terminado: `npm run check` y `npm run format:check` sin errores.

## Convenciones

- **Todo en español**: nombres de archivos, componentes, variables, funciones, comentarios
  y textos (`PortadaDePagina`, `esPaginaActual`, `datos/`, `utilidades/`). Mantenerlo así.
- Cada archivo empieza con un comentario de cabecera que explica qué es y por qué.
- Alias `@/` → `src/` en los imports.
- El texto editable vive en `src/datos/` y `src/config/sitio.ts`, no en los componentes.
  Correo, teléfono y redes solo en `sitio.ts`.
- Contenido de ejemplo marcado con `ejemplo: true` (muestra `[Ejemplo editable]`).
- Sin scripts en línea, salvo el de `Base.astro` que decide la clase `movimiento`.
- Estilos: tokens en `src/styles/tokens.css` (azul medianoche, cian, azul, violeta; el
  verde `--verde` es escaso: solo estados activos; una sola fuente, Instrument Sans). No
  introducir colores sueltos fuera de los tokens: las transparencias usan los canales
  `-rgb` (`rgb(var(--fondo-rgb) / 0.8)`). `--texto-apagado` no llega a AA: solo decorativo.
- Accesibilidad y degradación son requisitos: debe funcionar sin WebGL, sin JS y con
  "reducir movimiento" (ver sección Validación del README).
- La portada: cada escena es una `<section>` con `id` y `data-escena`; el orden de
  `src/pages/index.astro` es el orden de la historia. Las formas de cada escena están en
  `scripts/historia/escenarios.ts`; la pose del robot y las anclas de la red, en
  `lienzo/escultura.ts` (compartidas con el shader vía uniforms). El guía señala lo
  marcado con `data-guia` (o el servicio con `data-activa`).

## Cuidado

- `dist/` y `.astro/` son generados y están en `.gitignore`: no versionarlos.
- `PUBLIC_API_URL` es opcional (`.env.example`); sin ella se usa `localhost:4000` en dev.
- El formulario de contacto aún no envía: falta conectar `POST /api/contact`.

## Pendiente

- Sustituir el contenido de ejemplo (proyectos, equipo, precios, contacto, textos legales).
- Conectar el formulario al backend.
- Probar en móviles reales.
