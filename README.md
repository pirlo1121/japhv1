# front-japh2

Sitio de JAPH con la dirección visual **Liquid Technology × The Living Network**: una
escultura de metal líquido de la que nace una red viva de filamentos, nodos y energía.
Las dos cambian con el scroll y cuentan una sola historia: materia → energía →
conexiones → sistema → productos → crecimiento.

Es una copia de `front-japh` que parte de la escultura de la **gota** (commit `d5fe667`
del original: gota → cinta curva), no del robot guía que tiene el original hoy. La gota y
la cinta del shader están intactas; todo lo demás se construye encima.

| Escena               | Componente       | Escultura y red                                                                          |
| -------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| 01 El vacío          | `Vacio`          | La gota flota a la derecha del titular; unos pocos filamentos duermen al fondo.          |
| 02 La transformación | `Transformacion` | (fija) La gota se estira en una cinta curva; los primeros filamentos salen de ella.      |
| 03 La red viva       | `RedViva`        | (fija) La cinta se estabiliza; la red crece escalonada y la energía empieza a viajar.    |
| 04 El núcleo         | `Nucleo`         | (fija) La cinta se pliega alrededor de un núcleo de obsidiana; sus grietas se encienden. |
| 05 Servicios         | `Servicios`      | La escena se aparta; cada servicio enciende su rama y un hilo lo une con la escultura.   |
| 06 El proceso        | `Proceso`        | (fija) Un camino orgánico (SVG) se ilumina fase a fase; una partícula viaja.             |
| 07 Proyectos         | `Proyectos`      | Un aro de cromo enmarca el trabajo; la red empieza a ordenarse.                          |
| 08 Ecosistema        | `Ecosistema`     | Núcleo y siete módulos en órbita (uno por servicio); la red, completa y en calma.        |
| 09 Hagámoslo real    | `Llamada`        | La escultura como firma, arriba; la invitación con destinos reales.                      |

"(fija)": en escritorio la sección queda pegada a la pantalla (CSS sticky) mientras se
transforma. En móvil, sin movimiento o sin JavaScript, todas son bloques normales.

Las páginas interiores muestran la misma escultura y la misma red en calma, cada una con
su forma: gota (contacto, 404), cinta (legales), núcleo (nosotros), portal (proyectos) y
ecosistema (servicios).

## Arquitectura

- **Una sola escena.** `scripts/lienzo/escena.ts` tiene un único bucle y una única
  cámara (`camara.ts`). La escultura se dibuja en WebGL2 (`sombreador.ts`, en un worker
  con OffscreenCanvas: `pintor.ts`, `trabajador.ts`). La red se dibuja en Canvas 2D
  (`red.ts`) proyectada con la misma cámara. Son unas decenas de curvas y puntos, así que
  un segundo WebGL a pantalla completa no hacía falta.
- **Las formas y la red comparten datos.** `escultura.ts` define las medidas de cada
  forma y siete anclas por forma, una por servicio. El sombreador las usa para dibujar y
  la red para hacer nacer sus filamentos de la superficie.
- **Estado narrativo.** `narrativa.ts`: forma (0–4), cámara, flujo, atenuación, `red`
  (cuánto de la red está despierto), `orden` (de ramas orgánicas a estructura) y
  `grietas`. `historia/escenarios.ts` es el storyboard en datos; `historia/iniciar.ts`
  lo anima con GSAP ScrollTrigger (`scrub`, reversible) y Lenis con ratón o trackpad.
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

- Escultura: la misma estrategia que el original (worker, marcha solo dentro de la esfera
  límite, calidad adaptativa en `calidad.ts`, media frecuencia con la escena atenuada,
  pausa fuera de pantalla).
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

**No medido todavía:** FPS con GPU real (SwiftShader no es representativo: el shader va a
unos pocos fotogramas por segundo), LCP, INP y CLS, ni dispositivos móviles reales.

## Convenciones para la capa visual

- Cada escena de la portada es una `<section>` con `id` propio y `data-escena`. Son los
  anclajes del scrollytelling y del índice `Recorrido`.
- Los textos que aparecen por pasos llevan `data-paso` y un umbral `--u`; el CSS lee el
  progreso de su escena (`--p`). Sin JavaScript se ven enteros.
- Las piezas marcadas como `ejemplo: true` en `src/datos/` muestran un aviso.
  Desaparecen al poner contenido real. Ningún proyecto, cliente ni cifra es inventado.
- El formulario de contacto tiene el marcado completo, pero aún no envía: falta conectar
  `POST /api/contact` (ver `../server`).
