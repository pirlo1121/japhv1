/**
 * distancias.ts
 * Campo de distancias con signo de las letras de un titular líquido
 * (titular.ts) a partir de su máscara. Es la parte costosa (decenas de ms
 * por titular), así que la hace el pintor: dentro del worker, lejos de la
 * página. No toca el DOM.
 */
import { RANGO_TITULAR } from './sombreador';

export interface MascaraDeTexto {
  /** Texels. */
  ancho: number;
  alto: number;
  /** Texels por px CSS. */
  escala: number;
  /** 1 = letra, 0 = fondo. Fila 0 = arriba. */
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
 * Distancia con signo a las letras, en px CSS, codificada en 0..255 (128 =
 * borde, ±RANGO_TITULAR). Mismo tamaño que la máscara.
 */
export function campoDeDistancias(mascara: MascaraDeTexto): Uint8Array {
  const { ancho, alto, escala, datos: dentro } = mascara;
  const fuera = new Uint8Array(dentro.length);
  for (let i = 0; i < dentro.length; i++) fuera[i] = dentro[i] ? 0 : 1;
  const aLetras = distancia2d(dentro, ancho, alto);
  const aFondo = distancia2d(fuera, ancho, alto);
  const campo = new Uint8Array(dentro.length);
  for (let i = 0; i < campo.length; i++) {
    // De texels a px CSS.
    const d = (Math.sqrt(aLetras[i]!) - Math.sqrt(aFondo[i]!)) / escala;
    campo[i] = Math.round(Math.min(Math.max(0.5 + d / (2 * RANGO_TITULAR), 0), 1) * 255);
  }
  return campo;
}
