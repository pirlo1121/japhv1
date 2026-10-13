/**
 * arquitectura.ts
 * La arquitectura monumental: el lenguaje visual dominante de la portada.
 * Un juego fijo de piezas (monolitos, un dintel, losas, tiras de luz y
 * cuatro marcos con hueco) y un plano por capítulo que dice dónde está
 * cada una, cuánto se ve y cuánta luz recogen sus aristas. No aparece nada
 * sin causa: cada capítulo reutiliza y transforma las piezas del anterior.
 *
 * El scroll solo mueve un número (estado.escena, 0..5). Entre dos planos
 * las piezas se desplazan, giran y aparecen o se funden en la oscuridad:
 * el monolito se abre en pórtico (transformación), sus piezas forman siete
 * módulos (capacidades), cuatro puertas (método), los nichos de una
 * galería (evidencia) y, al final, el pórtico se recompone (apertura).
 * Es determinista y reversible: al subir, la estructura se recompone igual.
 *
 * Cada plano se escribe en el marco de su cámara (x a la derecha de la
 * pantalla, z hacia el espectador) y se lleva al mundo girándolo con `az`.
 * El sombreador interseca las piezas analíticamente (sin marchar rayos):
 * bordes nítidos y barato también en móvil, donde las piezas secundarias
 * sin función en su capítulo no se envían.
 */
import type { Cinta, Vec3 } from './escultura';

/** Piezas que el sombreador puede recibir a la vez. */
export const MAX_CAJAS = 14;
/** vec4 por pieza: A (centro, giro), B (semiejes, tipo), C (aristas, emisión, presencia, pulido), D (hueco, luz fría). */
export const VEC4_POR_CAJA = 4;

export const TIPO = { mate: 0, emisivo: 1, marco: 2 } as const;
type Tipo = (typeof TIPO)[keyof typeof TIPO];

interface Ranura {
  nombre: string;
  tipo: Tipo;
  /** En pantallas pequeñas no se envía: la composición se simplifica. */
  secundaria?: boolean;
}

/** Las piezas, siempre en este orden (sus índices son estables entre planos). */
const RANURAS = [
  { nombre: 'izquierda', tipo: TIPO.mate },
  { nombre: 'derecha', tipo: TIPO.mate },
  { nombre: 'dintel', tipo: TIPO.mate },
  { nombre: 'losa', tipo: TIPO.mate, secundaria: true },
  { nombre: 'lejana', tipo: TIPO.mate, secundaria: true },
  { nombre: 'lejana2', tipo: TIPO.mate, secundaria: true },
  { nombre: 'fondo', tipo: TIPO.mate },
  { nombre: 'tira1', tipo: TIPO.emisivo },
  { nombre: 'tira2', tipo: TIPO.emisivo, secundaria: true },
  { nombre: 'puerta1', tipo: TIPO.marco },
  { nombre: 'puerta2', tipo: TIPO.marco },
  { nombre: 'puerta3', tipo: TIPO.marco },
  { nombre: 'puerta4', tipo: TIPO.marco, secundaria: true },
  { nombre: 'columna', tipo: TIPO.mate, secundaria: true }
] as const satisfies readonly Ranura[];

type Nombre = (typeof RANURAS)[number]['nombre'];

interface Pieza {
  /** Centro y semiejes (unidades del mundo; la gota mide 1.05 de radio). */
  c: Vec3;
  h: Vec3;
  /** Giro alrededor del eje vertical (radianes), en el marco del plano. */
  giro?: number;
  /** 0..1: luz que recogen sus aristas (el metal que revela la escala). */
  aristas?: number;
  /** 0..1: intensidad (tiras) o luz interior (marcos). */
  emision?: number;
  /** 0..1: cuánto emerge de la oscuridad. */
  presencia?: number;
  /** 0 grafito mate … 1 cromo negro pulido. */
  pulido?: number;
  /** Marcos: semiejes del hueco (x, y), que atraviesa la pieza en z. */
  hueco?: [number, number];
}

interface Plano {
  /** Azimut del marco del plano (el de su cámara). */
  az: number;
  piezas: Partial<Record<Nombre, Pieza>>;
  /** Luz principal: posición (marco del plano) e intensidad. */
  luz: { p: Vec3; i: number };
  /** Trazado de la cinta (marco del plano). */
  cinta: Cinta;
}

/**
 * La cinta se escribe a escala de la escena y se reduce aquí: la
 * arquitectura manda y la escultura es el contrapunto. Grosor mínimo de sus
 * puntas (redondeadas, no un colmillo).
 */
const CINTA = { escala: 0.7, desvio: [0.35, 0, 0] as Vec3, puntaMinima: 0.15 };

/**
 * Un monolito partido en dos mitades (izquierda y derecha) con un giro: con
 * `abertura` 0 se lee como un solo bloque; al abrirse, sus mitades se
 * separan a lo largo de su propio eje y dejan un paso.
 */
function monolito(
  centro: Vec3,
  mitad: Vec3,
  giro: number,
  abertura: number,
  extra: Omit<Pieza, 'c' | 'h' | 'giro'> = {}
): Pick<Record<Nombre, Pieza>, 'izquierda' | 'derecha'> {
  const eje: Vec3 = [Math.cos(giro), 0, -Math.sin(giro)];
  const d = mitad[0] + abertura / 2;
  const lado = (k: number): Pieza => ({
    ...extra,
    c: [centro[0] + eje[0] * d * k, centro[1], centro[2] + eje[2] * d * k],
    h: mitad,
    giro
  });
  return { izquierda: lado(-1), derecha: lado(1) };
}

/**
 * Los seis planos, uno por capítulo de la portada. Las piezas que un plano
 * no nombra se quedan donde las deja el plano más cercano que sí las
 * nombra, fundidas en la oscuridad (presencia 0). Cada paso entre planos
 * conecta dos estados reconocibles con las mismas piezas: el monolito se
 * abre en pórtico; sus mitades y su dintel se vuelven columnas; las
 * puertas del método se vuelven los nichos de la galería; y al final el
 * dintel vuelve a su sitio y el pórtico del principio se recompone.
 */
const PLANOS: Plano[] = [
  // 01 · Presencia: un monolito enorme en la penumbra, girado para mostrar
  // su esquina: dos caras, una arista que recoge la luz. Delante, la gota.
  // Un solo gesto: nada más que el suelo y una pieza lejana que da escala.
  {
    az: 0.5,
    luz: { p: [-7, 9, 5], i: 1.1 },
    piezas: {
      ...monolito([1.4, -2.6, -9], [1.35, 5.2, 1.2], 0.62, 0, { aristas: 0.85, pulido: 0.25 }),
      tira1: { c: [-1.25, -2.6, -6.5], h: [0.012, 5.0, 0.012], emision: 0.45, presencia: 0.8 },
      losa: { c: [-5.5, -4.4, -5], h: [3.6, 0.16, 2.4], giro: -0.25, aristas: 0.5, presencia: 0.6 },
      lejana: { c: [-11, 2.5, -19], h: [1.3, 11, 1.3], giro: 0.3, aristas: 0.45, presencia: 0.5 }
    },
    cinta: {
      puntos: [
        [-2.2, -1.1, 1.0],
        [-0.6, 1.6, 0.2],
        [0.6, 0.0, -1.4],
        [1.4, -1.4, -3.4],
        [1.2, 0.6, -5.4]
      ],
      radios: [0.07, 0.34, 0.42, 0.3, 0.08]
    }
  },
  // 02 · Transformación: el monolito se abre en un pórtico y la gota,
  // estirada en curva, lo atraviesa: nace delante, a la izquierda, y se
  // pierde por la abertura hacia la luz del fondo.
  {
    az: 0.95,
    luz: { p: [-6, 7, 3], i: 1.1 },
    piezas: {
      ...monolito([1.15, -1.5, -6.2], [1.0, 2.8, 0.9], 0, 3.2, { aristas: 0.9, pulido: 0.25 }),
      dintel: { c: [1.15, 1.7, -6.2], h: [3.6, 0.4, 0.95], aristas: 0.95, pulido: 0.3 },
      tira1: { c: [1.15, -1.5, -9.4], h: [0.012, 2.7, 0.012], emision: 0.9 },
      losa: { c: [1.15, -4.46, -4.6], h: [4.0, 0.16, 3.2], aristas: 0.45, presencia: 0.7 },
      fondo: { c: [1.2, 0, -16], h: [11, 11, 0.4], aristas: 0.15, presencia: 0.4 }
    },
    cinta: {
      // Escrita para cruzar la abertura (x de -0.45 a 2.75, y bajo el
      // dintel) con la escala y el desvío de CINTA: nace a la derecha del
      // texto, se arquea y se pierde por el pórtico hacia la luz del fondo.
      puntos: [
        [-2.64, 0.86, -1.43],
        [-1.07, 2.57, -3.57],
        [0.36, -0.43, -6.0],
        [1.14, -1.71, -8.86],
        [1.14, -1.29, -12.86]
      ],
      radios: [0.08, 0.4, 0.46, 0.34, 0.14]
    }
  },
  // 03 · Capacidades: una columnata de siete losas, una por servicio (se
  // ilumina la del activo). Las mitades del pórtico y su dintel son tres
  // de ellas.
  {
    az: 0.3,
    luz: { p: [-6, 9, 4], i: 0.95 },
    piezas: {
      // Losas altas que salen del cuadro, a dos profundidades, juntas a la
      // derecha de la lista: ninguna queda detrás del texto.
      lejana: {
        c: [-2.85, 1.2, -9.0],
        h: [0.42, 6.5, 0.42],
        giro: 0.06,
        aristas: 0.55,
        presencia: 1
      },
      izquierda: { c: [-1.8, 1.2, -7.8], h: [0.42, 6.5, 0.42], giro: 0.04, aristas: 0.55 },
      columna: {
        c: [-0.75, 1.2, -9.0],
        h: [0.42, 6.5, 0.42],
        giro: 0.02,
        aristas: 0.55,
        presencia: 1
      },
      derecha: { c: [0.3, 1.2, -7.8], h: [0.42, 6.5, 0.42], aristas: 0.55 },
      lejana2: {
        c: [1.35, 1.2, -9.0],
        h: [0.42, 6.5, 0.42],
        giro: -0.02,
        aristas: 0.55,
        presencia: 1
      },
      losa: { c: [2.4, 1.2, -7.8], h: [0.42, 6.5, 0.42], giro: -0.04, aristas: 0.55, presencia: 1 },
      dintel: { c: [3.45, 1.2, -9.0], h: [0.42, 6.5, 0.42], giro: -0.06, aristas: 0.55 },
      fondo: { c: [0, 0, -18], h: [14, 10, 0.4], aristas: 0.12, presencia: 0.3 },
      tira1: { c: [0.3, -3.6, -6.8], h: [4.2, 0.01, 0.01], emision: 0.3 }
    },
    cinta: {
      // Baja y en horizontal, delante de la base de la columnata: la curva
      // pasa por los siete módulos, los conecta y no compite con ellos.
      puntos: [
        [-4.79, -3.43, -7.14],
        [-2.5, -4.57, -6.29],
        [-0.07, -3.71, -7.43],
        [2.21, -2.86, -8.57],
        [4.07, -3.86, -7.71]
      ],
      radios: [0.05, 0.2, 0.24, 0.2, 0.06]
    }
  },
  // 04 · Método: cuatro puertas en un camino que se adentra, una por fase;
  // se enciende la de la fase actual. La curva (el proyecto) las cruza en
  // orden.
  {
    az: 0.25,
    luz: { p: [-4, 8, 4], i: 0.9 },
    piezas: {
      puerta1: {
        c: [-2.6, -0.2, -4.0],
        h: [0.9, 1.4, 0.28],
        hueco: [0.6, 1.1],
        aristas: 0.45
      },
      puerta2: {
        c: [-0.4, -0.2, -6.6],
        h: [0.9, 1.4, 0.28],
        hueco: [0.6, 1.1],
        aristas: 0.45,
        presencia: 1
      },
      puerta3: {
        c: [1.8, -0.2, -9.2],
        h: [0.9, 1.4, 0.28],
        hueco: [0.6, 1.1],
        aristas: 0.45,
        presencia: 1
      },
      puerta4: {
        c: [4.0, -0.2, -11.8],
        h: [0.9, 1.4, 0.28],
        hueco: [0.6, 1.1],
        aristas: 0.45,
        presencia: 1
      },
      losa: { c: [0.7, -1.72, -8], h: [5.5, 0.12, 5.5], giro: 0.4, aristas: 0.3, presencia: 0.6 },
      tira1: { c: [0.7, -1.59, -8], h: [0.01, 0.01, 5.2], giro: 0.7, emision: 0.45 },
      fondo: { c: [2, 0, -22], h: [16, 11, 0.4], aristas: 0.12, presencia: 0.3 }
    },
    cinta: {
      // Por los huecos de las tres primeras puertas, camino de la cuarta.
      puntos: [
        [-5.64, -0.14, -3.71],
        [-5.07, -0.71, -4.86],
        [-1.07, -0.14, -9.43],
        [2.21, 0.57, -13.43],
        [4.21, -0.29, -15.71]
      ],
      radios: [0.06, 0.24, 0.28, 0.24, 0.1]
    }
  },
  // 05 · Evidencia: las puertas se vuelven los nichos de una galería en un
  // muro oscuro. La escena se calla para que hablen los proyectos.
  {
    az: 0.55,
    luz: { p: [-2, 8, 5], i: 0.9 },
    piezas: {
      puerta1: {
        c: [-5.4, 0, -7.5],
        h: [2.0, 2.7, 0.8],
        hueco: [1.65, 2.3],
        aristas: 0.6,
        emision: 0.2
      },
      puerta2: {
        c: [0, 0, -7.5],
        h: [2.0, 2.7, 0.8],
        hueco: [1.65, 2.3],
        aristas: 0.6,
        emision: 0.2
      },
      puerta3: {
        c: [5.4, 0, -7.5],
        h: [2.0, 2.7, 0.8],
        hueco: [1.65, 2.3],
        aristas: 0.6,
        emision: 0.2
      },
      fondo: { c: [0, 0, -8.6], h: [9, 4.2, 0.3], aristas: 0.25, presencia: 1, pulido: 0.4 },
      dintel: { c: [0, 3.6, -7.5], h: [8.5, 0.35, 1.0], aristas: 0.5 },
      losa: { c: [0, -3.2, -6], h: [8.5, 0.16, 2.6], aristas: 0.4, presencia: 0.8 }
    },
    cinta: {
      puntos: [
        [-0.8, 1.2, 0.5],
        [0.4, -0.6, 1.0],
        [1.2, 0.6, 0.0],
        [2.0, 1.2, -0.8],
        [2.6, 0.2, -1.4]
      ],
      radios: [0.05, 0.22, 0.28, 0.2, 0.05]
    }
  },
  // 06 · Apertura: la complejidad se retira. El dintel vuelve a su sitio y
  // el pórtico del capítulo 02 se recompone, de frente y en calma; la curva
  // vuelve a cruzarlo, despacio, y una línea de luz en el suelo lleva a la
  // invitación.
  {
    az: 0.3,
    luz: { p: [-3, 7, 6], i: 0.9 },
    piezas: {
      ...monolito([0, -1.6, -7], [0.8, 2.6, 0.8], 0, 3.4, { aristas: 0.8, pulido: 0.25 }),
      dintel: { c: [0, 1.35, -7], h: [3.3, 0.35, 0.85], aristas: 0.85, pulido: 0.3 },
      tira1: { c: [0, -4.19, -3.2], h: [0.012, 0.012, 3.6], emision: 0.7 },
      losa: { c: [0, -4.34, -4.5], h: [4.0, 0.14, 4.2], aristas: 0.4, presencia: 0.8 },
      fondo: { c: [0, 0, -18], h: [14, 10, 0.4], aristas: 0.1, presencia: 0.3 }
    },
    cinta: {
      puntos: [
        [-3.93, 0.29, 0.0],
        [-2.5, 1.29, -4.29],
        [-0.79, -0.57, -8.57],
        [0.07, -1.43, -12.14],
        [-0.36, -0.86, -15.71]
      ],
      radios: [0.05, 0.26, 0.3, 0.24, 0.1]
    }
  }
];

/** Orden de los módulos de servicios (de izquierda a derecha en el capítulo 03). */
const MODULOS_DE_SERVICIOS: Nombre[] = [
  'lejana',
  'izquierda',
  'columna',
  'derecha',
  'lejana2',
  'losa',
  'dintel'
];
/** Las cuatro puertas del método (capítulo 04), en orden. */
const PUERTAS: Nombre[] = ['puerta1', 'puerta2', 'puerta3', 'puerta4'];
/** Índices de plano de capacidades (servicios) y método (proceso). */
const ESCENA = { servicios: 2, proceso: 3 } as const;

/** Cada plano con todas sus piezas: las que no nombra, desde el plano más cercano, sin presencia. */
const COMPLETOS: Record<Nombre, Required<Pieza>>[] = PLANOS.map((_, i) => {
  const completo = {} as Record<Nombre, Required<Pieza>>;
  for (const { nombre } of RANURAS) {
    let pieza = PLANOS[i]!.piezas[nombre];
    let presente = true;
    for (let d = 1; !pieza && d < PLANOS.length; d++) {
      // Del plano anterior primero: lo que acaba de irse se queda donde estaba.
      const j = [i - d, i + d].find((k) => PLANOS[k]?.piezas[nombre]);
      if (j === undefined) continue;
      pieza = PLANOS[j]!.piezas[nombre];
      presente = false;
      // La pieza está en el marco de otro plano: se lleva al de este.
      if (pieza) pieza = { ...pieza, ...enMarco(pieza, PLANOS[j]!.az, PLANOS[i]!.az) };
    }
    const p = pieza ?? { c: [0, -60, -60], h: [0.1, 0.1, 0.1] };
    completo[nombre] = {
      c: p.c,
      h: p.h,
      giro: p.giro ?? 0,
      aristas: p.aristas ?? 0.6,
      emision: p.emision ?? 0,
      presencia: presente ? (p.presencia ?? 1) : 0,
      pulido: p.pulido ?? 0.15,
      hueco: p.hueco ?? [0, 0]
    };
  }
  return completo;
});

/** Centro y giro de una pieza escrita en el marco `desde`, en el marco `hacia`. */
function enMarco(p: Pieza, desde: number, hacia: number): Pick<Pieza, 'c' | 'giro'> {
  const mundo = alMundo(p.c, desde);
  const a = -hacia;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    c: [mundo[0] * c + mundo[2] * s, mundo[1], -mundo[0] * s + mundo[2] * c],
    giro: (p.giro ?? 0) + desde - hacia
  };
}

/** Del marco de un plano (girado `az` alrededor del eje vertical) al mundo. */
function alMundo(v: Vec3, az: number): Vec3 {
  const c = Math.cos(az);
  const s = Math.sin(az);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

const suave = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t)
];

export interface EstadoDeArquitectura {
  /** Plano continuo (0..5). */
  escena: number;
  /** Servicio activo (−1 ninguno) y su brillo suavizado. */
  foco: number;
  brilloFoco: number;
  /** Fase del método (0..4). */
  etapa: number;
  /** 0..1: cuánto ha emergido la estructura (al cargar sale de la oscuridad). */
  revelado: number;
  /** Composición simplificada (móvil): sin piezas secundarias que no tengan función. */
  ligera: boolean;
}

export interface Arquitectura {
  /** MAX_CAJAS × VEC4_POR_CAJA vec4 (ver VEC4_POR_CAJA); solo las piezas visibles, al principio. */
  cajas: Float32Array;
  numCajas: number;
  /** Luz principal (x, y, z, intensidad), en el mundo. */
  luz: Float32Array;
  /** Trazado de la cinta, en el mundo. */
  cinta: Cinta;
}

/** La arquitectura para este estado: interpola entre los dos planos vecinos y la empaqueta. */
export function arquitectura(e: EstadoDeArquitectura, destino?: Arquitectura): Arquitectura {
  const salida: Arquitectura = destino ?? {
    cajas: new Float32Array(MAX_CAJAS * VEC4_POR_CAJA * 4),
    numCajas: 0,
    luz: new Float32Array(4),
    cinta: {
      puntos: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ],
      radios: [0, 0, 0, 0, 0]
    }
  };
  const ultimo = PLANOS.length - 1;
  const escena = Math.min(Math.max(e.escena, 0), ultimo);
  const i = Math.min(Math.floor(escena), ultimo - 1);
  const t = suave(escena - i);
  const a = PLANOS[i]!;
  const b = PLANOS[i + 1]!;
  const piezasA = COMPLETOS[i]!;
  const piezasB = COMPLETOS[i + 1]!;
  const az = lerp(a.az, b.az, t);
  // Cuánto pesan las escenas con piezas interactivas (para encender módulos y puertas).
  const peso = (k: number) => 1 - Math.min(1, Math.abs(escena - k));

  let n = 0;
  RANURAS.forEach((ranura) => {
    if (n >= MAX_CAJAS) return;
    const pa = piezasA[ranura.nombre];
    const pb = piezasB[ranura.nombre];
    // Cada pieza se interpola en el mundo (los marcos de los dos planos difieren).
    const ca = alMundo(pa.c, a.az);
    const cb = alMundo(pb.c, b.az);
    const centro = lerp3(ca, cb, t);
    const giro = lerp(pa.giro + a.az, pb.giro + b.az, t);
    const modulo = MODULOS_DE_SERVICIOS.indexOf(ranura.nombre);
    const puerta = PUERTAS.indexOf(ranura.nombre);
    let presencia = lerp(pa.presencia, pb.presencia, t) * e.revelado;
    // En la composición ligera las piezas secundarias se van, salvo cuando
    // son un módulo o una puerta en su capítulo: siete servicios son siete
    // losas y cuatro fases, cuatro puertas, también en móvil.
    if (e.ligera && 'secundaria' in ranura && ranura.secundaria) {
      const funcion = Math.max(
        modulo >= 0 ? peso(ESCENA.servicios) : 0,
        puerta >= 0 ? peso(ESCENA.proceso) : 0
      );
      presencia *= funcion;
    }
    if (presencia < 0.01) return;
    let aristas = lerp(pa.aristas, pb.aristas, t);
    let emision = lerp(pa.emision, pb.emision, t);
    /** Cuánto de su luz es azul frío: solo lo que señala un estado activo. */
    let frio = 0;

    // Capacidades: el módulo del servicio activo recoge luz fría.
    if (modulo >= 0 && modulo === e.foco) {
      const w = peso(ESCENA.servicios) * e.brilloFoco;
      aristas = lerp(aristas, 1, w);
      emision = lerp(emision, 1, w);
      frio = w;
    }
    // Método: la puerta de la fase actual se enciende; las ya recorridas quedan a media luz.
    if (puerta >= 0) {
      const w = peso(ESCENA.proceso);
      const encendida = suave(e.etapa - puerta) * (1 - 0.6 * suave(e.etapa - puerta - 1));
      aristas = lerp(aristas, 0.35 + 0.65 * encendida, w);
      emision = lerp(emision, encendida, w);
      frio = w * encendida;
    }

    const base = n * VEC4_POR_CAJA * 4;
    salida.cajas.set(
      [
        ...centro,
        giro,
        ...lerp3(pa.h, pb.h, t),
        ranura.tipo,
        aristas,
        emision,
        presencia,
        lerp(pa.pulido, pb.pulido, t),
        lerp(pa.hueco[0], pb.hueco[0], t),
        lerp(pa.hueco[1], pb.hueco[1], t),
        frio,
        0
      ],
      base
    );
    n += 1;
  });
  salida.numCajas = n;

  const luz = alMundo(lerp3(a.luz.p, b.luz.p, t), az);
  salida.luz.set([...luz, lerp(a.luz.i, b.luz.i, t)]);

  const enEscala = (v: Vec3): Vec3 => [
    v[0] * CINTA.escala + CINTA.desvio[0],
    v[1] * CINTA.escala + CINTA.desvio[1],
    v[2] * CINTA.escala + CINTA.desvio[2]
  ];
  for (let p = 0; p < 5; p++) {
    salida.cinta.puntos[p] = lerp3(
      alMundo(enEscala(a.cinta.puntos[p]!), a.az),
      alMundo(enEscala(b.cinta.puntos[p]!), b.az),
      t
    );
    const r = lerp(a.cinta.radios[p]!, b.cinta.radios[p]!, t) * CINTA.escala;
    salida.cinta.radios[p] = Math.max(r, CINTA.puntaMinima);
  }
  return salida;
}
