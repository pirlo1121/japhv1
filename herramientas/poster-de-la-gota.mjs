/**
 * poster-de-la-gota.mjs
 * Vuelve a renderizar el póster de la gota (src/assets/gota-inicial.webp):
 * el primer fotograma del escenario inicial, pintado con el mismo
 * sombreador que la página, para que la gota se vea real desde el primer
 * instante y el relevo a WebGL no se note (ver Lienzo.astro).
 *
 * Hay que repetirlo si cambia la gota, la luz del cromo, la cámara (FOCAL)
 * o el escenario inicial (azimut, elevación, distancia, flujo, red).
 *
 * Uso, con `npm run dev` en marcha (playwright-core no es dependencia del
 * proyecto: se instala sin guardarlo):
 *   npm i --no-save playwright-core && node herramientas/poster-de-la-gota.mjs
 * Usa el Chromium de Playwright (`npx playwright install chromium`) o el
 * que indique la variable CHROME. Dibuja con WebGL por software
 * (SwiftShader): tarda unos segundos.
 */
import { createRequire } from 'node:module';

const requerir = createRequire(import.meta.url);
const { chromium } = await import('playwright-core');
const sharp = requerir('sharp');

/** Lado del póster en px: cubre ±POSTER_DE_LA_GOTA.extension unidades del mundo. */
const LADO = 1500;
const SERVIDOR = process.env.SERVIDOR ?? 'http://localhost:5173';
const SALIDA = new URL('../src/assets/gota-inicial.webp', import.meta.url);

const navegador = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
const pagina = await navegador.newPage();
// Una página sin lienzo propio: solo hace falta el servidor para importar los módulos.
await pagina.goto(`${SERVIDOR}/privacidad`, { waitUntil: 'load' });

const png = await pagina.evaluate(async (lado) => {
  const { Renderizador } = await import('/src/scripts/lienzo/renderizador.ts');
  const { calcularCamara, FOCAL } = await import('/src/scripts/lienzo/camara.ts');
  const { robot } = await import('/src/scripts/lienzo/escultura.ts');
  const { ESCENARIO_INICIAL, POSTER_DE_LA_GOTA } = await import('/src/scripts/lienzo/narrativa.ts');
  const S = await import('/src/scripts/lienzo/sombreador.ts');

  // Alto tal que 2 · extension unidades midan `lado` px (px por unidad = FOCAL / distancia · alto / 2).
  const unidad = lado / (2 * POSTER_DE_LA_GOTA.extension);
  const alto = Math.round((unidad / FOCAL) * ESCENARIO_INICIAL.distancia * 2);
  // Más ancho que ASPECTO_MINIMO: la cámara no se aleja.
  const ancho = Math.ceil(alto * 0.9);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const r = new Renderizador(lienzo);
  while (!r.compilado()) await new Promise((f) => setTimeout(f, 50));
  r.enlazar();
  r.redimensionar(ancho, alto);

  // El primer fotograma de la escena: la gota en la fase 0, sin giro de cámara, centrada.
  const camara = calcularCamara(
    { ...ESCENARIO_INICIAL, desplazamientoX: 0, desplazamientoY: 0 },
    ancho / alto
  );
  const piezas = robot({
    gestos: [0, 0],
    objetivo: [0, 0, 0],
    giro: 0,
    elastico: 0,
    velocidad: 0,
    inclinacion: 0,
    direccion: [0, 0, 0],
    formacion: 0,
    brote: { direccion: [0, 0, 1], distancia: 0, radio: 0 },
    tiempo: 0
  });
  const vacio = (n) => new Float32Array(n * 4);
  r.dibujar({
    tiempo: 0,
    detalle: 1,
    camara,
    fase: 0,
    atenuacion: ESCENARIO_INICIAL.atenuacion,
    red: ESCENARIO_INICIAL.red,
    grietas: 0,
    piezas,
    zonas: vacio(S.MAX_ZONAS_DE_LECTURA),
    numZonas: 0,
    paneles: vacio(S.MAX_PANELES),
    estadosPanel: vacio(S.MAX_PANELES),
    numPaneles: 0,
    pxCss: 1,
    titulares: {
      cajas: vacio(S.MAX_TITULARES),
      atlas: vacio(S.MAX_TITULARES),
      gotas: vacio(S.MAX_TITULARES),
      frentes: vacio(S.MAX_TITULARES),
      numero: 0
    }
  });
  const recorte = document.createElement('canvas');
  recorte.width = lado;
  recorte.height = lado;
  recorte
    .getContext('2d')
    .drawImage(lienzo, (ancho - lado) / 2, (alto - lado) / 2, lado, lado, 0, 0, lado, lado);
  return recorte.toDataURL('image/png').split(',')[1];
}, LADO);

await navegador.close();
// Fuente de alta calidad: Astro genera de aquí las versiones AVIF y WebP de cada tamaño.
const info = await sharp(Buffer.from(png, 'base64'))
  .removeAlpha()
  .webp({ quality: 94, effort: 6 })
  .toFile(SALIDA.pathname);
console.log(`Póster: ${SALIDA.pathname} (${info.width} × ${info.height}, ${info.size} bytes)`);
