# front-japh2

Sitio de JAPH con la dirección visual **Liquid Technology × The Living Network**: un guía
de metal líquido, un robot que nace de una gota, recorre la página con el scroll y señala
el contenido de cada escena. De su cuerpo nace una red viva de filamentos, nodos y
energía. Materia → energía → conexiones → sistema → productos → crecimiento.

El robot es el del original (`front-japh`, commit `4915a4d`), con su cinemática inversa y
su rebote, llevado al diseño de esta copia (paleta navy y neones, red viva, nueve
escenas) y con más fluidez y rendimiento.

| Escena               | Componente       | El guía y la red                                                                   |
| -------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| 01 El vacío          | `Vacio`          | La gota se condensa en el robot, que señala el titular; la red duerme al fondo.    |
| 02 La transformación | `Transformacion` | (fija) La cámara lo rodea; señala el manifiesto; nacen los primeros filamentos.    |
| 03 La red viva       | `RedViva`        | (fija) La cámara se aleja y la red crece escalonada desde su cuerpo.               |
| 04 El núcleo         | `Nucleo`         | (fija) De cerca, se encienden circuitos de luz dentro de su cuerpo.                |
| 05 Servicios         | `Servicios`      | Señala el servicio activo; un hilo une su mano con el texto y su rama se enciende. |
| 06 El proceso        | `Proceso`        | (fija) Arriba a la derecha, señala la fase actual del camino orgánico (SVG).       |
| 07 Proyectos         | `Proyectos`      | Presenta cada proyecto según pasa por el centro; la red empieza a ordenarse.       |
| 08 Ecosistema        | `Ecosistema`     | En el centro de la red completa y ordenada; el movimiento se calma.                |
| 09 Hagámoslo real    | `Llamada`        | Arriba y al centro, señala la invitación, que lleva a destinos reales.             |

"(fija)": en escritorio la sección queda pegada a la pantalla (CSS sticky) mientras avanza.
En móvil, sin movimiento o sin JavaScript, todas son bloques normales. Las páginas
interiores muestran al mismo guía en calma, señalando su título.

## Fluidez

Todo en `scripts/lienzo/escena.ts` y `escultura.ts`:

- **Muelle de posición:** su sitio en pantalla sigue a la historia con un muelle algo
  subamortiguado. Viaja con inercia y se asienta con un leve rebote, sin saltos aunque el
  scroll vaya a tirones.
- **Viaje:** la velocidad de ese muelle lo estira como una gota, lo inclina hacia donde va
  (cizalla del cuerpo, también en el GLSL), agita la cola y suelta una estela de tres gotas
  que lo siguen y se reabsorben al frenar.
- **Señalar:** brazo de cinemática inversa de dos huesos; cambia de brazo con histéresis,
  la mano viaja de un elemento a otro y rebota al cambiar de objetivo.
- **Formación:** al cargar, la gota se condensa en el robot (unión suave entre las dos
  formas). Con "reducir movimiento" aparece ya formado.

## Arquitectura

- **Una sola escena.** `scripts/lienzo/escena.ts` tiene un único bucle y una única
  cámara (`camara.ts`). El guía se dibuja en WebGL2 (`sombreador.ts`, en un worker
  con OffscreenCanvas: `pintor.ts`, `trabajador.ts`). La red se dibuja en Canvas 2D
  (`red.ts`) proyectada con la misma cámara. Son unas decenas de curvas y puntos, así que
  un segundo WebGL a pantalla completa no hacía falta.
- **El guía y la red comparten datos.** `escultura.ts` calcula la pose (articulaciones,
  estela) una vez por fotograma. El sombreador la recibe como uniforms y la red la usa
  para anclar sus siete ramas (una por servicio) en antena, cabeza, manos, hombros y la
  gota de abajo.
- **Estado narrativo.** `narrativa.ts`: posición, cámara, giro, flujo, atenuación, `red`,
  `orden` y `grietas` (circuitos). `historia/escenarios.ts` es el storyboard en datos;
  `historia/iniciar.ts` lo anima con GSAP ScrollTrigger (`scrub`, reversible) y Lenis con
  ratón o trackpad.
- **Red determinista.** Se genera con una semilla fija y crece según `red`/`orden`: al
  subir se repliega exactamente igual que creció. Las partículas son pocas (12/8/5 según
  la pantalla) y viajan por filamentos encadenados.
- **El texto manda.** `[data-zona-lectura]` hace que la escultura baje sus brillos y que
  la red se borre detrás de esos textos.
- **Fase integrada.** El tiempo interno del líquido se integra con su velocidad
  (`uFase`). Antes era `tiempo × flujo` y la forma daba saltos al cambiar de escena.

## Degradación y accesibilidad

- **Sin WebGL:** queda una gota de cromo en CSS, colocada donde estaría la escultura, y
  la red sigue viva.
- **Sin JavaScript:** documento completo y legible con la gota en CSS; todos los enlaces
  funcionan.
- **"Reducir movimiento":** no hay tramos ni partículas. La escultura y la red cambian de
  estado, sin animación, al cruzar cada escena, y hay un velo detrás de cada escena.
- **Servicios:** se activan con el puntero, con el foco del teclado o al cruzar el centro
  de la pantalla en táctil. El contenido nunca depende del hover. Los nodos de la red
  muestran su nombre al pasar el puntero, pero eso es un extra.
- **Contraste sobre `--fondo`:** texto 18.8:1, texto secundario 9.5:1, metadatos 5.1:1.

## Rendimiento

- Guía: se pinta en un worker con OffscreenCanvas y solo marcha dentro de la esfera
  límite. Usa volúmenes envolventes: lejos del robot, una esfera; la cola, los abdominales
  y cada brazo solo se evalúan cerca de su región. Hay media frecuencia con la escena
  atenuada y pausa fuera de pantalla.
- Calidad adaptativa (`calidad.ts`): con tres fotogramas seguidos de más de 50 ms baja al
  momento (primero el detalle, luego la resolución). Antes ignoraba los fotogramas de más
  de 200 ms, así que un equipo muy lento nunca bajaba; ahora solo se ignora el primero
  tras una pausa.
- Hilo principal: pose, cinemática inversa y red cuestan 1–3 ms por fotograma (medido).
- Red: resolución con tope (DPR 1.5, o 1.25 en táctil), destellos pre-pintados en lugar
  de degradados por punto, sin `shadowBlur` ni postproceso.
- Build: unos 78 KB de JS comprimido en total (la mayor parte es GSAP); Lenis se
  descarga bajo demanda.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # astro check + build estático en dist/
```

## Validación

Probado con Chrome headless (Playwright, WebGL por software con SwiftShader) sobre el
servidor de desarrollo, a 1440×900 y a 390×844 táctil:

- `astro check` y `prettier --check` sin errores; `astro build` correcto.
- Recorrido completo de las nueve escenas en escritorio y móvil, sin errores de consola y
  sin desborde horizontal.
- Scroll de vuelta arriba: el estado vuelve exactamente al inicial.
- Entrada directa por ancla (`/#proceso`): escena correcta.
- Servicios: el foco cambia con el puntero y con el teclado.
- "Reducir movimiento": la escena cambia por saltos, escena a escena.
- Sin WebGL: gota CSS en su sitio, red viva y aviso en consola; el bucle va a 60 fps sin
  tareas largas en el hilo principal.
- Páginas interiores (servicios, proyectos, nosotros, contacto, privacidad, 404).

**No medido todavía:** FPS con GPU real. SwiftShader no es representativo: pinta el robot
a pantalla completa en segundos por fotograma, aunque la calidad adaptativa baja hasta
unos 40–80 ms. Tampoco LCP, INP y CLS ni dispositivos móviles reales.

## Convenciones para la capa visual

- Cada escena de la portada es una `<section>` con `id` propio y `data-escena`. Son los
  anclajes del scrollytelling y del índice `Recorrido`.
- Los textos que aparecen por pasos llevan `data-paso` y un umbral `--u`; el CSS lee el
  progreso de su escena (`--p`). Sin JavaScript se ven enteros.
- Las piezas marcadas como `ejemplo: true` en `src/datos/` muestran un aviso.
  Desaparecen al poner contenido real. Ningún proyecto, cliente ni cifra es inventado.
- El formulario de contacto tiene el marcado completo, pero aún no envía: falta conectar
  `POST /api/contact` (ver `../server`).
