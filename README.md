# front-japh2

Sitio de JAPH con la dirección visual **Monumental Architecture + Editorial Storytelling**:
una intención adquiere forma, esa forma encuentra estructura y la estructura revela un
sistema de capacidades y resultados. La arquitectura de monolitos de grafito es el
lenguaje dominante; una gota de cromo (la intención) es el elemento secundario. Es una
copia de `front-japh` en la que se explora el diseño.

> **Estado: diseño en evolución.** Lo que hay funciona y está probado, pero la dirección
> visual se sigue afinando. Antes de cambiar algo, lee "Cómo ajustar el diseño" y
> "Direcciones probadas y descartadas" para no repetir caminos ya recorridos.

```bash
npm install
npm run dev     # http://localhost:5173 (si front-japh ocupa ese puerto: npx astro dev --port 5174)
npm run build   # astro check + build estático en dist/
```

## El concepto

Una experiencia oscura, precisa y monumental, diseñada por una misma marca: no una
colección de demos 3D. Reglas que se aplican en todo el sitio:

- **Un protagonista visual por capítulo.** La arquitectura define el espacio; la gota solo
  aparece donde cuenta algo (la intención que toma forma, el proyecto que cruza las fases).
- **Nada aparece sin causa.** Cada capítulo reutiliza y transforma las piezas del anterior:
  el monolito se abre en pórtico, sus piezas forman la columnata, las puertas del método se
  vuelven los nichos de la galería y el pórtico del principio vuelve al final.
- **El texto manda.** Titular, CTA y navegación se ven desde la primera pintura; ningún
  texto queda oculto esperando una animación.
- **Luz:** blanca y plateada. Un solo acento de color, un azul frío (`--frio`), muy puntual:
  el servicio activo, la fase actual, el foco del teclado, el enlace actual. Nada de neón
  permanente. El verde, solo en el envío correcto del formulario.
- **Paleta:** negro profundo, grafito, plata y blanco suave (`tokens.css`).

## Las capas visuales

| Capa             | Qué es                                                                                 | Dónde                                         |
| ---------------- | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Arquitectura** | Monolitos, losas, tiras de luz y marcos con hueco (WebGL2, intersección analítica).    | `lienzo/arquitectura.ts`, `sombreador.ts`     |
| **Escultura**    | Gota de cromo que se estira en una curva (dos Bézier), por _raymarching_ en su esfera. | `lienzo/escultura.ts`, `sombreador.ts`        |
| **Interfaz**     | Grafito, aristas de metal, placas de metal claro para la acción principal.             | `styles/tokens.css`, `styles/base.css`, comp. |

Arquitectura y escultura comparten un solo bucle y una sola cámara (`escena.ts`) en un
lienzo fijo detrás de la portada. Las páginas interiores no cargan WebGL: su encabezado
(`PortadaDePagina.astro`) es una composición quieta de monolitos en CSS (`.monolito-css`)
con el póster de la gota delante.

## La historia (portada)

Seis capítulos. Cada uno tiene una composición estable: la escena cambia en un tramo corto
mientras el capítulo entra en pantalla y se queda quieta mientras se lee. Ninguno queda
fijo: el scroll siempre baja la página, y al subir todo se deshace igual.

| Capítulo          | Componente       | `id`                   | Arquitectura (plano)                                              | Gota                                   |
| ----------------- | ---------------- | ---------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| 01 Presencia      | `Presencia`      | `inicio`               | Un monolito en esquina emerge de la penumbra. Titular y CTA.      | Flota delante                          |
| 02 Transformación | `Transformacion` | `transformacion`       | El monolito se abre en pórtico, con una luz al fondo.             | Se estira en curva y cruza la abertura |
| 03 Capacidades    | `Capacidades`    | `servicios`            | Columnata de siete losas; la del servicio activo recoge luz fría. | Baja, conecta la base de la columnata  |
| 04 Método         | `Metodo`         | `proceso`              | Cuatro puertas en un camino; se enciende la de la fase actual.    | Las cruza en orden (el proyecto)       |
| 05 Evidencia      | `Evidencia`      | `proyectos-destacados` | Las puertas se vuelven los nichos de una galería.                 | Atenuada: hablan los proyectos         |
| 06 Apertura       | `Apertura`       | `llamada`              | El pórtico del capítulo 02 se recompone, de frente y en calma.    | Lo vuelve a cruzar, despacio           |

El contenido de las antiguas escenas "Red viva", "Núcleo" y "Ecosistema" no se perdió: la
idea de productos, datos y procesos conectados abre Capacidades; los principios de trabajo
reales (`datos/nosotros.ts`) van en Método ("Lo que no cambia en ninguna fase"); la lista
de servicios del Ecosistema ya estaba en Capacidades. Evidencia enlaza a `/nosotros`.

## Móvil: una presentación propia

En pantallas verticales o estrechas (proporción menor que `ASPECTO_VERTICAL` o menos de
48rem):

- La escena ocupa la mitad de arriba **solo** donde es protagonista (Presencia,
  Transformación, Apertura). En Capacidades, Método y Evidencia el texto empieza arriba y la
  escena queda detrás, apagada (`ATENUACION_DE_LECTURA`) y quieta: la escena entra en
  **reposo** y deja de pintar mientras no cambia nada (`REPOSO` en `escena.ts`).
- Las piezas secundarias no se envían, salvo las que tienen función en su capítulo: siete
  servicios son siete losas y cuatro fases son cuatro puertas, también en móvil.
- Método es una lista vertical hasta `ANCHO_FASES_EN_FILA` (60rem): la fila de cuatro
  columnas se apretaba en tablet vertical.
- Móvil apaisado y pantallas bajas: el titular se mide por el alto (`11svh`) y se reducen
  los márgenes para que titular, entrada y CTA quepan en la primera pantalla.

## Cómo ajustar el diseño

Las decisiones visuales están en constantes con nombre, no repartidas por el código:

| Quiero cambiar…                                      | Dónde                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Colores, degradados, tipografía, espacios            | `styles/tokens.css` (nunca colores sueltos fuera de ahí)                                                     |
| Dónde está cada pieza en cada capítulo               | `PLANOS` en `lienzo/arquitectura.ts` (un plano por capítulo, en el marco de su cámara)                       |
| Un monolito que se abre                              | `monolito()` en `arquitectura.ts` (dos mitades y su `abertura`)                                              |
| Trazado de la curva en cada capítulo                 | `cinta` de cada plano; tamaño y puntas: `CINTA` en `arquitectura.ts`                                         |
| Cómo flota y ondula el líquido                       | `FLOTACION`, `ONDULACION` en `lienzo/escultura.ts`                                                           |
| Cámara de cada capítulo (encuadre, objetivo)         | `crearEscenarios` en `historia/escenarios.ts`; el objetivo se escribe con `objetivo()` en el marco del plano |
| Móvil: dónde va la escena y cuánto se apaga          | `vertical()`, `ALTO_VERTICAL`, `ATENUACION_DE_LECTURA` en `escenarios.ts`                                    |
| Qué tramo de scroll lleva de un capítulo a otro      | `crearTramos` en `escenarios.ts`; inercia del scroll: `INERCIA` en `iniciar.ts`                              |
| Material del grafito, aristas, niebla                | `GRAFITO`, `GRAFITO_LUZ`, `METAL`, `sombrearPieza` y `main` en `sombreador.ts`                               |
| Luz de la arquitectura y acento frío                 | `PLATA`, `FRIO` en `sombreador.ts`; cuánto de una pieza es frío: `frio` en `arquitectura()`                  |
| Luz y reflejos del cromo                             | `estudio()` y `cromo()` en `sombreador.ts`                                                                   |
| Cómo emerge la arquitectura al cargar                | `REVELADO` en `lienzo/escena.ts`                                                                             |
| Cuándo deja de pintar la escena (reposo)             | `REPOSO` en `escena.ts`                                                                                      |
| Módulos de servicios y puertas del método            | `MODULOS_DE_SERVICIOS`, `PUERTAS` en `arquitectura.ts`                                                       |
| Fases en fila o en lista                             | `ANCHO_FASES_EN_FILA` en `iniciar.ts`; tramo del camino: `CAMINO` en `historia/proceso.ts`                   |
| Dónde y cómo se ve la gota al abrir                  | `Lienzo.astro` (póster); regenerarlo: `herramientas/poster-de-la-gota.mjs`                                   |
| Monolito de respaldo (sin WebGL, sin JS, interiores) | `.monolito-css` en `base.css`; su sitio: `Lienzo.astro`, `PortadaDePagina.astro`                             |
| Encabezado de las páginas interiores                 | `components/estructura/PortadaDePagina.astro`                                                                |
| Calidad en equipos lentos                            | `calidad.ts` (topes de píxeles, umbrales)                                                                    |

Para ver el estado sin hacer scroll, en desarrollo están `window.__estado` (estado
narrativo) y `window.__escena` (escena) en la consola.

## Las capas en detalle

### La gota al abrir

La gota se ve real desde el primer instante, antes de que WebGL compile (de 1 a varios
segundos en móviles). `Lienzo.astro` muestra su **póster** (`assets/gota-inicial.webp`, el
primer fotograma del mismo sombreador, en AVIF/WebP de pocos KB) en el sitio y al tamaño
exactos en que lo pintará WebGL, sobre un fondo CSS que reproduce el del sombreador (un
halo de grafito, `--halo-escena-rgb`). La cuenta es la de la cámara: el centro de la gota
cae en el desplazamiento del escenario inicial y una unidad mide
`FOCAL / distancia · alto / 2` (en pantallas más estrechas que `ASPECTO_MINIMO`, según el
ancho: allí el campo de visión se abre, no se aleja la cámara). El CSS recibe esas
constantes del TypeScript (`define:vars`). WebGL arranca en ese mismo fotograma (fase 0,
sin giro de cámara, con la arquitectura aún en la oscuridad) y, medio segundo después, el
monolito emerge de la oscuridad (`REVELADO`). Sin JavaScript o sin WebGL, el póster es la
gota de respaldo, delante de un monolito en CSS.

**Si cambias la gota, la luz del cromo, el fondo, `FOCAL` o el escenario inicial**, vuelve a
renderizar el póster:
`npm i --no-save playwright-core && node herramientas/poster-de-la-gota.mjs` con
`npm run dev` en marcha (si no hay Chromium de Playwright, `CHROME=/ruta/a/chrome`).

### Arquitectura

- **Piezas:** un juego fijo de 14 ranuras (`RANURAS`): dos mitades de monolito, dintel,
  losa, dos piezas lejanas, fondo, dos tiras de luz, cuatro marcos con hueco y una columna.
  Cada plano dice dónde está cada una (centro, semiejes, giro), cuánto se ve (`presencia`),
  cuánta luz recogen sus aristas, su luz interior y lo pulida que es. Las que un plano no
  nombra se quedan donde las dejó el plano vecino, fundidas en la oscuridad.
- **Un solo número:** el scroll anima `estado.escena` (0..5) y `arquitectura()` interpola
  las piezas entre los dos planos vecinos. Es determinista y reversible.
- **Sombreado:** intersección analítica rayo-caja (y marco con túnel), sin marchar rayos:
  bordes exactos y coste fijo por pieza. Grafito modelado por una luz principal con caída
  y un degradado cenital; aristas de metal de grosor constante en píxeles; cromo negro en
  las piezas pulidas; perspectiva atmosférica. Las tiras de luz son halo de plata.
- **Interacción:** el módulo del servicio activo y la puerta de la fase actual recogen luz
  fría (`foco`, `etapa`; el cuarto `vec4` de cada pieza lleva cuánto de su luz es fría).
- **Móvil:** las piezas secundarias no se envían (`ligera`), salvo si son un módulo o una
  puerta en su capítulo.

### Escultura

La gota es la misma función de distancia que pinta el póster. La curva son dos Bézier
cuadráticas con grosor variable unidas con unión suave; la gota adelgaza mientras la curva
crece desde su centro (`forma`, ligada al scroll de Presencia a Transformación). Flota,
ondula y su trazado cambia por capítulo: cruza el pórtico, conecta la columnata, atraviesa
las puertas del método y vuelve a cruzar el pórtico al final. Es cromo: refleja un estudio
procedural de luz blanca y plateada (con una sola tira fría) y, con un segundo rayo
analítico, la arquitectura que tiene alrededor. Se marcha solo dentro de una esfera
límite que calcula la página.

### Interfaz

Grafito, esquinas casi rectas (`--radio: 2px`), aristas de metal de 1 px y la luz solo
donde guía la mirada. La acción principal es una placa de metal claro con texto negro; la
secundaria, un contorno sobre grafito. Los énfasis de los titulares son de cromo
(`--cromo`); el del titular principal recoge un reflejo frío (`--cromo-luz`). La marca es
un monolito en miniatura con su gota.

## Arquitectura del código

- **Una sola escena** (`escena.ts`) para arquitectura y escultura. WebGL se pinta en un
  worker con OffscreenCanvas (`pintor.ts`, `trabajador.ts`).
- **Estado narrativo** (`narrativa.ts`): cámara (órbita alrededor de un objetivo),
  desplazamiento en pantalla, flujo, atenuación, `forma` y `escena`, más `foco` (servicio
  activo) y `etapa` (fase del método). `escenarios.ts` es el storyboard; `iniciar.ts` lo
  anima con GSAP ScrollTrigger (`scrub`, reversible) y Lenis con ratón o trackpad. Es el
  único que escribe la cámara y la arquitectura.
- **Fase integrada:** el tiempo interno del líquido se integra con su velocidad (`uFase`),
  así que cambiar de capítulo no hace saltar la forma.
- **El texto manda:** `[data-zona-lectura]` baja los brillos de la escultura y apaga las
  aristas detrás del texto.

## Rendimiento

- **Arquitectura:** coste fijo y bajo por pieza (sin marchar rayos); hasta 14 piezas, menos
  en móvil.
- **Escultura:** marcha solo dentro de su esfera límite y antes de la arquitectura.
- **Bucle:** uno solo, sin segundo lienzo (la red viva en Canvas 2D se retiró). A media
  frecuencia con la escena atenuada; en **reposo** (atenuación ≥ `REPOSO.atenuacion`, sin
  WebGL o con "reducir movimiento") solo pinta cuando cambia algo que se ve; se pausa fuera
  de pantalla o con la pestaña oculta.
- **Calidad adaptativa** (`calidad.ts`): con tres fotogramas seguidos de más de 50 ms baja
  al momento (primero el detalle, luego la resolución). Nunca vuelve a subir.
- **Páginas interiores:** sin WebGL ni bucle: CSS y una imagen de pocos KB.
- **Build:** la mayor parte del JS es GSAP; Lenis se descarga bajo demanda.

## Degradación y accesibilidad

- **Sin WebGL:** el póster de la gota se coloca donde estaría la escultura (casi apagado en
  los capítulos de lectura), delante de un monolito en CSS. Sin JavaScript se ven el
  monolito (vía `<noscript>`), el póster y el documento completo.
- **"Reducir movimiento":** sin tramos ni animaciones de entrada; la escena cambia de
  estado por saltos al cruzar cada capítulo y se pinta un fotograma fijo; nada de
  contenido oculto.
- **Servicios:** se activan con el puntero, con el foco del teclado o al cruzar el centro de
  la pantalla. Nada depende del hover.
- **Pasos del texto** (`data-paso`, solo en Transformación): nunca bajan de 0.45 de opacidad.
- **Contraste sobre `--fondo`:** texto 18.9:1, texto secundario 8.9:1, metadatos 4.8:1.

## Validación

Probado con Chrome headless (Playwright) sobre el servidor de desarrollo y el build de
producción: la portada con WebGL por software (SwiftShader), sin WebGL (contexto anulado),
sin JavaScript y con "reducir movimiento"; a 1440×900, 1280×800, 768×1024 táctil,
390×844 táctil, 320×640 táctil y 844×390 táctil (móvil apaisado).

- `astro check`, `prettier --check` y `astro build` sin errores.
- Sin desborde horizontal en ningún ancho ni ruta; sin errores de consola (salvo el aviso
  esperado "Se mantiene la gota de respaldo" sin WebGL y el 404 de una ruta inexistente).
- Cada capítulo llega a su plano (`estado.escena` 0..5) bajando; con "reducir movimiento",
  también.
- Rutas interiores y enlaces de la portada responden; las anclas del índice tienen destino.
  Contacto: al enviar vacío, cinco campos con `aria-invalid` y el foco en el primero.

**No medido todavía:** fluidez con GPU real (SwiftShader pinta en segundos por fotograma,
así que las capturas con WebGL pueden mostrar transiciones a medio camino), LCP, INP y
CLS, ni móviles o tablets reales.

## Direcciones probadas y descartadas

Para no volver a recorrerlas sin motivo:

- **The Digital Monolith × Liquid Technology en nueve escenas** (commit `2f2626d`): vacío,
  transformación, red viva, núcleo, servicios, proceso, proyectos, ecosistema y llamada,
  con una red viva de filamentos y partículas en Canvas 2D y luz cian, azul y violeta
  permanente. Los elementos 3D se leían como figuras sin narrativa (tres escenas repetían
  "todo conectado"; el anillo del ecosistema era decorativo), la cinta pasaba _delante_ del
  pórtico en vez de cruzarlo y, en móvil, cada escena empujaba el texto un 40 % hacia abajo.
  Sustituido por los seis capítulos actuales.
- **Liquid Technology × The Living Network** (todo el diseño anterior): un robot de metal
  líquido que guiaba la página y señalaba con el brazo, hilos de seda que tejían titulares
  y botones, titulares que nacían de gotas, paneles que llegaban como metal líquido y una
  tarjeta que seguía al cursor (commit `00b8d63`).
- **Escenas fijas** (CSS sticky que se quedaban en pantalla mientras el scroll cambiaba la
  cámara o el texto sin bajar la página): se sentía lento, como si el scroll se trabara.
- **Cinta con puntas de colmillo** (grosor que se afina a cero): se lee como un cuerno; las
  puntas tienen un grosor mínimo (`CINTA.puntaMinima`).
- **Siete módulos de servicios como barras de distinta altura sobre una misma base**: se
  leía como un gráfico de barras. Ahora es una columnata de losas altas a dos
  profundidades, toda a la derecha de la lista.
- **Columnata a lo ancho de toda la pantalla:** el módulo activo se encendía detrás del
  titular. Ahora las siete losas van juntas a la derecha del texto.
- **Fases del método en fila en tablet vertical:** cuatro columnas de 170 px; por debajo de
  `ANCHO_FASES_EN_FILA` son una lista.
- **Una escena WebGL completa en el encabezado de cada página interior**: cara y
  repetitiva; ahora es una composición CSS con el póster.
- **Siete gotas-neurona unidas por sinapsis de luz** en el héroe: se revirtió.

## Pendiente de diseño

- Probar en GPU, tablets y móviles reales; medir LCP, INP y CLS y ajustar `calidad.ts`, los
  topes de píxeles y el número de piezas si hace falta.
- Revisar la fluidez de las transiciones entre capítulos con GPU real (en software solo se
  pudo juzgar la composición estable de cada capítulo).
- Afinar los encuadres con el texto real encima en más proporciones (ultrapanorámico).
- Afinar el reflejo de la arquitectura en la curva (hoy un rayo sin difuminado).
- Imágenes reales de proyectos (hoy, vistas provisionales de la arquitectura).

## Convenciones para la capa visual

- Cada capítulo de la portada es una `<section>` con `id` propio y `data-escena`: son los
  anclajes del scrollytelling y del índice `Recorrido`. Los `id` (`servicios`, `proceso`,
  `proyectos-destacados`, `llamada`…) son estables: otros enlaces dependen de ellos.
- Los textos que acompañan a la escena por pasos llevan `data-paso` y un umbral `--u`; el
  CSS lee el progreso de su capítulo (`--p`). Sin JavaScript se ven enteros.
- Los bloques de texto que la escena debe respetar llevan `data-zona-lectura`.
- Las piezas `ejemplo: true` en `src/datos/` y `config/sitio.ts` muestran un aviso;
  desaparecen al poner contenido real. Ningún proyecto, cliente, precio ni cifra es
  inventado.
- El formulario de contacto tiene el marcado y la validación completos, pero aún no envía:
  falta conectar `POST /api/contact` (ver `../server`).
