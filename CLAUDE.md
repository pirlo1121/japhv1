# CLAUDE.md

Guía rápida para trabajar en este repo. El detalle de diseño, capas, perillas de ajuste y
validación está en `README.md`: léelo antes de tocar la portada, la arquitectura o la
escultura.

## Qué es

Front de JAPH (agencia de ecosistemas digitales, Bogotá). Sitio estático con Astro 7 +
TypeScript. Es una copia de `front-japh` (carpeta hermana, con su propio git) en la que se
está explorando la dirección visual "Monumental Architecture + Editorial Storytelling":
seis capítulos en los que una arquitectura de monolitos de grafito (dominante) se
transforma y una gota de cromo (la intención, secundaria) toma forma y la cruza. Un
protagonista visual por capítulo; luz blanca y plateada con una firma azul en los detalles
(sistema cromático en `tokens.css` y en el README, "Sistema cromático"). El
backend vive en `../server` (todavía no conectado).

**El diseño sigue en evolución.** El usuario itera sección a sección. Ante un cambio de
dirección, revisa "Direcciones probadas y descartadas" y "Pendiente de diseño" en el
README, y actualiza ambas listas cuando algo se pruebe, se descarte o se resuelva.

Capas visuales (detalle en el README):

| Capa         | Código                                                     | Lo mueve                                 |
| ------------ | ---------------------------------------------------------- | ---------------------------------------- |
| Arquitectura | `scripts/lienzo/arquitectura.ts` (`PLANOS`) + `sombreador` | `estado.escena`, `foco`, `etapa`         |
| Escultura    | `scripts/lienzo/escultura.ts` + `sombreador`               | `estado.forma` (gota → curva)            |
| Interfaz     | `styles/tokens.css`, `styles/base.css`, componentes        | `data-zona-lectura`, `data-paso` (`--p`) |

Las dos primeras comparten un bucle y una cámara (`escena.ts`, `camara.ts`) en el lienzo
fijo de la portada. Las páginas interiores no cargan WebGL (`PortadaDePagina.astro`).

La historia de la portada: `src/pages/index.astro` (orden de los seis capítulos:
Presencia, Transformación, Capacidades, Método, Evidencia, Apertura),
`scripts/historia/escenarios.ts` (cámara y plano de cada capítulo) e `iniciar.ts` (GSAP
ScrollTrigger + Lenis, el único que escribe el estado narrativo).

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
- Estilos: tokens en `src/styles/tokens.css` (negro, grafito, plata y la identidad azul:
  `--azul` para estados, foco e indicadores, `--azul-electrico` solo en el CTA principal,
  `--cian` solo como luz y nunca como texto, `--azul-hondo` para sombras; el azul es el
  5–10 % de lo que se ve, nunca fondo dominante ni neón permanente; `--verde` solo para el
  envío correcto; una sola fuente, Instrument Sans). Nada de colores sueltos: las
  transparencias usan los canales `-rgb` (`rgb(var(--fondo-rgb) / 0.8)`).
  `--texto-apagado` no llega a AA: solo decorativo.
- Las decisiones visuales van en constantes con nombre (`MUELLE_POSICION`, `PANEL`,
  `TEJIDO`…), no en números sueltos. La tabla "Cómo ajustar el diseño" del README dice
  cuál toca cada cosa; si añades una perilla, añádela ahí.
- Accesibilidad y degradación son requisitos: debe funcionar sin WebGL, sin JS y con
  "reducir movimiento". Cada capa nueva necesita las tres salidas.
- Narrativa: un protagonista visual por capítulo y nada que aparezca sin causa. Antes de
  crear una pieza o un efecto, reutiliza o transforma uno existente. Nada de partículas
  decorativas.
- Móvil es una presentación propia, no un recorte: la escena solo ocupa pantalla donde es
  protagonista; en los capítulos de lectura queda detrás, apagada y en reposo.
- Rendimiento: un solo bucle por lienzo; lecturas del DOM antes que escrituras en cada
  fotograma; nada costoso por fotograma que pueda calcularse una vez. Móvil y escritorio
  son igual de importantes.

## Reglas de las capas

- **Cámara:** `camara.ts` y la función `rayo` del GLSL hacen la misma cuenta (incluido el
  zoom en pantallas estrechas); cambia las dos a la vez.
- **Arquitectura:** las piezas son ranuras fijas (`RANURAS`); un plano solo dice dónde está
  cada una. Para añadir una pieza, añade su ranura (hasta `MAX_CAJAS`). Se escriben en el
  marco de la cámara de su capítulo, y el objetivo de la cámara también (`objetivo()` en
  `escenarios.ts`). Nada de marchar rayos para la arquitectura: es intersección analítica.
- **Escultura:** la gota del sombreador (`gota`) es la del póster; si la cambias,
  regenera el póster.
- **Una sola fuente del estado:** solo los tramos de `iniciar.ts` animan la cámara y la
  arquitectura; `proceso.ts` y `servicios.ts` solo ponen `etapa` y `foco`.
- Ninguna escena se queda fija (sticky): el scroll siempre baja la página.

## Verificar

El Chrome headless con SwiftShader pinta la escena en segundos por fotograma: sirve para
capturas y errores, no para juzgar la fluidez (las capturas pueden pillar una transición a
medias). Para probar sin WebGL, anula `getContext('webgl2')` y
`transferControlToOffscreen` con un script de inicio: el flag `--disable-webgl` no basta.
En desarrollo, `window.__estado` y `window.__escena` dejan inspeccionar el estado desde la
consola.

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
