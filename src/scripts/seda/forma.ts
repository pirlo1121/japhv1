/**
 * forma.ts
 * La forma que tejen los hilos de seda: contornos ordenados (listas de
 * puntos) relativos a la esquina del elemento.
 *
 * - Texto: cada carácter se dibuja en un lienzo aparte en su posición real
 *   (Range.getClientRects, con su misma fuente), se detecta el borde de las
 *   letras y se encadenan los puntos del borde en trazos. Así la seda sigue
 *   el contorno exacto de lo que se lee, en cualquier tamaño y salto de línea.
 * - Caja: el rectángulo redondeado del componente, con su radio de esquina.
 *
 * Se calcula una vez por elemento (y otra si cambia su tamaño).
 */

export type Punto = [number, number];

export interface Trazo {
  puntos: Punto[];
  /** Largo acumulado hasta cada punto, para dibujar una fracción del trazo. */
  acumulado: number[];
  largo: number;
  /** Posición horizontal (0..1) en el elemento: la seda teje de izquierda a derecha. */
  inicio: number;
}

export interface Forma {
  trazos: Trazo[];
  ancho: number;
  alto: number;
}

function medir(puntos: Punto[]): Pick<Trazo, 'acumulado' | 'largo'> {
  const acumulado = [0];
  let largo = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    largo += Math.hypot(b[0] - a[0], b[1] - a[1]);
    acumulado.push(largo);
  }
  return { acumulado, largo };
}

function trazo(puntos: Punto[], ancho: number): Trazo {
  const minX = Math.min(...puntos.map((p) => p[0]));
  return { puntos, ...medir(puntos), inicio: ancho > 0 ? minX / ancho : 0 };
}

/** El contorno de un rectángulo redondeado, en sentido horario desde arriba a la izquierda. */
export function formaDeCaja(ancho: number, alto: number, radio: number, paso = 6): Forma {
  const r = Math.min(radio, ancho / 2, alto / 2);
  const puntos: Punto[] = [];
  const recta = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / paso));
    for (let i = 0; i < n; i++) puntos.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  const arco = (cx: number, cy: number, desde: number) => {
    const n = Math.max(2, Math.round((r * Math.PI) / 2 / paso));
    for (let i = 0; i < n; i++) {
      const a = desde + ((Math.PI / 2) * i) / n;
      puntos.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  recta(r, 0, ancho - r, 0);
  arco(ancho - r, r, -Math.PI / 2);
  recta(ancho, r, ancho, alto - r);
  arco(ancho - r, alto - r, 0);
  recta(ancho - r, alto, r, alto);
  arco(r, alto - r, Math.PI / 2);
  recta(0, alto - r, 0, r);
  arco(r, r, Math.PI);
  puntos.push([r, 0]);
  return { trazos: [trazo(puntos, ancho)], ancho, alto };
}

/**
 * Dibuja en `ctx` (en px CSS, con `margen` alrededor de la caja) cada
 * carácter del elemento en su posición real y con su fuente. Es la máscara
 * de las letras: la seda sigue su borde y el titular líquido (lienzo/titular.ts)
 * saca de ella su campo de distancias.
 */
export function dibujarLetras(
  elemento: HTMLElement,
  ctx: CanvasRenderingContext2D,
  caja: DOMRect,
  margen: number
): void {
  ctx.fillStyle = '#000';
  const recorrido = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
  const rango = document.createRange();
  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    const texto = nodo.textContent ?? '';
    const padre = nodo.parentElement;
    if (!padre) continue;
    const estilo = getComputedStyle(padre);
    ctx.font = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
    for (let i = 0; i < texto.length; i++) {
      const caracter = texto[i]!;
      if (!caracter.trim()) continue;
      rango.setStart(nodo, i);
      rango.setEnd(nodo, i + 1);
      const r = rango.getClientRects()[0];
      if (!r || r.width === 0) continue;
      const medida = ctx.measureText(caracter);
      const ascenso = medida.fontBoundingBoxAscent || parseFloat(estilo.fontSize) * 0.8;
      ctx.fillText(caracter, r.left - caja.left + margen, r.top - caja.top + margen + ascenso);
    }
  }
}

/**
 * El contorno de las letras de un elemento. `escala` < 1 reduce el lienzo
 * de muestreo (los titulares grandes no necesitan cada píxel).
 */
export function formaDeTexto(elemento: HTMLElement, escala: number): Forma | null {
  const caja = elemento.getBoundingClientRect();
  if (caja.width === 0 || caja.height === 0) return null;
  const margen = 4;
  const ancho = Math.ceil((caja.width + margen * 2) * escala);
  const alto = Math.ceil((caja.height + margen * 2) * escala);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.scale(escala, escala);
  dibujarLetras(elemento, ctx, caja, margen);

  // Borde de las letras: píxeles opacos con algún vecino transparente.
  const datos = ctx.getImageData(0, 0, ancho, alto).data;
  const opaco = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < ancho && y < alto && (datos[(y * ancho + x) * 4 + 3] ?? 0) > 127;
  const borde: Punto[] = [];
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (!opaco(x, y)) continue;
      if (!opaco(x - 1, y) || !opaco(x + 1, y) || !opaco(x, y - 1) || !opaco(x, y + 1)) {
        borde.push([x, y]);
      }
    }
  }
  if (borde.length === 0) return null;

  // Encadena los puntos del borde en trazos: siempre al vecino libre más
  // cercano; si no hay ninguno cerca, empieza un trazo nuevo.
  const celda = 3;
  const rejilla = new Map<string, number[]>();
  const clave = (x: number, y: number) => `${Math.floor(x / celda)},${Math.floor(y / celda)}`;
  borde.forEach(([x, y], i) => {
    const k = clave(x, y);
    const lista = rejilla.get(k);
    if (lista) lista.push(i);
    else rejilla.set(k, [i]);
  });
  const usado = new Uint8Array(borde.length);
  const vecino = (x: number, y: number): number => {
    let mejor = -1;
    let distancia = 2.9 * 2.9;
    const cx = Math.floor(x / celda);
    const cy = Math.floor(y / celda);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const i of rejilla.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (usado[i]) continue;
          const p = borde[i]!;
          const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
          if (d < distancia) {
            distancia = d;
            mejor = i;
          }
        }
      }
    }
    return mejor;
  };

  const inversa = 1 / escala;
  const anchoCss = caja.width;
  const trazos: Trazo[] = [];
  for (let inicio = 0; inicio < borde.length; inicio++) {
    if (usado[inicio]) continue;
    const cadena: Punto[] = [];
    let actual = inicio;
    while (actual >= 0) {
      usado[actual] = 1;
      const [x, y] = borde[actual]!;
      cadena.push([x * inversa - margen, y * inversa - margen]);
      actual = vecino(x, y);
    }
    if (cadena.length < 6) continue;
    // Uno de cada dos puntos basta para una curva suave.
    trazos.push(
      trazo(
        cadena.filter((_, i) => i % 2 === 0),
        anchoCss
      )
    );
  }
  trazos.sort((a, b) => a.inicio - b.inicio);
  return { trazos, ancho: caja.width, alto: caja.height };
}
