/**
 * escultura.ts
 * La escultura de metal líquido descrita como datos. El sombreador dibuja
 * sus formas y la red viva (red.ts) hace nacer sus filamentos de la
 * superficie, así que los puntos que ambos necesitan se calculan aquí con
 * las mismas cuentas que el GLSL.
 *
 * Las formas, en el orden de la historia (uForma va de 0 a 4 y el
 * sombreador funde cada una con la siguiente):
 *   0 masa        la gota original: una masa líquida, casi quieta
 *   1 cinta       la masa se estira en una cinta curva que se retuerce
 *   2 núcleo      la cinta se pliega alrededor de un núcleo de obsidiana
 *   3 portal      un aro que enmarca el trabajo
 *   4 ecosistema  un núcleo y siete módulos en órbita: todo conectado
 *
 * Cada forma tiene siete anclas, una por servicio (datos/servicios.ts): de
 * ellas salen los filamentos que unen la escultura con la red.
 */

export const FORMAS = 5;
/** Una rama por servicio: anclas en la escultura y nodos principales de la red. */
export const RAMAS = 7;
/** Ninguna forma sale de esta esfera: el sombreador no marcha fuera de ella. */
export const RADIO_LIMITE = 2.35;

/** Medidas compartidas con el sombreador. */
export const CINTA = { alto: 0.42, onda: 0.34 } as const;
export const NUCLEO = { cascara: 0.72, interior: 0.54, arco: 1.18, inclinacion: 0.35 } as const;
export const PORTAL = { radio: 1.3, grosor: 0.12, giroXY: 0.22, giroYZ: 1.32 } as const;
export const ORBITA = { radio: 1.55, inclinacion: 0.32, velocidad: 0.12 } as const;

export type Vec3 = [number, number, number];

const TAU = Math.PI * 2;

/**
 * Deshace `v.ab *= rot(a)` del sombreador: allí el par pasa al espacio
 * local girado +a; aquí vuelve al mundo girando -a.
 */
function desgirar(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + y * s, -x * s + y * c];
}

/** Siete direcciones repartidas en una esfera (espiral de Fibonacci), algo hacia la cámara. */
const DIRECCIONES: Vec3[] = Array.from({ length: RAMAS }, (_, i) => {
  const y = 0.78 - (i / (RAMAS - 1)) * 1.56;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.39996 + 0.6;
  const d: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r * 0.7 + 0.3];
  const l = Math.hypot(...d) || 1;
  return [d[0] / l, d[1] / l, d[2] / l];
});

const sobreEsfera = (i: number, radio: number): Vec3 => {
  const d = DIRECCIONES[i] ?? [0, 1, 0];
  return [d[0] * radio, d[1] * radio, d[2] * radio];
};

/** Sobre el filo de la cinta, alternando el borde de arriba y el de abajo. */
function anclaCinta(i: number, T: number): Vec3 {
  const x = -1.55 + (i * 3.1) / (RAMAS - 1);
  const borde = i % 2 === 0 ? CINTA.alto : -CINTA.alto;
  const [y, z] = desgirar(borde, 0, x * 0.8 + T * 0.25);
  return [x, y + CINTA.onda * Math.sin(x * 1.3 + T * 0.6), z];
}

function anclaPortal(i: number): Vec3 {
  const a = (i / RAMAS) * TAU + 0.4;
  const r = PORTAL.radio + PORTAL.grosor;
  const [y1, z1] = desgirar(0, Math.sin(a) * r, PORTAL.giroYZ);
  const [x2, y2] = desgirar(Math.cos(a) * r, y1, PORTAL.giroXY);
  return [x2, y2, z1];
}

/** Los siete módulos en órbita. Tienen el mismo índice que su servicio. */
export function moduloEcosistema(i: number, T: number): Vec3 {
  const a = (i * TAU) / RAMAS + T * ORBITA.velocidad;
  const [x, y] = desgirar(Math.cos(a) * ORBITA.radio, 0, ORBITA.inclinacion);
  return [x, y, Math.sin(a) * ORBITA.radio];
}

function anclaDe(forma: number, i: number, T: number): Vec3 {
  switch (forma) {
    case 0:
      return sobreEsfera(i, 1.05);
    case 1:
      return anclaCinta(i, T);
    case 2:
      // En la cáscara del núcleo: los filamentos salen de sus grietas.
      return sobreEsfera(i, NUCLEO.cascara + 0.07);
    case 3:
      return anclaPortal(i);
    default:
      return moduloEcosistema(i, T);
  }
}

/**
 * Anclas de los filamentos para una forma intermedia: se funden de una
 * forma a la siguiente con la misma curva que el sombreador.
 * `T` es el tiempo del movimiento interno (tiempo × flujo).
 */
export function anclas(forma: number, T: number, destino: Vec3[] = []): Vec3[] {
  const x = Math.min(Math.max(forma, 0), FORMAS - 1);
  const k = Math.floor(x);
  let s = x - k;
  s = s * s * (3 - 2 * s);
  for (let i = 0; i < RAMAS; i++) {
    const a = anclaDe(k, i, T);
    const b = s > 0.002 && k < FORMAS - 1 ? anclaDe(k + 1, i, T) : a;
    destino[i] = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
  }
  return destino;
}
