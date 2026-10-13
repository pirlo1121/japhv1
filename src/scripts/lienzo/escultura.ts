/**
 * escultura.ts
 * La materia viva de la escena: una gota de cromo líquido que flota y, al
 * bajar a la segunda escena, se estira en una cinta curva que recorre la
 * arquitectura. Es el contrapunto orgánico de los monolitos.
 *
 * La cinta son dos curvas de Bézier cuadráticas encadenadas (cinco puntos
 * de control, con su grosor en cada uno): el sombreador mide la distancia a
 * ellas y la página sabe dónde está cada tramo (las ramas de la red nacen
 * a lo largo de la cinta). Su trazado cambia con cada escena
 * (arquitectura.ts); aquí se le suma lo que la hace líquida: flota,
 * ondula y respira.
 *
 * Todo viaja al sombreador como uniforms (LIQUIDO): la cuenta se hace una
 * vez por fotograma.
 */

export type Vec3 = [number, number, number];

/** Una rama de la red por servicio: siete anclas a lo largo de la escultura. */
export const RAMAS = 7;

/** La cinta: cinco puntos de control (dos Bézier cuadráticas) y su grosor en cada uno. */
export interface Cinta {
  puntos: [Vec3, Vec3, Vec3, Vec3, Vec3];
  radios: [number, number, number, number, number];
}

/**
 * Lo que viaja al sombreador (vec4 cada uno):
 *   gota    centro de la gota (x, y, z) y forma (0 gota … 1 cinta)
 *   cinta   cinco puntos (x, y, z, grosor)
 *   esfera  esfera que contiene todo el líquido: solo se marcha dentro de ella
 */
export const LIQUIDO = { gota: 0, cinta: 1, esfera: 6 } as const;
export const MAX_LIQUIDO = LIQUIDO.esfera + 1;

/** Vaivén vertical al flotar (unidades del mundo): más amplio de gota que de cinta. */
const FLOTACION = { gota: 0.16, cinta: 0.07 };
/** Ondulación de la cinta: amplitud de cada punto de control y rapidez. */
const ONDULACION = { amplitud: 0.09, rapidez: 0.7 };
/** Radio de la gota (el mismo que en el sombreador): de su superficie salen las ramas mientras es gota. */
const RADIO_GOTA = 1.05;

const suave = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};
const mezcla = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
];

export interface Pose {
  /** 0 gota, 1 cinta. */
  forma: number;
  /** El trazado de la cinta en esta escena (ya interpolado entre planos). */
  cinta: Cinta;
  /** Tiempo del movimiento interno (fase integrada). */
  tiempo: number;
}

/** Coloca la gota y la cinta para esta pose (ver LIQUIDO). */
export function liquido(pose: Pose, destino = new Float32Array(MAX_LIQUIDO * 4)): Float32Array {
  const t = pose.tiempo;
  const s = suave(pose.forma);
  const amplitud = FLOTACION.gota + (FLOTACION.cinta - FLOTACION.gota) * s;
  const flotacion = amplitud * Math.sin(t * 1.3);
  // La gota: su centro sube y baja (el sombreador la centra aquí).
  destino.set([0, flotacion, 0, pose.forma], LIQUIDO.gota * 4);

  // La cinta nace del centro de la gota: con forma 0 sus puntos están
  // recogidos dentro de ella; con forma 1, en su trazado.
  let cx = 0;
  let cy = 0;
  let cz = 0;
  const puntos = pose.cinta.puntos.map((p, i): Vec3 => {
    const fase = t * ONDULACION.rapidez + i * 1.7;
    const onda = ONDULACION.amplitud * s;
    const recogido: Vec3 = [p[0] * 0.18, p[1] * 0.18 + flotacion, p[2] * 0.18];
    const extendido: Vec3 = [
      p[0] + Math.sin(fase) * onda,
      p[1] + flotacion + Math.cos(fase * 0.8) * onda,
      p[2] + Math.sin(fase * 1.3) * onda * 0.6
    ];
    const q = mezcla(recogido, extendido, s);
    // Un punto exactamente en línea con sus vecinos anula la curva en el sombreador.
    q[1] += i % 2 === 0 ? 0.0007 : -0.0007;
    cx += q[0];
    cy += q[1];
    cz += q[2];
    return q;
  });
  puntos.forEach((p, i) => {
    destino.set([...p, pose.cinta.radios[i] ?? 0.2], (LIQUIDO.cinta + i) * 4);
  });

  // Esfera límite: el centro de los puntos y lo más lejos que llega la cinta (o la gota).
  const centro: Vec3 = [cx / 5, cy / 5, cz / 5];
  let radio = RADIO_GOTA * 1.5 + Math.hypot(centro[0], centro[1] - flotacion, centro[2]);
  puntos.forEach((p, i) => {
    const r = Math.hypot(p[0] - centro[0], p[1] - centro[1], p[2] - centro[2]);
    radio = Math.max(radio, r + (pose.cinta.radios[i] ?? 0.2) + 0.35);
  });
  destino.set([...centro, radio], LIQUIDO.esfera * 4);
  return destino;
}

/** Punto de una Bézier cuadrática. */
function bezier(a: Vec3, b: Vec3, c: Vec3, t: number): Vec3 {
  return mezcla(mezcla(a, b, t), mezcla(b, c, t), t);
}

/** Direcciones de las anclas sobre la gota (repartidas en espiral, hacia la cámara). */
const DIRECCIONES: Vec3[] = Array.from({ length: RAMAS }, (_, i) => {
  const y = 0.78 - (i / (RAMAS - 1)) * 1.56;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.39996 + 0.6;
  const v: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r * 0.7 + 0.3];
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
});

/**
 * Las siete anclas de la red, una por servicio: sobre la superficie de la
 * gota mientras es gota; repartidas a lo largo de la cinta cuando se estira.
 */
export function anclas(piezas: Float32Array, destino: Vec3[] = []): Vec3[] {
  const forma = suave(piezas[LIQUIDO.gota * 4 + 3] ?? 0);
  const flotacion = piezas[LIQUIDO.gota * 4 + 1] ?? 0;
  const p = (i: number): Vec3 => {
    const k = (LIQUIDO.cinta + i) * 4;
    return [piezas[k] ?? 0, piezas[k + 1] ?? 0, piezas[k + 2] ?? 0];
  };
  for (let i = 0; i < RAMAS; i++) {
    const d = DIRECCIONES[i] ?? [0, 1, 0];
    const enGota: Vec3 = [d[0] * RADIO_GOTA, d[1] * RADIO_GOTA + flotacion, d[2] * RADIO_GOTA];
    // A lo largo de la cinta, sin sus extremos (allí es casi un hilo).
    const u = 0.12 + (i / (RAMAS - 1)) * 0.76;
    const enCinta = u < 0.5 ? bezier(p(0), p(1), p(2), u * 2) : bezier(p(2), p(3), p(4), u * 2 - 1);
    destino[i] = mezcla(enGota, enCinta, forma);
  }
  return destino;
}
