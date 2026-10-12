/**
 * camara.ts
 * La cámara que orbita la escultura y cómo un punto 3D cae en la pantalla.
 * El sombreador construye los rayos con la misma cuenta (función `rayo`),
 * así que estas dos piezas tienen que cambiar juntas.
 */

export type Vec3 = [number, number, number];

export interface Orbita {
  /** Ángulo alrededor del eje vertical (radianes); 0 = mirando desde +z. */
  azimut: number;
  /** Altura de la cámara (radianes). */
  elevacion: number;
  /** Distancia al centro de la escultura. */
  distancia: number;
  /** Dónde cae el centro de la escultura en pantalla (-1..1, y hacia arriba). */
  desplazamientoX: number;
  desplazamientoY: number;
}

export interface Camara {
  posicion: Vec3;
  objetivo: Vec3;
  /** 1 / tan(campo de visión / 2). */
  focal: number;
  desplazamiento: [number, number];
}

/** Campo de visión vertical de 32°: compresión de teleobjetivo, sin distorsión. */
export const FOCAL = 1 / Math.tan((32 * Math.PI) / 180 / 2);

/** En pantallas estrechas la cámara se aleja para que la escultura quepa a lo ancho. */
const ASPECTO_MINIMO = 0.85;

const resta = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const punto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const normalizar = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function calcularCamara(orbita: Orbita, aspecto: number): Camara {
  const d = orbita.distancia * Math.max(1, ASPECTO_MINIMO / aspecto);
  const ce = Math.cos(orbita.elevacion);
  return {
    posicion: [
      Math.sin(orbita.azimut) * ce * d,
      Math.sin(orbita.elevacion) * d,
      Math.cos(orbita.azimut) * ce * d
    ],
    objetivo: [0, 0, 0],
    focal: FOCAL,
    desplazamiento: [orbita.desplazamientoX, orbita.desplazamientoY]
  };
}

/** Base de la cámara: frente, derecha y arriba (igual que en el sombreador). */
function base(c: Camara): [Vec3, Vec3, Vec3] {
  const f = normalizar(resta(c.objetivo, c.posicion));
  const r = normalizar(cruz(f, [0, 1, 0]));
  return [f, r, cruz(r, f)];
}

/** Punto 3D → píxeles CSS. `delante` es false si queda detrás de la cámara. */
export function proyectar(
  p: Vec3,
  c: Camara,
  ancho: number,
  alto: number
): { x: number; y: number; delante: boolean } {
  const [f, r, u] = base(c);
  const d = resta(p, c.posicion);
  const z = punto(d, f);
  const aspecto = ancho / alto;
  const nx = (punto(d, r) / z) * (c.focal / aspecto) + c.desplazamiento[0];
  const ny = (punto(d, u) / z) * c.focal + c.desplazamiento[1];
  return { x: ((nx + 1) / 2) * ancho, y: ((1 - ny) / 2) * alto, delante: z > 0 };
}

export interface Proyeccion {
  x: number;
  y: number;
  /** Píxeles por unidad del mundo a esa profundidad (para tamaños). */
  escala: number;
  /** Distancia a lo largo de la mirada; <= 0 queda detrás de la cámara. */
  profundidad: number;
}

/**
 * Proyector para muchos puntos en el mismo fotograma: la base de la cámara
 * se calcula una vez (misma cuenta que `proyectar`).
 */
export function crearProyector(c: Camara, ancho: number, alto: number) {
  const [f, r, u] = base(c);
  const aspecto = ancho / alto;
  const [px, py, pz] = c.posicion;
  return (p: Vec3, destino: Proyeccion): Proyeccion => {
    const dx = p[0] - px;
    const dy = p[1] - py;
    const dz = p[2] - pz;
    const z = Math.max(dx * f[0] + dy * f[1] + dz * f[2], 0.05);
    const nx =
      ((dx * r[0] + dy * r[1] + dz * r[2]) / z) * (c.focal / aspecto) + c.desplazamiento[0];
    const ny = ((dx * u[0] + dy * u[1] + dz * u[2]) / z) * c.focal + c.desplazamiento[1];
    destino.x = ((nx + 1) / 2) * ancho;
    destino.y = ((1 - ny) / 2) * alto;
    destino.escala = (c.focal / z) * (alto / 2);
    destino.profundidad = z;
    return destino;
  };
}

/**
 * Píxel del lienzo → punto del mundo en el plano perpendicular a la mirada
 * que pasa por `centro` (por defecto, el centro del robot). Es lo que el
 * brazo del guía alcanza al señalar un elemento de la página.
 */
export function aMundo(
  x: number,
  y: number,
  c: Camara,
  ancho: number,
  alto: number,
  centro: Vec3 = [0, 0, 0]
): Vec3 {
  const [f, r, u] = base(c);
  const aspecto = ancho / alto;
  const nx = (x / ancho) * 2 - 1 - c.desplazamiento[0];
  const ny = 1 - (y / alto) * 2 - c.desplazamiento[1];
  const dir = normalizar([
    f[0] * c.focal + nx * aspecto * r[0] + ny * u[0],
    f[1] * c.focal + nx * aspecto * r[1] + ny * u[1],
    f[2] * c.focal + nx * aspecto * r[2] + ny * u[2]
  ]);
  const t = punto(resta(centro, c.posicion), f) / (punto(dir, f) || 1);
  return [c.posicion[0] + dir[0] * t, c.posicion[1] + dir[1] * t, c.posicion[2] + dir[2] * t];
}

/** Derecha y arriba de la cámara en el mundo: para llevar un movimiento en pantalla al mundo. */
export function ejesDePantalla(c: Camara): [Vec3, Vec3] {
  const [, r, u] = base(c);
  return [r, u];
}
