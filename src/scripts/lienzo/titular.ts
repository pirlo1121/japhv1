/**
 * titular.ts
 * El titular que nace de la gota ([data-gota]): mientras la gota grande
 * aún no es robot, una burbuja brota de ella, se desprende, cruza la
 * pantalla hasta el titular y se extiende en sus letras, que se vuelven de
 * cromo y dejan paso al texto real. El resto de la gota se vuelve el robot.
 *
 * - Las letras: su campo de distancias (con signo, en px CSS) se calcula
 *   una sola vez a partir de la máscara del texto (la misma que usa la
 *   seda) y viaja al sombreador como textura. Por fotograma solo se
 *   muestrea, y solo dentro de la caja del titular y de la gota.
 * - El recorrido: `fases` traduce el progreso (0..1, ligado al scroll) en
 *   la burbuja 3D que brota y se suelta de la gota, el relevo a una gota 2D
 *   del mismo tamaño en pantalla, su vuelo y el frente que extiende las
 *   letras desde donde aterriza.
 */
import { dibujarLetras } from '@/scripts/seda/forma';
import { RANGO_TITULAR } from './sombreador';

/**
 * Tramos del progreso (0..1): brota de la gota, se suelta y vuela en 3D,
 * relevo a 2D (al final de la suelta), vuela por la pantalla y se extiende
 * en las letras. Las distancias (desde el centro de la gota, que mide 1.05)
 * y el radio son de la burbuja 3D, en el mundo: nace dentro (`dentro`),
 * asoma por la superficie (`asoma`) y se aleja hasta `distancia`.
 */
export const DESPRENDIMIENTO = {
  brote: 0.15,
  suelta: 0.3,
  relevo: 0.06,
  llegada: 0.62,
  dentro: 0.6,
  asoma: 1.2,
  distancia: 1.95,
  radio: 0.26,
  /** Desde aquí el texto real aparece mientras el cromo se desvanece. */
  revelado: 0.92
} as const;

export interface CampoDeTexto {
  ancho: number;
  alto: number;
  /** Distancia con signo codificada en 0..255 (128 = borde, ±RANGO_TITULAR). */
  datos: Uint8Array;
}

/** Transformada de distancia exacta en 1D (Felzenszwalb); f se sobrescribe con el resultado. */
function distancia1d(f: Float32Array, n: number, v: Int32Array, z: Float32Array, d: Float32Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = 0;
    for (;;) {
      const p = v[k]!;
      s = (f[q]! + q * q - (f[p]! + p * p)) / (2 * q - 2 * p);
      if (s > z[k]! || k === 0) break;
      k--;
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const p = v[k]!;
    d[q] = (q - p) * (q - p) + f[p]!;
  }
  for (let q = 0; q < n; q++) f[q] = d[q]!;
}

/** Distancia al cuadrado (2D) a los píxeles marcados, por filas y columnas. */
function distancia2d(marcado: Uint8Array, ancho: number, alto: number): Float32Array {
  const INF = 1e10;
  const campo = new Float32Array(ancho * alto);
  for (let i = 0; i < campo.length; i++) campo[i] = marcado[i] ? 0 : INF;
  const n = Math.max(ancho, alto);
  const f = new Float32Array(n);
  const d = new Float32Array(n);
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  for (let x = 0; x < ancho; x++) {
    for (let y = 0; y < alto; y++) f[y] = campo[y * ancho + x]!;
    distancia1d(f, alto, v, z, d);
    for (let y = 0; y < alto; y++) campo[y * ancho + x] = f[y]!;
  }
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) f[x] = campo[y * ancho + x]!;
    distancia1d(f, ancho, v, z, d);
    for (let x = 0; x < ancho; x++) campo[y * ancho + x] = f[x]!;
  }
  return campo;
}

/**
 * El campo de distancias de las letras del elemento, en px CSS, con
 * RANGO_TITULAR de margen alrededor de su caja. Fila 0 = arriba.
 */
export function campoDeTexto(elemento: HTMLElement): CampoDeTexto | null {
  const caja = elemento.getBoundingClientRect();
  if (caja.width === 0 || caja.height === 0) return null;
  const margen = RANGO_TITULAR;
  const ancho = Math.ceil(caja.width + margen * 2);
  const alto = Math.ceil(caja.height + margen * 2);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  dibujarLetras(elemento, ctx, caja, margen);
  const pixeles = ctx.getImageData(0, 0, ancho, alto).data;
  const dentro = new Uint8Array(ancho * alto);
  const fuera = new Uint8Array(ancho * alto);
  for (let i = 0; i < dentro.length; i++) {
    const opaco = (pixeles[i * 4 + 3] ?? 0) > 127;
    dentro[i] = opaco ? 1 : 0;
    fuera[i] = opaco ? 0 : 1;
  }
  const aLetras = distancia2d(dentro, ancho, alto);
  const aFondo = distancia2d(fuera, ancho, alto);
  const datos = new Uint8Array(ancho * alto);
  for (let i = 0; i < datos.length; i++) {
    const d = Math.sqrt(aLetras[i]!) - Math.sqrt(aFondo[i]!);
    datos[i] = Math.round(Math.min(Math.max(0.5 + d / (2 * RANGO_TITULAR), 0), 1) * 255);
  }
  return { ancho, alto, datos };
}

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const suave = (x: number) => {
  const t = acotar(x, 0, 1);
  return t * t * (3 - 2 * t);
};

export interface Fases {
  /** Gota 3D: distancia al cuerpo y radio (0: no hay). */
  distancia: number;
  radio: number;
  /** 0..1: de la gota 3D a su relevo 2D (tamaño de la gota 2D sobre su tamaño de relevo). */
  relevo: number;
  /** 0..1: vuelo 2D desde el relevo hasta el titular. */
  vuelo: number;
  /** 0..1: la gota se extiende en las letras. */
  extension: number;
  /** 0..1: cuánto se ve aún el cromo (al final aparece el texto real). */
  visible: number;
}

/** El estado de la gota del titular para un progreso p (0..1). */
export function fases(p: number): Fases {
  const D = DESPRENDIMIENTO;
  const brota = suave(p / D.brote);
  const sale = suave((p - D.brote) / (D.suelta - D.brote));
  const relevo = suave((p - (D.suelta - D.relevo)) / D.relevo);
  // Brota desde dentro de la gota hasta asomar, y luego se aleja hasta soltarse.
  const distancia = D.dentro + (D.asoma - D.dentro) * brota + (D.distancia - D.asoma) * sale;
  return {
    distancia,
    radio: D.radio * brota * (1 - relevo),
    relevo,
    vuelo: suave((p - D.suelta) / (D.llegada - D.suelta)),
    extension: suave((p - D.llegada) / (1 - D.llegada)),
    visible: p >= 1 ? 0 : 1 - suave((p - D.revelado) / (1 - D.revelado))
  };
}
