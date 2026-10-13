# front-japh2

Sitio de JAPH con la dirección visual **The Digital Monolith × Liquid Technology**: un
recorrido cinematográfico por una estructura digital monumental (monolitos de grafito,
aristas de metal, luz contenida) que una cinta de cromo líquido recorre. Es una copia de
`front-japh` en la que se explora el diseño.

> **Estado: diseño en evolución.** Lo que hay funciona y está probado, pero la dirección
> visual se sigue afinando. Antes de cambiar algo, lee "Cómo ajustar el diseño" y
> "Direcciones probadas y descartadas" para no repetir caminos ya recorridos.

```bash
npm install
npm run dev     # http://localhost:5173 (si front-japh ocupa ese puerto: npx astro dev --port 5174)
npm run build   # astro check + build estático en dist/
```

## El concepto

La arquitectura manda; el metal líquido es la materia viva que la recorre; la luz revela;
las conexiones integran. La historia de la portada: **misterio → descubrimiento →
transformación → estructura → conexión → creación → resolución**.

- **Arquitectura (dominante):** monolitos de grafito que absorben casi toda la luz, con
  aristas de metal finas que revelan su escala, un pórtico que se abre, una cámara
  interior, una columnata, puertas, nichos y, al final, todo alineado en un anillo.
- **Metal líquido (contrapunto):** una gota de cromo que flota y, al bajar, se estira en
  una cinta curva. Refleja el estudio de luces y la propia arquitectura.
- **Luz:** cian y azul como acentos (aristas, tiras de luz, reflejos); violeta escaso;
  verde casi nunca (solo el envío correcto del formulario).
- **Red viva:** filamentos finos que crecen a lo largo de la cinta, siempre por debajo de
  la arquitectura.

## Las capas visuales

| Capa             | Qué es                                                                                     | Dónde                                         |
| ---------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **Arquitectura** | Monolitos, losas, tiras de luz y marcos con hueco (WebGL2, intersección analítica).        | `lienzo/arquitectura.ts`, `sombreador.ts`     |
| **Escultura**    | Gota de cromo que se estira en una cinta (dos Bézier), por _raymarching_ en su esfera.     | `lienzo/escultura.ts`, `sombreador.ts`        |
| **Red viva**     | Filamentos, nodos y energía (Canvas 2D) proyectados con la misma cámara.                   | `lienzo/red.ts`                               |
| **Interfaz**     | Grafito, aristas de metal, placas de metal claro para la acción principal, rótulos de luz. | `styles/tokens.css`, `styles/base.css`, comp. |

Arquitectura, escultura y red comparten un solo bucle y una sola cámara (`escena.ts`) en un
lienzo fijo detrás de la portada. Las páginas interiores no cargan WebGL: su encabezado
(`PortadaDePagina.astro`) es una composición quieta de monolitos en CSS con el póster de la
gota delante.

## La historia (portada)

Cada escena cambia mientras entra en pantalla y se queda quieta mientras se lee. Ninguna
queda fija: el scroll siempre baja la página.

| Escena               | Componente       | Cámara y arquitectura                                                         | Escultura y red                       |
| -------------------- | ---------------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| 01 El vacío          | `Vacio`          | Plano general: un monolito en esquina emerge de la oscuridad al cargar.       | La gota flota delante; red dormida    |
| 02 La transformación | `Transformacion` | Acercamiento: el monolito se abre en un pórtico con luz dentro.               | La gota se estira en cinta y lo cruza |
| 03 La red viva       | `RedViva`        | Apertura lateral: losas a distintas profundidades, tiras de luz.              | La red crece desde la cinta           |
| 04 El núcleo         | `Nucleo`         | Avance hacia una cámara interior: un marco profundo iluminado desde dentro.   | La cinta entra en ella                |
| 05 Servicios         | `Servicios`      | Una columnata de siete losas; la del servicio activo recoge luz cian.         | Su rama de la red se enciende         |
| 06 El proceso        | `Proceso`        | Cuatro puertas en un camino que se adentra; se enciende la de la fase actual. | Camino SVG con cuatro umbrales        |
| 07 Proyectos         | `Proyectos`      | Una galería: tres nichos en un muro oscuro.                                   | La red empieza a ordenarse            |
| 08 Ecosistema        | `Ecosistema`     | Plano amplio: todas las piezas alineadas en un anillo, unidas por luz.        | La cinta en anillo; red completa      |
| 09 Hagámoslo real    | `Llamada`        | Un último pórtico; una línea de luz en el suelo lleva a la llamada.           | En calma                              |

## Cómo ajustar el diseño

Las decisiones visuales están en constantes con nombre, no repartidas por el código:

| Quiero cambiar…                                | Dónde                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Colores, degradados, tipografía, espacios      | `styles/tokens.css` (nunca colores sueltos fuera de ahí)                             |
| Dónde está cada monolito en cada escena        | `PLANOS` en `lienzo/arquitectura.ts` (un plano por escena, en el marco de su cámara) |
| Un monolito que se abre                        | `monolito()` en `arquitectura.ts` (dos mitades y su `abertura`)                      |
| Trazado de la cinta en cada escena             | `cinta` de cada plano; tamaño y puntas: `CINTA` en `arquitectura.ts`                 |
| Cómo flota y ondula el líquido                 | `FLOTACION`, `ONDULACION` en `lienzo/escultura.ts`                                   |
| Cámara de cada escena (encuadre, objetivo)     | `crearEscenarios` en `historia/escenarios.ts`; móvil: `vertical()`, `ALTO_VERTICAL`  |
| Qué tramo de scroll lleva de una escena a otra | `crearTramos` en `escenarios.ts`; inercia del scroll: `INERCIA` en `iniciar.ts`      |
| Material del grafito, aristas, niebla          | `GRAFITO`, `GRAFITO_LUZ`, `METAL`, `sombrearPieza` y `main` en `sombreador.ts`       |
| Luz y reflejos del cromo                       | `estudio()` y `cromo()` en `sombreador.ts`                                           |
| Cómo emerge la arquitectura al cargar          | `REVELADO` en `lienzo/escena.ts`                                                     |
| Cuánta red hay, cómo crece y cuánto pesa       | `CANTIDADES`, `generar()` y `PRESENCIA` en `lienzo/red.ts`                           |
| Módulos de servicios y puertas del proceso     | `MODULOS_DE_SERVICIOS`, `PUERTAS` en `arquitectura.ts`                               |
| Dónde y cómo se ve la gota al abrir            | `Lienzo.astro` (póster); regenerarlo: `herramientas/poster-de-la-gota.mjs`           |
| Encabezado de las páginas interiores           | `components/estructura/PortadaDePagina.astro`                                        |
| Calidad en equipos lentos                      | `calidad.ts` (topes de píxeles, umbrales); lienzo de la red: `TOPE_PIXELES_RED`      |

Para ver el estado sin hacer scroll, en desarrollo están `window.__estado` (estado
narrativo) y `window.__escena` (escena) en la consola.

## Las capas en detalle

### La gota al abrir

La gota se ve real desde el primer instante, antes de que WebGL compile (de 1 a varios
segundos en móviles). `Lienzo.astro` muestra su **póster** (`assets/gota-inicial.webp`, el
primer fotograma del mismo sombreador, en AVIF/WebP de pocos KB) en el sitio y al tamaño
exactos en que lo pintará WebGL, sobre un fondo CSS que reproduce el del sombreador (halo
azul y resto violeta). La cuenta es la de la cámara: el centro de la gota cae en el
desplazamiento del escenario inicial y una unidad mide `FOCAL / distancia · alto / 2` (en
pantallas más estrechas que `ASPECTO_MINIMO`, según el ancho: allí el campo de visión se
abre, no se aleja la cámara). El CSS recibe esas constantes del TypeScript
(`define:vars`). WebGL arranca en ese mismo fotograma (fase 0, sin giro de cámara, con la
arquitectura aún en la oscuridad) y, medio segundo después, el monolito emerge de la
oscuridad (`REVELADO`). Sin JavaScript o sin WebGL, el póster es la gota de respaldo.

**Si cambias la gota, la luz del cromo, el fondo, `FOCAL` o el escenario inicial**, vuelve a
renderizar el póster:
`npm i --no-save playwright-core && node herramientas/poster-de-la-gota.mjs` con
`npm run dev` en marcha.

### Arquitectura

- **Piezas:** un juego fijo de 14 ranuras (`RANURAS`): dos mitades de monolito, dintel,
  losa, dos piezas lejanas, fondo, dos tiras de luz, cuatro marcos con hueco y una columna.
  Cada plano dice dónde está cada una (centro, semiejes, giro), cuánto se ve (`presencia`),
  cuánta luz recogen sus aristas, su luz interior y lo pulida que es. Las que un plano no
  nombra se quedan donde las dejó el plano vecino, fundidas en la oscuridad.
- **Un solo número:** el scroll anima `estado.escena` (0..8) y `arquitectura()` interpola
  las piezas entre los dos planos vecinos. Es determinista y reversible.
- **Sombreado:** intersección analítica rayo-caja (y marco con túnel), sin marchar rayos:
  bordes exactos y coste fijo por pieza. Grafito modelado por una luz principal con caída
  y un degradado cenital; aristas de metal de grosor constante en píxeles; cromo negro en
  las piezas pulidas; perspectiva atmosférica. Las tiras de luz son halo, no geometría.
- **Interacción:** el módulo del servicio activo y la puerta de la fase del proceso
  recogen luz cian (`foco`, `etapa`).
- **Móvil:** las piezas secundarias no se envían (`ligera`).

### Escultura

La gota es la misma función de distancia que pinta el póster. La cinta son dos Bézier
cuadráticas con grosor variable unidas con unión suave; la gota adelgaza mientras la cinta
crece desde su centro (`forma`, ligada al scroll del vacío a la transformación). Flota,
ondula y su trazado cambia por escena. Es cromo: refleja un estudio procedural y, con un
segundo rayo analítico, la arquitectura que tiene alrededor (sus caras, aristas y tiras de
luz). Se marcha solo dentro de una esfera límite que calcula la página.

### Red viva

Determinista: se genera con una semilla fija y crece según `red` y `orden`, así que al
subir se repliega igual que creció. Sus siete ramas nacen de la superficie de la gota y,
cuando se estira, a lo largo de la cinta. Pocas partículas (12, 8 o 5 según la pantalla).
Se borra detrás de `[data-zona-lectura]` y su presencia está limitada (`PRESENCIA`).

### Interfaz

Grafito, esquinas casi rectas (`--radio: 2px`), aristas de metal de 1 px y la luz solo
donde guía la mirada: el canto superior de una placa al pasar o enfocarla, el enlace
activo, el servicio activo. La acción principal es una placa de metal claro con texto
negro; la secundaria, un contorno sobre grafito. Los énfasis de los titulares son de
cromo (`--cromo`); el del titular principal recoge luz cian (`--cromo-luz`). La marca es un
monolito en miniatura con su gota.

## Arquitectura del código

- **Una sola escena** (`escena.ts`) para arquitectura, escultura y red. WebGL se pinta en
  un worker con OffscreenCanvas (`pintor.ts`, `trabajador.ts`); la red, en Canvas 2D con la
  misma cámara (`camara.ts`).
- **Estado narrativo** (`narrativa.ts`): cámara (órbita alrededor de un objetivo),
  desplazamiento en pantalla, flujo, atenuación, `red`, `orden`, `forma` y `escena`, más
  `foco` (servicio activo) y `etapa` (fase del proceso). `escenarios.ts` es el storyboard;
  `iniciar.ts` lo anima con GSAP ScrollTrigger (`scrub`, reversible) y Lenis con ratón o
  trackpad. Es el único que escribe la cámara y la arquitectura.
- **Fase integrada:** el tiempo interno del líquido se integra con su velocidad (`uFase`),
  así que cambiar de escena no hace saltar la forma.
- **El texto manda:** `[data-zona-lectura]` baja los brillos de la escultura, apaga las
  aristas detrás del texto y borra la red.

## Rendimiento

- **Arquitectura:** coste fijo y bajo por pieza (sin marchar rayos); hasta 14 piezas, menos
  en móvil.
- **Escultura:** marcha solo dentro de su esfera límite y antes de la arquitectura.
- **Bucle:** uno solo; a media frecuencia con la escena atenuada; se pausa fuera de
  pantalla o con la pestaña oculta.
- **Calidad adaptativa** (`calidad.ts`): con tres fotogramas seguidos de más de 50 ms baja
  al momento (primero el detalle, luego la resolución). Nunca vuelve a subir.
- **Lienzo de la red:** tope de densidad y de píxeles (`TOPE_PIXELES_RED`).
- **Páginas interiores:** sin WebGL ni bucle: CSS y una imagen de pocos KB.
- **Build:** unos 80 KB de JS comprimido (la mayor parte es GSAP); Lenis se descarga bajo
  demanda.

## Degradación y accesibilidad

- **Sin WebGL:** el póster de la gota se coloca donde estaría la escultura y la red sigue
  viva. Sin JavaScript también se ve el póster y el documento completo.
- **"Reducir movimiento":** sin tramos ni animaciones de entrada; la escena cambia de
  estado por saltos al cruzar cada escena; nada de contenido oculto.
- **Servicios:** se activan con el puntero, con el foco del teclado o al cruzar el centro de
  la pantalla. Nada depende del hover.
- **Contraste sobre `--fondo`:** texto 18.4:1, texto secundario 8.8:1, metadatos 4.7:1.

## Validación

Probado con Chrome headless (Playwright) sobre el build de producción, a 1440×900 y a
390×844 táctil. La portada, con WebGL por software (SwiftShader) y sin WebGL.

- `astro check`, `prettier --check` y `astro build` sin errores.
- Portada sin WebGL: recorrido completo abajo y arriba sin errores; el índice de escenas
  marca la actual y salta a cada escena; el póster queda como respaldo.
- "Reducir movimiento": ningún paso ni titular oculto. Sin JavaScript: las 9 escenas y el
  póster.
- Proyectos: los seis filtros (y `aria-pressed`). Contacto: al enviar vacío, cinco errores
  con texto, `aria-invalid`, foco en el primero y un aviso general.
- Enlaces de cabecera y pie: todas las rutas responden. Teclado: "Saltar al contenido" es
  el primer Tab; el foco activa los servicios.
- El primer fotograma de WebGL coincide en sitio y tamaño con el póster.

**No medido todavía:** fluidez con GPU real (SwiftShader pinta en segundos por fotograma),
LCP, INP y CLS, ni móviles o tablets reales.

## Direcciones probadas y descartadas

Para no volver a recorrerlas sin motivo:

- **Liquid Technology × The Living Network** (todo el diseño anterior): un robot de metal
  líquido que guiaba la página y señalaba con el brazo, hilos de seda que tejían titulares
  y botones, titulares que nacían de gotas, paneles que llegaban como metal líquido y una
  tarjeta que seguía al cursor. Sustituido entero por The Digital Monolith (está en el
  historial de git, commit `00b8d63`).
- **Escenas fijas** (CSS sticky que se quedaban en pantalla mientras el scroll cambiaba la
  cámara o el texto sin bajar la página): se sentía lento, como si el scroll se trabara.
- **Cinta con puntas de colmillo** (grosor que se afina a cero): se lee como un cuerno; las
  puntas tienen un grosor mínimo (`CINTA.puntaMinima`).
- **Siete módulos de servicios como barras de distinta altura sobre una misma base**: se
  leía como un gráfico de barras. Ahora es una columnata de losas altas a dos
  profundidades.
- **Una escena WebGL completa en el encabezado de cada página interior**: cara y
  repetitiva; ahora es una composición CSS con el póster.
- **Siete gotas-neurona unidas por sinapsis de luz** en el héroe: se revirtió.

## Pendiente de diseño

- Probar en GPU, tablets y móviles reales; medir LCP, INP y CLS y ajustar `calidad.ts`, los
  topes de píxeles y el número de piezas si hace falta.
- Afinar los encuadres de cada escena con el texto real encima en más proporciones
  (tablet vertical, móvil apaisado, ultrapanorámico).
- Afinar el reflejo de la arquitectura en la cinta (hoy un rayo sin difuminado) y, si el
  rendimiento lo permite, sombras de contacto suaves de la cinta sobre las piezas cercanas.
- Imágenes reales de proyectos (hoy, vistas provisionales de la arquitectura).

## Convenciones para la capa visual

- Cada escena de la portada es una `<section>` con `id` propio y `data-escena`: son los
  anclajes del scrollytelling y del índice `Recorrido`.
- Los textos que aparecen por pasos llevan `data-paso` y un umbral `--u`; el CSS lee el
  progreso de su escena (`--p`). Sin JavaScript se ven enteros.
- Los bloques de texto que la escena debe respetar llevan `data-zona-lectura`.
- Las piezas `ejemplo: true` en `src/datos/` y `config/sitio.ts` muestran un aviso;
  desaparecen al poner contenido real. Ningún proyecto, cliente, precio ni cifra es
  inventado.
- El formulario de contacto tiene el marcado y la validación completos, pero aún no envía:
  falta conectar `POST /api/contact` (ver `../server`).
