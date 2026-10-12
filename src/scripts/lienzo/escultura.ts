/**
 * escultura.ts
 * El guía: un robot de metal líquido que nace de una gota, viaja por la
 * página y señala los elementos de cada escena. El sombreador dibuja su
 * cuerpo; la página necesita saber dónde están su mano (el hilo que la une
 * con lo que señala) y sus anclas (de donde nacen los filamentos de la red),
 * así que la pose se calcula aquí una sola vez y viaja al sombreador como
 * uniforms.
 *
 * El brazo que señala se resuelve con cinemática inversa de dos huesos:
 * hombro, codo y mano alcanzan un punto del mundo (el elemento señalado,
 * llevado a la profundidad del robot), con el codo doblado hacia abajo y
 * hacia la cámara, como un brazo humano.
 *
 * Para que fluya: al viajar se estira, se inclina hacia donde va y suelta
 * una estela de gotas que lo siguen y se reabsorben al frenar.
 */

/** Nada del robot (ni su estela) sale de esta esfera: el sombreador no marcha fuera de ella. */
export const RADIO_LIMITE = 2.6;
/** Una rama de la red por servicio: siete anclas en el cuerpo del robot. */
export const RAMAS = 7;
/** Gotas de la estela que deja al viajar. */
export const GOTAS_DE_ESTELA = 3;

/**
 * Piezas que viajan al sombreador (vec4 cada una). Las articulaciones y las
 * gotas van ya colocadas en el mundo; `pose` y `viaje` llevan parámetros.
 */
export const PIEZA = {
  cabeza: 0,
  hombroIzq: 1,
  codoIzq: 2,
  manoIzq: 3,
  hombroDer: 4,
  codoDer: 5,
  manoDer: 6,
  antena: 7,
  /** x: estiramiento elástico, y: altura (con flotación), z: giro del cuerpo, w: velocidad. */
  pose: 8,
  /** x: inclinación hacia donde viaja; y: 0..1 de gota a robot (formación). */
  viaje: 9,
  /** Primera gota de la estela (x, y, z, radio); siguen GOTAS_DE_ESTELA. */
  estela: 10
} as const;
export const MAX_PIEZAS = PIEZA.estela + GOTAS_DE_ESTELA;

export type Vec3 = [number, number, number];

/** -1: señala con el brazo del lado izquierdo de la pantalla; 1, con el derecho. */
export type Brazo = -1 | 1;

export interface Pose {
  /** 0..1 por brazo (izquierdo, derecho): de colgar a alcanzar el objetivo. */
  gestos: [number, number];
  /** Punto del mundo que señala (ya a la profundidad del robot). */
  objetivo: Vec3;
  /** Giro del cuerpo alrededor del eje vertical (radianes). */
  giro: number;
  /** Estiramiento elástico: >0 se estira hacia arriba, <0 se aplasta. */
  elastico: number;
  /** 0..1: lo rápido que viaja por la pantalla (la cola se agita más). */
  velocidad: number;
  /** Inclinación hacia donde viaja (cizalla del cuerpo; positiva, hacia +x). */
  inclinacion: number;
  /** Dirección del viaje en el mundo (unitaria o nula): la estela queda detrás. */
  direccion: Vec3;
  /** 0 gota, 1 robot: la gota se condensa en el robot al cargar la página. */
  formacion: number;
  tiempo: number;
}

/** Altura a la que flota el robot: su centro visual queda en el origen. */
const ALTURA = -0.3;
const HOMBRO_IZQ: Vec3 = [-0.6, 0.48, 0];
const HOMBRO_DER: Vec3 = [0.6, 0.48, 0];
const CABEZA: Vec3 = [0, 1.08, 0];
/** Largo del brazo y del antebrazo. */
const HUESO = 0.42;

const suma = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const resta = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const escala = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const punto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const largo = (a: Vec3) => Math.hypot(...a);
const normalizar = (a: Vec3): Vec3 => escala(a, 1 / (largo(a) || 1));
const mezcla = (a: Vec3, b: Vec3, t: number): Vec3 => suma(a, escala(resta(b, a), t));

/**
 * Del espacio del robot al mundo: estiramiento que conserva el volumen
 * (alto ↑, ancho ↓), inclinación (cizalla según la altura), flotación y
 * giro. El sombreador deshace exactamente esta cuenta (función `robot`).
 */
function alMundo(v: Vec3, pose: Pose, flotacion: number): Vec3 {
  const alto = 1 + pose.elastico;
  const ancho = 1 - pose.elastico * 0.5;
  const y0 = v[1] * alto;
  const x = v[0] * ancho + y0 * pose.inclinacion;
  const y = y0 + ALTURA + flotacion;
  const z = v[2] * ancho;
  const c = Math.cos(pose.giro);
  const s = Math.sin(pose.giro);
  return [x * c + z * s, y, -x * s + z * c];
}

/** Inverso de alMundo: un punto del mundo en el espacio del robot. */
function alRobot(v: Vec3, pose: Pose, flotacion: number): Vec3 {
  const c = Math.cos(pose.giro);
  const s = Math.sin(pose.giro);
  const y0 = v[1] - ALTURA - flotacion;
  const x = v[0] * c - v[2] * s - y0 * pose.inclinacion;
  const z = v[0] * s + v[2] * c;
  const ancho = 1 - pose.elastico * 0.5;
  return [x / ancho, y0 / (1 + pose.elastico), z / ancho];
}

/**
 * Brazo de dos huesos que alcanza `objetivo` desde `hombro` (espacio del
 * robot). Si no llega, se estira hacia él; el codo se dobla hacia abajo y
 * hacia delante.
 */
function alcanzar(hombro: Vec3, objetivo: Vec3): [Vec3, Vec3] {
  const hacia = resta(objetivo, hombro);
  const dir = normalizar(hacia);
  const d = Math.min(Math.max(largo(hacia), 0.3), HUESO * 2 - 0.04);
  const mano = suma(hombro, escala(dir, d));
  const altura = Math.sqrt(Math.max(HUESO * HUESO - (d / 2) * (d / 2), 0));
  const preferido: Vec3 = [0, -1, 0.6];
  const polo = normalizar(resta(preferido, escala(dir, punto(preferido, dir))));
  const codo = suma(suma(hombro, escala(dir, d / 2)), escala(polo, altura));
  return [codo, mano];
}

/** Brazo en reposo: cuelga y se balancea como un péndulo blando. */
function colgar(hombro: Vec3, lado: number, t: number): [Vec3, Vec3] {
  const vaiven = 0.06 * Math.sin(t * 0.9 + lado);
  const codo = suma(hombro, [0.14 * lado, -0.44, 0.06 + vaiven]);
  return [codo, suma(codo, [0.06 * lado + vaiven * lado, -0.38, 0.12])];
}

/** Coloca las piezas del robot para esta pose (x, y, z, radio; ver PIEZA). */
export function robot(pose: Pose, destino = new Float32Array(MAX_PIEZAS * 4)): Float32Array {
  const t = pose.tiempo;
  const flotacion = 0.06 * Math.sin(t * 1.3);
  const suave = (g: number) => g * g * (3 - 2 * g);

  // Cada brazo pasa de colgar a alcanzar el objetivo según su gesto: al
  // cambiar de lado, uno baja mientras el otro sube, sin saltos.
  const objetivo = alRobot(pose.objetivo, pose, flotacion);
  objetivo[1] += 0.03 * Math.sin(t * 2.1); // un leve vaivén al señalar
  const brazo = (hombro: Vec3, lado: number, gesto: number): [Vec3, Vec3] => {
    const [codoR, manoR] = colgar(hombro, lado, t);
    if (gesto <= 0) return [codoR, manoR];
    const [codoS, manoS] = alcanzar(hombro, objetivo);
    const g = suave(gesto);
    return [mezcla(codoR, codoS, g), mezcla(manoR, manoS, g)];
  };
  const [codoIzq, manoIzq] = brazo(HOMBRO_IZQ, -1, pose.gestos[0]);
  const [codoDer, manoDer] = brazo(HOMBRO_DER, 1, pose.gestos[1]);

  // La antena sigue al cuerpo con retraso: se inclina al contrario del estiramiento y del viaje.
  const antena: Vec3 = [
    0.08 * Math.sin(t * 1.7) - pose.elastico * 0.5 - pose.inclinacion * 0.6,
    1.62,
    0.05 * Math.cos(t * 1.3)
  ];

  const piezas: [Vec3, number][] = [
    [CABEZA, 0.3],
    [HOMBRO_IZQ, 0.15],
    [codoIzq, 0.08],
    [manoIzq, 0.14],
    [HOMBRO_DER, 0.15],
    [codoDer, 0.08],
    [manoDer, 0.14],
    [antena, 0.07]
  ];
  piezas.forEach(([v, radio], i) => destino.set([...alMundo(v, pose, flotacion), radio], i * 4));
  destino.set([pose.elastico, ALTURA + flotacion, pose.giro, pose.velocidad], PIEZA.pose * 4);
  destino.set([pose.inclinacion, pose.formacion, 0, 0], PIEZA.viaje * 4);

  // Estela: gotas cada vez más pequeñas detrás del cuerpo, que ondulan y se
  // reabsorben (radio 0) cuando el robot se detiene.
  const v = Math.min(1, pose.velocidad);
  for (let k = 0; k < GOTAS_DE_ESTELA; k++) {
    const u = (k + 1) / GOTAS_DE_ESTELA;
    const distancia = (0.55 + 0.75 * u) * (0.4 + 0.6 * v);
    const ondula = 0.08 * Math.sin(t * 3 - k * 1.3) * v;
    const centro = suma([0, -0.05 + ondula, ondula * 0.5], escala(pose.direccion, -distancia));
    const radio = v < 0.04 ? 0 : (0.2 - 0.05 * k) * Math.min(1, v * 1.6);
    destino.set([...centro, radio], (PIEZA.estela + k) * 4);
  }
  return destino;
}

/** Índice (en PIEZA) de la mano que señala con este brazo. */
export const manoDe = (brazo: Brazo) => (brazo < 0 ? PIEZA.manoIzq : PIEZA.manoDer);

/**
 * Las siete anclas de la red en el cuerpo del robot, una por servicio:
 * antena, cabeza, las dos manos, los dos hombros y la gota de abajo.
 * Mientras es gota, salen de su superficie.
 */
const PIEZAS_ANCLA = [
  PIEZA.antena,
  PIEZA.cabeza,
  PIEZA.manoIzq,
  PIEZA.manoDer,
  PIEZA.hombroIzq,
  PIEZA.hombroDer,
  -1
] as const;

const DIRECCIONES: Vec3[] = Array.from({ length: RAMAS }, (_, i) => {
  const y = 0.78 - (i / (RAMAS - 1)) * 1.56;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.39996 + 0.6;
  return normalizar([Math.cos(a) * r, y, Math.sin(a) * r * 0.7 + 0.3]);
});

export function anclas(piezas: Float32Array, destino: Vec3[] = []): Vec3[] {
  const formacion = piezas[PIEZA.viaje * 4 + 1] ?? 1;
  const alturaCuerpo = piezas[PIEZA.pose * 4 + 1] ?? ALTURA;
  for (let i = 0; i < RAMAS; i++) {
    const indice = PIEZAS_ANCLA[i] ?? -1;
    const enRobot: Vec3 =
      indice < 0
        ? [0, alturaCuerpo - 0.75, 0]
        : [piezas[indice * 4] ?? 0, piezas[indice * 4 + 1] ?? 0, piezas[indice * 4 + 2] ?? 0];
    const enGota = escala(DIRECCIONES[i] ?? [0, 1, 0], 1.05);
    destino[i] = mezcla(enGota, enRobot, formacion);
  }
  return destino;
}
