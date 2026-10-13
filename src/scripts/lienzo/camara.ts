/**
 * camara.ts
 * La cámara que orbita un punto de la arquitectura y cómo un punto 3D cae
 * en la pantalla. El sombreador construye los rayos con la misma cuenta
 * (función `rayo`), así que estas dos piezas tienen que cambiar juntas.
 */

export type Vec3 = [number, number, number];

export interface Orbita {
  /** Ángulo alrededor del eje vertical (radianes); 0 = mirando desde +z. */
  azimut: number;
  /** Altura de la cámara (radianes). */
  elevacion: number;
  /** Distancia al objetivo. */
  distancia: number;
  /** El punto que mira y alrededor del que orbita (la escultura está en el origen). */
  objetivoX: number;
  objetivoY: number;
  objetivoZ: number;
  /** Dónde cae el objetivo en pantalla (-1..1, y hacia arriba). */
  desplazamientoX: number;
  desplazamientoY: number;
}

export interface Camara {
  posicion: Vec3;
  objetivo: Vec3;
  /** 1 / tan(campo de visión vertical / 2): menor en pantallas estrechas (más campo). */
  focal: number;
  desplazamiento: [number, number];
}

/** Campo de visión vertical de 32°: compresión de teleobjetivo, sin distorsión. */
export const FOCAL = 1 / Math.tan((32 * Math.PI) / 180 / 2);

/**
 * En pantallas más estrechas que esto el campo de visión se abre para que
 * la escena quepa a lo ancho. Se abre (zoom) en lugar de alejar la cámara:
 * así la perspectiva de la arquitectura es la misma en cualquier pantalla y
 * todo se escala por igual alrededor del objetivo.
 */
export const ASPECTO_MINIMO = 0.85;

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
  const d = orbita.distancia;
  const ce = Math.cos(orbita.elevacion);
  const objetivo: Vec3 = [orbita.objetivoX, orbita.objetivoY, orbita.objetivoZ];
  return {
    posicion: [
      objetivo[0] + Math.sin(orbita.azimut) * ce * d,
      objetivo[1] + Math.sin(orbita.elevacion) * d,
      objetivo[2] + Math.cos(orbita.azimut) * ce * d
    ],
    objetivo,
    focal: FOCAL * Math.min(1, aspecto / ASPECTO_MINIMO),
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
