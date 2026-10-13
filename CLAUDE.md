# CLAUDE.md

Guía rápida para trabajar en este repo. El detalle de diseño, capas, perillas de ajuste y
validación está en `README.md`: léelo antes de tocar la portada, el guía o la seda.

## Qué es

Front de JAPH (agencia de ecosistemas digitales, Bogotá). Sitio estático con Astro 7 +
TypeScript. Es una copia de `front-japh` (carpeta hermana, con su propio git) en la que se
está explorando la dirección visual "Liquid Technology × The Living Network". El backend
vive en `../server` (todavía no conectado).

**El diseño sigue en evolución.** El usuario itera sección a sección. Ante un cambio de
dirección, revisa "Direcciones probadas y descartadas" y "Pendiente de diseño" en el
README, y actualiza ambas listas cuando algo se pruebe, se descarte o se resuelva.

Cinco capas visuales (detalle en el README):

| Capa             | Código                                                    | Atributo                    |
| ---------------- | --------------------------------------------------------- | --------------------------- |
| Guía (robot)     | `scripts/lienzo/` (`escena`, `escultura`, `sombreador`)   | `data-guia`, `data-rama`    |
| Red viva         | `scripts/lienzo/red.ts`                                   | estado `red`/`orden`        |
| Paneles líquidos | `sombreador.ts` (`pintarPaneles`) + `escena.ts` (`PANEL`) | `data-liquido`              |
| Hilos de seda    | `scripts/seda/` + `components/estructura/Seda.astro`      | `data-seda`, `<Boton seda>` |
| Titulares (gota) | `scripts/lienzo/titular.ts` + `distancias.ts`             | `data-gota`                 |

La historia de la portada: `src/pages/index.astro` (orden de escenas),
`scripts/historia/escenarios.ts` (dónde está el guía en cada una) e `iniciar.ts` (GSAP
ScrollTrigger + Lenis).

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
- Contenido de ejemplo marcado con `ejemplo: true` (muestra `[Ejemplo editable]`). No
  inventar proyectos, clientes, cifras ni testimonios.
- Sin scripts en línea, salvo el de `Base.astro` que decide la clase `movimiento`.
- Estilos: tokens en `src/styles/tokens.css` (azul medianoche; cian, azul y violeta para
  la luz; `--verde` escaso, solo estados activos; una sola fuente, Instrument Sans). Nada
  de colores sueltos: las transparencias usan los canales `-rgb`
  (`rgb(var(--fondo-rgb) / 0.8)`). `--texto-apagado` no llega a AA: solo decorativo.
- Las decisiones visuales van en constantes con nombre (`MUELLE_POSICION`, `PANEL`,
  `TEJIDO`…), no en números sueltos. La tabla "Cómo ajustar el diseño" del README dice
  cuál toca cada cosa; si añades una perilla, añádela ahí.
- Accesibilidad y degradación son requisitos: debe funcionar sin WebGL, sin JS y con
  "reducir movimiento". Cada capa nueva necesita las tres salidas.
- Rendimiento: un solo bucle por lienzo; lecturas del DOM antes que escrituras en cada
  fotograma; nada costoso por fotograma que pueda calcularse una vez. Móvil y escritorio
  son igual de importantes.

## Reglas de las capas

- **Guía:** la pose se calcula en `escultura.ts` y el GLSL deshace exactamente la misma
  cuenta (`alMundo` ↔ `espacioRobot`); cambia las dos a la vez.
- **`data-liquido` y `data-seda`:** sin `transform` ni animaciones de entrada propias en
  esas piezas; su capa se dibuja con su caja y debe coincidir al píxel.
- **`data-seda`:** lo marcado aparece al terminar de tejerse. Úsalo en titulares y
  componentes, no en texto largo. `data-seda-inicio` solo para lo que se ve al cargar.
- **`data-liquido`:** solo en la portada (necesita el lienzo fijo); hasta 4 paneles a la
  vez (`MAX_PANELES`).
- **`data-gota`:** titulares de sección de la portada, sin `data-seda` (las dos capas lo
  ocultarían a la vez) ni `transform` propio. `data-gota="burbuja"` (solo uno, el de la 02) sale de la gota grande y sigue a `titular` en el estado narrativo.

## Verificar

El Chrome headless con SwiftShader pinta el robot en segundos por fotograma: sirve para
capturas y errores, no para juzgar la fluidez. Para medir el resto (seda, red, hilo
principal) desactiva WebGL en la prueba. En desarrollo, `window.__estado` y
`window.__escena` dejan inspeccionar el estado desde la consola.

## Cuidado

- **El póster de la gota** (`src/assets/gota-inicial.webp`) es un fotograma del sombreador:
  si cambias la gota, la luz, `FOCAL` o el escenario inicial, regenéralo con
  `herramientas/poster-de-la-gota.mjs` (instrucciones en el README, "La gota al abrir").
- `dist/` y `.astro/` son generados y están en `.gitignore`: no versionarlos.
- `PUBLIC_API_URL` es opcional (`.env.example`); sin ella se usa `localhost:4000` en dev.
- El formulario de contacto aún no envía: falta conectar `POST /api/contact`.

## Pendiente

- Seguir afinando el diseño (lista en "Pendiente de diseño" del README).
- Sustituir el contenido de ejemplo (proyectos, equipo, precios, contacto, textos legales).
- Conectar el formulario al backend.
- Probar en GPU y móviles reales; medir LCP, INP y CLS.
