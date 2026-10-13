# front-japh2

Sitio de JAPH con la dirección visual **Liquid Technology × The Living Network**. Una
copia de `front-japh` en la que se está explorando el diseño.

> **Estado: diseño en evolución.** Lo que hay funciona y está probado, pero la dirección
> visual se sigue afinando. Antes de cambiar algo, lee "Cómo ajustar el diseño" y
> "Direcciones probadas y descartadas" para no repetir caminos ya recorridos.

```bash
npm install
npm run dev     # http://localhost:5173 (si front-japh ocupa ese puerto: npx astro dev --port 5174)
npm run build   # astro check + build estático en dist/
```

## Las capas visuales

La página se cuenta con cinco capas que conviven. Cada una tiene su sitio, su atributo y
sus perillas:

| Capa                  | Qué es                                                                                                                                       | Dónde                                                              | Se activa con                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| **Guía**              | Gota flotante (WebGL2) que toma forma de robot con el scroll, recorre la página y señala.                                                    | `scripts/lienzo/` (escena, escultura, shader)                      | `data-guia`, `data-rama`           |
| **Red viva**          | Filamentos, nodos y energía (Canvas 2D) que nacen del cuerpo del guía.                                                                       | `scripts/lienzo/red.ts`                                            | estado `red` / `orden` por escena  |
| **Paneles líquidos**  | Piezas que llegan como metal líquido y se solidifican en su forma (en el mismo shader).                                                      | `sombreador.ts` (`pintarPaneles`), `escena.ts`                     | `data-liquido`                     |
| **Titulares de gota** | Cada titular de sección nace de una gota que cae y se derrama en sus letras; el de la 02, de una burbuja que se desprende de la gota grande. | `titular.ts`, `distancias.ts`, `sombreador.ts` (`pintarTitulares`) | `data-gota`, `data-gota="burbuja"` |
| **Hilos de seda**     | Hebras que navegan sobre la página y cosen el contorno de titulares y componentes.                                                           | `scripts/seda/`, `Seda.astro`                                      | `data-seda`, `<Boton seda>`        |

El guía, la red y los paneles comparten un solo bucle y una sola cámara (`escena.ts`), en
un lienzo fijo detrás del contenido (solo en la portada; las interiores lo tienen en su
encabezado). La seda tiene su propio lienzo, por encima del contenido y en todas las
páginas, y su propio bucle.

## La historia (portada)

| Escena               | Componente       | Guía y red                                                                                                                                                                              | Otras capas                                                           |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 01 El vacío          | `Vacio`          | Una gota de metal líquido flota junto al titular; la red duerme al fondo.                                                                                                               | Seda: titular (al cargar)                                             |
| 02 La transformación | `Transformacion` | Al llegar, de la gota se desprende una burbuja que se vuelve el titular y el resto toma forma de robot. (fija) La cámara lo rodea; señala el manifiesto; nacen los primeros filamentos. | Gota: titular. Líquido: tarjeta de los tres estados (sigue al cursor) |
| 03 La red viva       | `RedViva`        | (fija) La cámara se aleja y la red crece escalonada desde su cuerpo.                                                                                                                    | Gota: titular                                                         |
| 04 El núcleo         | `Nucleo`         | (fija) De cerca, se encienden circuitos de luz dentro de su cuerpo.                                                                                                                     | Líquido: principios. Gota: titular                                    |
| 05 Servicios         | `Servicios`      | Señala el servicio activo; un hilo une su mano con el texto y su rama se enciende.                                                                                                      | Líquido: la lista. Gota: titular                                      |
| 06 El proceso        | `Proceso`        | (fija) Arriba a la derecha, señala la fase actual del camino orgánico (SVG).                                                                                                            | Gota: titular                                                         |
| 07 Proyectos         | `Proyectos`      | Presenta cada proyecto según pasa por el centro; la red empieza a ordenarse.                                                                                                            | Líquido: tarjetas. Gota: titular                                      |
| 08 Ecosistema        | `Ecosistema`     | En el centro de la red completa y ordenada; el movimiento se calma.                                                                                                                     | Gota: titular                                                         |
| 09 Hagámoslo real    | `Llamada`        | Arriba y al centro, señala la invitación, que lleva a destinos reales.                                                                                                                  | Gota: titular. Seda: botones                                          |

"(fija)": en escritorio la sección queda pegada a la pantalla (CSS sticky) mientras avanza.
En móvil, sin movimiento o sin JavaScript, todas son bloques normales. Las páginas
interiores muestran al guía en calma señalando su título, y la seda teje su título y sus
encabezados de sección.

## Cómo ajustar el diseño

Las decisiones visuales están en constantes con nombre, no repartidas por el código:

| Quiero cambiar…                                | Dónde                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Colores, degradados, tipografía, espacios      | `styles/tokens.css` (nunca colores sueltos fuera de ahí)                              |
| Dónde está el guía en cada escena, cámara, red | `scripts/historia/escenarios.ts` (un `Escenario` por escena; `vertical()` para móvil) |
| Qué tramo de scroll lleva de una escena a otra | `crearTramos` en `escenarios.ts`; inercia del scroll: `INERCIA` en `iniciar.ts`       |
| Cómo viaja y fluye el guía                     | `escena.ts`: `MUELLE_POSICION`, `VIAJE`, `REBOTE`                                     |
| Cuándo la gota toma forma de robot             | `forma` en `escenarios.ts` (hoy: tramo de llegada a 02); inercia: `FORMACION`         |
| Cuánto flota la gota (y el robot)              | `FLOTACION` en `escultura.ts`                                                         |
| Cómo señala                                    | `escena.ts`: `RAPIDEZ_DEL_BRAZO`, `RAPIDEZ_DE_LA_MANO`, `GIRO_AL_SENALAR`             |
| Forma del robot (cuerpo, cabeza, cola, estela) | `robot()` en `sombreador.ts` y `escultura.ts` (las dos cuentas deben coincidir)       |
| Luz y reflejos del cromo                       | `estudio()` en `sombreador.ts`                                                        |
| Cuánta red hay y cómo crece                    | `CANTIDADES` y `generar()` en `red.ts`                                                |
| Cuándo y qué tan rápido se solidifica un panel | `PANEL` en `escena.ts`; aspecto: `campoPanel` y `pintarPaneles` en `sombreador.ts`    |
| Cuántas hebras de seda, cuánto dura el tejido  | `seda.ts`: `cuantas` (en el constructor), `TEJIDO`, `AGUJAS_POR_PIEZA`                |
| Color y grosor de la seda                      | `COLORES`, `trazarHebra` y `trazarParcial` en `seda.ts`                               |
| Qué piezas se tejen o se licúan                | Atributos `data-seda` y `data-liquido` en los componentes                             |
| Cómo cae la gota de los titulares y cuándo     | `CAIDA` en `titular.ts` (tramos, altura, tamaño, recorrido en pantalla)               |
| Cómo se desprende la burbuja del titular 02    | `DESPRENDIMIENTO` y `TITULAR` (aterrizaje, arco) en `titular.ts`                      |
| Qué tramo de scroll forma el titular 02        | `TRAMO_DEL_TITULAR` y `gotaDelTitular` en `iniciar.ts`                                |
| Cuántos titulares se dibujan a la vez          | `MAX_TITULARES` en `sombreador.ts`                                                    |
| Cuánto se deforma la tarjeta con el cursor     | `DEFORMACION` y `MUELLE` en `historia/tarjeta.ts`                                     |
| Qué señala el guía                             | Atributo `data-guia` (o un servicio con `data-activa`)                                |
| Calidad en equipos lentos                      | `calidad.ts` (topes de píxeles, umbrales de bajada)                                   |

Para ver un cambio en el estado del guía sin hacer scroll, en desarrollo están
`window.__estado` (estado narrativo) y `window.__escena` (escena) en la consola.

## Las capas en detalle

### Guía (robot)

- **Formación:** en la primera escena es una gota de metal líquido que flota (sube y baja
  más que el robot, con una gota menor que se separa y vuelve). Al bajar a la segunda
  escena toma forma de robot (unión suave entre las dos formas), ligado al scroll y
  reversible: al subir vuelve a ser gota. Lo decide `forma` en el estado narrativo; la
  escena la sigue con algo de inercia (`FORMACION`), así que al recargar a media página o
  saltar con un ancla se condensa sin saltos. En las páginas interiores (`forma: 1`) se
  condensa al cargar. Con "reducir movimiento" cambia por saltos con la escena.
- **Viaje:** su posición en pantalla sigue a la historia con un muelle algo
  subamortiguado. La velocidad de ese muelle lo estira, lo inclina hacia donde va (una
  cizalla que también aplica el GLSL), agita la cola y suelta una estela de tres gotas que
  se reabsorben al frenar.
- **Señalar:** brazo de cinemática inversa de dos huesos. Cambia de brazo con histéresis,
  la mano viaja de un elemento a otro, rebota al cambiar de objetivo, y un hilo de luz une
  la mano con lo que señala.
- **Detalles:** el visor brilla cian; en el núcleo se encienden circuitos (`grietas`).
  Las siete ramas de la red (una por servicio) nacen de la antena, la cabeza, las manos,
  los hombros y la gota de abajo.

### Red viva

Determinista: se genera con una semilla fija y crece según `red` y `orden`, así que al
subir se repliega igual que creció. Las partículas son pocas (12, 8 o 5 según la
pantalla) y viajan por filamentos encadenados. Se borra detrás de `[data-zona-lectura]`.

### Paneles líquidos (`data-liquido`)

Cuando el borde superior de la pieza entra en pantalla: brota una gota de cromo junto a
ese borde, se divide en gotas que se extienden y se funden, se solidifica en una placa con
la forma exacta del elemento (radio de esquina incluido), con bisel de cromo y cara azul
profunda, y aparece el contenido real. La solidez sigue al scroll con suavizado y es
reversible.

- **Coste:** no marcha rayos. Es un campo de distancias 2D con relieve, solo para los
  paneles visibles que están cambiando (hasta 4) y solo dentro de su caja.
- **Alineación:** ya sólida, la pieza la dibuja el HTML, así que el scroll sobre ella no
  cuesta nada y no puede desalinearse. El contenido solo cambia de opacidad.
- **Ámbito:** solo la portada, donde está el lienzo fijo.

### Titulares de gota (`data-gota`)

Todos los titulares de sección de la portada (02 a 09) nacen de metal líquido. Al entrar
en pantalla aparece una gota sobre el titular, cae, se posa y se vacía en las letras: un
frente las extiende desde donde aterrizó. Al final el cromo se desvanece y aparece el
texto real (`--gota`). Su progreso sigue a la posición del titular (de asomar por abajo a
la mitad de la pantalla), con suavizado y reversible; lo que ya se veía al activarse no se
licúa ante los ojos. El titular del héroe sigue tejido por la seda: se ve al cargar y no
puede esperar a WebGL.

El de la escena 02 (`data-gota="burbuja"`) es especial. Al bajar a la escena 02, la gota grande hace dos cosas: primero se le desprende una
burbuja (brota de su superficie, fundida con ella, y se suelta hacia el titular) y el resto
toma forma de robot. Las dos cosas comparten el tramo de llegada a la escena (la burbuja
se suelta cuando la gota apenas empieza a transformarse) y la burbuja termina de formar las
letras justo después (`TRAMO_DEL_TITULAR`). Al borde de su esfera límite la releva una gota 2D
del mismo tamaño en pantalla, que vuela en arco, se posa y se vacía en las letras: un
frente las extiende desde donde aterrizó. Ligado al scroll y reversible.

- **Coste en la página:** solo la máscara de las letras de cada titular (3–12 ms), una por
  momento ocioso y con las fuentes ya cargadas; otra vez si cambia el tamaño de alguno.
- **Coste en el worker:** el campo de distancias (decenas de ms por titular, una vez,
  `distancias.ts`) y un solo atlas para todos. Por fotograma solo se muestrea, solo para los
  titulares que están cambiando (hasta `MAX_TITULARES`) y solo dentro de su caja y su gota.
- **Alineación:** la máscara sale de la misma medición que usa la seda (`dibujarLetras` en
  `seda/forma.ts`), así que las letras de cromo coinciden con las del HTML.
- **Sin WebGL, sin JS o con "reducir movimiento":** el titular se ve normal.

La tarjeta de los tres estados es `data-liquido` (llega como metal líquido) y además
`data-tarjeta-liquida`: con ratón o trackpad, su piel (`.piel`, no la tarjeta) se estira un
poco hacia el cursor, redondea la esquina más cercana y tiembla al soltarla. Su bucle solo
corre mientras el muelle se mueve.

### Hilos de seda (`data-seda`)

Hebras finas (cian, púrpura, turquesa, blanco frío): cinco en táctil o en pantallas de
menos de 768 px, nueve en el resto. Su cabeza sigue un campo de flujo y la cola la sigue
con retraso. Cuando una pieza entra en pantalla, su contorno se cose de izquierda a
derecha con las hebras más cercanas como agujas; al final aparece el contenido y el hilo
se desvanece. Si sale por abajo y vuelve, se teje otra vez. El tejido termina aunque la
pieza salga de pantalla, así que nada queda oculto.

- `data-seda="texto"`: contorno exacto de las letras. Cada carácter se dibuja en su
  posición real (`Range`) con su fuente y se sigue el borde (`forma.ts`).
- `data-seda="caja"`: rectángulo redondeado del componente (en botones, `<Boton seda>`).
- `data-seda-inicio`: se teje al cargar; se oculta antes de la primera pintura y, si el
  script no llegara, aparece a los 3 s.

## Arquitectura

- **Una sola escena** para guía, red y paneles (`escena.ts`). El robot y los paneles se
  pintan en un worker con OffscreenCanvas (`pintor.ts`, `trabajador.ts`); la red, en
  Canvas 2D con la misma cámara (`camara.ts`).
- **Estado narrativo** (`narrativa.ts`): posición, cámara, giro, flujo, atenuación, `red`,
  `orden` y `grietas`. `escenarios.ts` es el storyboard; `iniciar.ts` lo anima con GSAP
  ScrollTrigger (`scrub`, reversible) y Lenis con ratón o trackpad.
- **Datos compartidos:** `escultura.ts` calcula la pose una vez por fotograma; el shader la
  recibe como uniforms y la red ancla en ella sus ramas.
- **Fase integrada:** el tiempo interno del líquido se integra con su velocidad (`uFase`),
  así que cambiar de escena no hace saltar la forma.
- **El texto manda:** `[data-zona-lectura]` baja los brillos del guía y borra la red detrás.

## Rendimiento

- **Guía:** marcha solo dentro de la esfera límite, con volúmenes envolventes (lejos del
  robot, una esfera; cola, abdominales y cada brazo solo cerca de su región). Va a media
  frecuencia con la escena atenuada y se pausa fuera de pantalla.
- **Calidad adaptativa** (`calidad.ts`): con tres fotogramas seguidos de más de 50 ms baja
  al momento (primero el detalle, luego la resolución); con muestras lentas, baja poco a
  poco. Nunca vuelve a subir.
- **Hilo principal** (medido): pose, red y paneles cuestan 1–3 ms por fotograma. Seda: 60
  fps en escritorio y en móvil, con una o dos tareas de unos 55 ms en escritorio al medir
  el contorno del titular grande.
- **Build:** unos 80 KB de JS comprimido (la mayor parte es GSAP); Lenis se descarga bajo
  demanda.

## Degradación y accesibilidad

- **Sin WebGL:** gota de cromo en CSS donde estaría el guía; la red y la seda siguen vivas.
- **Sin JavaScript:** documento completo y legible; todos los enlaces funcionan.
- **"Reducir movimiento":** sin tramos, partículas, líquido ni seda. El guía y la red
  cambian de estado por saltos al cruzar cada escena.
- **Servicios:** se activan con el puntero, con el foco del teclado o al cruzar el centro
  de la pantalla. El contenido nunca depende del hover.
- **Contraste sobre `--fondo`:** texto 18.8:1, texto secundario 9.5:1, metadatos 5.1:1.

## Validación

Probado con Chrome headless (Playwright) a 1440×900 y a 390×844 táctil. La portada se
probó con WebGL por software (SwiftShader) y también sin WebGL.

- `astro check`, `prettier --check` y `astro build` sin errores.
- Recorrido completo de la portada, de bajada y de vuelta arriba, sin errores de consola;
  el estado vuelve al inicial.
- Entrada directa por ancla, foco de servicios con puntero y teclado, "reducir
  movimiento", sin WebGL, páginas interiores.
- Paneles líquidos y seda, fotograma a fotograma, en escritorio y móvil.

**No medido todavía:** fluidez con GPU real. SwiftShader no es representativo: pinta el
robot en segundos por fotograma. Tampoco LCP, INP y CLS, ni móviles reales.

## Direcciones probadas y descartadas

Para no volver a recorrerlas sin motivo:

- **La gota se condensa en el robot al cargar** (temporizador de 1,8 s): ahora la gota
  flota en la primera escena y toma forma con el scroll.
- **Escultura que cambia de forma** (gota → cinta → núcleo de obsidiana → portal →
  ecosistema): se sustituyó por el robot guía. El núcleo vive ahora como circuitos de luz
  dentro del robot.
- **Siete gotas-neurona unidas por sinapsis de luz** en el héroe: se revirtió.
- **Palabras de metal líquido** (filtro SVG de gotas que se solidifican en letras): se
  sustituyeron por los hilos de seda. El titular de la escena 02 vuelve a nacer de metal
  líquido, pero en el sombreador (campo de distancias precalculado), no con filtros SVG.
- **Seda en los tres estados de la materia** (escena 02): ahora van en una tarjeta líquida.

## Pendiente de diseño

Ideas y huecos conocidos para la siguiente iteración:

- Probar en GPU y móviles reales, medir LCP, INP y CLS y ajustar `calidad.ts` si hace
  falta. El titular del héroe aparece al terminar de tejerse; vigilar su efecto en el LCP.
- Mover el cálculo del contorno de los titulares grandes a un momento ocioso (evitaría
  las tareas de unos 55 ms) o precalcularlo.
- Comprobar que las capas conviven bien: que la seda no compita con el guía y la red
  en escenas cargadas (servicios, ecosistema).
- Paneles líquidos y seda en las páginas interiores (hoy solo tienen el guía en su
  encabezado y la seda en los títulos).
- La gota de respaldo CSS es una sola gota; podría anticipar mejor al robot.
- Afinar composición en tablet (entre 768 y 1100 px) y en móvil apaisado.

## Convenciones para la capa visual

- Cada escena de la portada es una `<section>` con `id` propio y `data-escena`: son los
  anclajes del scrollytelling y del índice `Recorrido`.
- Los textos que aparecen por pasos llevan `data-paso` y un umbral `--u`; el CSS lee el
  progreso de su escena (`--p`). Sin JavaScript se ven enteros.
- A las piezas `data-liquido` y `data-seda` no les pongas `transform` ni animaciones de
  entrada propias: su capa se dibuja con su caja y debe coincidir al píxel.
- Las piezas `ejemplo: true` en `src/datos/` muestran un aviso; desaparecen al poner
  contenido real. Ningún proyecto, cliente ni cifra es inventado.
- El formulario de contacto tiene el marcado completo, pero aún no envía: falta conectar
  `POST /api/contact` (ver `../server`).
