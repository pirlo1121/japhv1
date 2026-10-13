/**
 * red.ts
 * La red viva que nace de la escultura y recorre la arquitectura.
 * Filamentos curvos y finos, nodos que se encienden y unas pocas partículas
 * de energía que viajan con propósito por las conexiones. Siempre por
 * debajo de los monolitos en jerarquía: luz contenida, nunca una telaraña.
 *
 * Por qué Canvas 2D y no otro WebGL: la red son unas decenas de curvas y
 * puntos; proyectarlos con la misma cámara que el sombreador (camara.ts) la
 * pone en el mismo espacio que la escultura, sin un segundo renderizador a
 * pantalla completa. Se dibuja en el mismo bucle que la escena.
 *
 * Todo es determinista: la red se genera con una semilla fija y su
 * crecimiento sale del estado narrativo (red, orden), que anima el scroll.
 * Al subir, la red se repliega exactamente igual que creció.
 *
 *   ramas         7 nodos principales, uno por servicio, unidos a su ancla
 *                 a lo largo de la escultura (escultura.ts)
 *   secundarios   ramifican hacia fuera; crecen más tarde cuanto más lejos
 *   reconexiones  enlaces entre secundarios: la red se vuelve sistema
 *   anillo        une las ramas entre sí; solo con orden (ecosistema)
 *   lejanos       filamentos tenues al fondo, visibles desde el principio
 */
import { crearProyector, type Camara, type Proyeccion } from './camara';
import { RAMAS, type Vec3 } from './escultura';
import type { EstadoNarrativo } from './narrativa';

export type Densidad = 'completa' | 'media' | 'ligera';

const CANTIDADES: Record<
  Densidad,
  { secundarios: number; reconexiones: number; lejanos: number; particulas: number }
> = {
  completa: { secundarios: 20, reconexiones: 9, lejanos: 12, particulas: 12 },
  media: { secundarios: 13, reconexiones: 6, lejanos: 8, particulas: 8 },
  ligera: { secundarios: 8, reconexiones: 3, lejanos: 5, particulas: 5 }
};

/**
 * Colores de la red (tokens.css): luz cian y azul, algún nodo violeta y el
 * plata del metal; el verde, escaso, solo en lo activo.
 */
const COLORES: [number, number, number][] = [
  [85, 221, 245],
  [39, 107, 255],
  [128, 103, 232],
  [191, 198, 209]
];
const VERDE: [number, number, number] = [57, 230, 163];
const BLANCO: [number, number, number] = [242, 245, 250];

/** Lo que pesa la red frente a la arquitectura: luz contenida, por debajo de los monolitos. */
const PRESENCIA = 0.62;
/** Lo que tarda un filamento en crecer entero, en unidades de `red`. */
const CRECIMIENTO = 0.12;
const TAU = Math.PI * 2;
/** Plano inclinado en el que se ordena la red (proyectos, ecosistema). */
const INCLINACION_ANILLO = 0.32;

type Tipo = 'rama' | 'secundario' | 'lejano';

interface Nodo {
  tipo: Tipo;
  base: Vec3;
  ordenado: Vec3;
  /** Valor de `red` a partir del cual empieza a encenderse. */
  umbral: number;
  color: number;
  verde: boolean;
  tam: number;
  fase: number;
}

interface Filamento {
  /** Índice de nodo; las ramas salen de su ancla en la escultura (desde = -1 - rama). */
  desde: number;
  hasta: number;
  umbral: number;
  curva: Vec3;
  color: number;
  alfa: number;
  /** Solo se ve con orden: el anillo que une las ramas en el ecosistema. */
  conOrden: boolean;
  fase: number;
}

interface Particula {
  filamento: number;
  t: number;
  velocidad: number;
  sentido: 1 | -1;
  brillo: number;
}

/** Generador pseudoaleatorio con semilla (mulberry32): la misma red en cada visita. */
function semilla(n: number) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mezcla = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
];
const distancia = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const limitar = (x: number) => Math.min(1, Math.max(0, x));
const suave = (x: number) => {
  const t = limitar(x);
  return t * t * (3 - 2 * t);
};

/** Punto del anillo ordenado, en el plano inclinado de la red. */
function enAnillo(angulo: number, radio: number, altura = 0): Vec3 {
  const x = Math.cos(angulo) * radio;
  const c = Math.cos(INCLINACION_ANILLO);
  const s = Math.sin(INCLINACION_ANILLO);
  return [x * c + altura * s, -x * s + altura * c, Math.sin(angulo) * radio];
}

/** Brillo circular pre-pintado: dibujar una imagen es mucho más barato que un degradado por punto. */
function crearDestello([r, g, b]: [number, number, number]): HTMLCanvasElement {
  const lado = 64;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return lienzo;
  const gradiente = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
  gradiente.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gradiente.addColorStop(0.18, `rgba(${r},${g},${b},0.55)`);
  gradiente.addColorStop(0.5, `rgba(${r},${g},${b},0.12)`);
  gradiente.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, lado, lado);
  return lienzo;
}

const rgba = ([r, g, b]: [number, number, number], a: number) =>
  `rgba(${r},${g},${b},${a.toFixed(3)})`;

export interface MarcoDeRed {
  tiempo: number;
  /** Segundos desde el fotograma anterior (0 sin movimiento). */
  dt: number;
  /** Tiempo del movimiento interno de la escultura (el mismo uFase del sombreador). */
  fase: number;
  camara: Camara;
  estado: EstadoNarrativo;
  /** Rama destacada y su brillo suavizado (0..1). */
  foco: number;
  brilloFoco: number;
  /** Si el foco viene del puntero sobre el nodo: se muestra su nombre. */
  etiquetarFoco: boolean;
  /** Anclas de las ramas a lo largo de la escultura (mundo), una por servicio (escultura.ts). */
  anclas: Vec3[];
  /** Rectángulos (px del lienzo) de texto: la red se aparta de ellos. */
  zonas: DOMRect[];
  movimiento: boolean;
}

export class Red {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly nodos: Nodo[] = [];
  private readonly filamentos: Filamento[] = [];
  private readonly particulas: Particula[] = [];
  private readonly destellos: HTMLCanvasElement[];
  private readonly destelloVerde: HTMLCanvasElement;
  private readonly destelloBlanco: HTMLCanvasElement;
  private readonly azar = semilla(1977);
  private ancho = 0;
  private alto = 0;
  private dpr = 1;
  private fuente = 'sans-serif';
  /** Posición en pantalla de cada nodo y de cada ancla en el último fotograma. */
  private readonly proyectados: Proyeccion[] = [];
  private readonly anclasProyectadas: Proyeccion[] = [];
  private anclas3d: Vec3[] = [];
  private posiciones: Vec3[] = [];

  constructor(
    private readonly lienzo: HTMLCanvasElement,
    densidad: Densidad,
    private readonly etiquetas: string[]
  ) {
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.destellos = COLORES.map(crearDestello);
    this.destelloVerde = crearDestello(VERDE);
    this.destelloBlanco = crearDestello(BLANCO);
    this.fuente = getComputedStyle(document.body).fontFamily || this.fuente;
    this.generar(CANTIDADES[densidad]);
  }

  // ---------------------------------------------------------------- generación

  private generar(n: (typeof CANTIDADES)[Densidad]): void {
    const azar = semilla(42);
    const entre = (a: number, b: number) => a + (b - a) * azar();

    // Ramas: una por servicio, cerca de la escultura (los primeros nodos nacen junto a su superficie).
    const angulosRama: number[] = [];
    for (let i = 0; i < RAMAS; i++) {
      const a = (i / RAMAS) * TAU + 0.35 + entre(-0.2, 0.2);
      const radio = entre(1.9, 2.5);
      const angulo = (i * TAU) / RAMAS;
      angulosRama.push(angulo);
      this.nodos.push({
        tipo: 'rama',
        base: [Math.cos(a) * radio, entre(-1.2, 1.2), Math.sin(a) * radio * 0.6 - 0.3],
        // Ordenada: un anillo alrededor de la escultura, en un plano inclinado.
        ordenado: enAnillo(angulo, 2.9),
        umbral: 0.1 + i * 0.035,
        color: i % 3,
        verde: false,
        tam: 1.25,
        fase: entre(0, TAU)
      });
      this.filamentos.push({
        desde: -1 - i,
        hasta: i,
        umbral: 0.1 + i * 0.035,
        curva: [entre(-1, 1), entre(-0.6, 0.6), entre(-1, 1)],
        color: i % 3,
        alfa: 0.62,
        conOrden: false,
        fase: entre(0, TAU)
      });
    }

    // Secundarios: un árbol que crece hacia fuera desde la rama más cercana.
    const padres: number[] = [];
    for (let k = 0; k < n.secundarios; k++) {
      const a = entre(0, TAU);
      const radio = entre(2.9, 5.2);
      const base: Vec3 = [
        Math.cos(a) * radio,
        entre(-2.4, 2.4) * 0.7,
        Math.sin(a) * radio * 0.55 - entre(0.5, 2)
      ];
      let padre = 0;
      let mejor = Infinity;
      this.nodos.forEach((nodo, j) => {
        if (nodo.tipo === 'lejano') return;
        const d = distancia(nodo.base, base) + (nodo.tipo === 'secundario' ? 0.6 : 0);
        if (d < mejor) {
          mejor = d;
          padre = j;
        }
      });
      const umbralPadre = this.nodos[padre]?.umbral ?? 0.3;
      const umbral = Math.min(0.88, Math.max(umbralPadre + 0.1, 0.32 + (radio - 2.9) * 0.12));
      // Ordenado: sobre el anillo exterior, cerca del ángulo de su rama de origen.
      let raiz = padre;
      while (raiz >= RAMAS) raiz = padres[raiz - RAMAS] ?? 0;
      const nivel = padre < RAMAS ? 1 : 2;
      const ordenado = enAnillo(
        (angulosRama[raiz] ?? 0) + entre(-0.35, 0.35),
        2.9 + nivel * 1.05,
        entre(-0.25, 0.25)
      );
      padres.push(padre);
      this.nodos.push({
        tipo: 'secundario',
        base,
        ordenado,
        umbral,
        color: azar() < 0.62 ? 0 : azar() < 0.6 ? 1 : 2,
        verde: false,
        tam: entre(0.6, 0.95),
        fase: entre(0, TAU)
      });
      this.filamentos.push({
        desde: padre,
        hasta: this.nodos.length - 1,
        umbral,
        curva: [entre(-1, 1), entre(-1, 1), entre(-1, 1)],
        color: this.nodos[this.nodos.length - 1]?.color ?? 0,
        alfa: 0.4,
        conOrden: false,
        fase: entre(0, TAU)
      });
    }

    // El verde es escaso: dos nodos activos entre los secundarios que crecen pronto.
    this.nodos
      .filter((nodo) => nodo.tipo === 'secundario')
      .sort((a, b) => a.umbral - b.umbral)
      .slice(2, 4)
      .forEach((nodo) => (nodo.verde = true));

    // Reconexiones: los secundarios más cercanos que aún no estaban unidos.
    const secundarios = this.nodos
      .map((nodo, i) => ({ nodo, i }))
      .filter(({ nodo }) => nodo.tipo === 'secundario');
    const pares: { a: number; b: number; d: number }[] = [];
    secundarios.forEach(({ nodo: na, i: a }) =>
      secundarios.forEach(({ nodo: nb, i: b }) => {
        if (b <= a) return;
        const unidos = this.filamentos.some(
          (f) => (f.desde === a && f.hasta === b) || (f.desde === b && f.hasta === a)
        );
        if (!unidos) pares.push({ a, b, d: distancia(na.base, nb.base) });
      })
    );
    pares
      .sort((x, y) => x.d - y.d)
      .slice(0, n.reconexiones)
      .forEach(({ a, b }, k) => {
        this.filamentos.push({
          desde: a,
          hasta: b,
          umbral: 0.62 + (k / Math.max(1, n.reconexiones)) * 0.3,
          curva: [entre(-1, 1), entre(-1, 1), entre(-1, 1)],
          color: k % 3 === 2 ? 2 : 1,
          alfa: 0.3,
          conOrden: false,
          fase: entre(0, TAU)
        });
      });

    // Anillo: las ramas se unen entre sí cuando la red se ordena.
    for (let i = 0; i < RAMAS; i++) {
      this.filamentos.push({
        desde: i,
        hasta: (i + 1) % RAMAS,
        umbral: 0.5,
        curva: [0, 0, 0],
        color: 0,
        alfa: 0.34,
        conOrden: true,
        fase: entre(0, TAU)
      });
    }

    // Lejanos: unos pocos filamentos tenues al fondo, visibles desde el principio.
    const primerLejano = this.nodos.length;
    for (let k = 0; k < n.lejanos; k++) {
      const a = entre(-0.3, Math.PI + 0.3);
      const radio = entre(6.5, 9.5);
      const base: Vec3 = [Math.cos(a) * radio, entre(-3, 3), -Math.sin(a) * entre(3, 6) - 3];
      this.nodos.push({
        tipo: 'lejano',
        base,
        ordenado: base,
        umbral: 0,
        color: azar() < 0.5 ? 1 : 2,
        verde: false,
        tam: entre(0.45, 0.7),
        fase: entre(0, TAU)
      });
    }
    for (let k = primerLejano; k < this.nodos.length - 1; k += 1) {
      if (azar() < 0.35) continue;
      this.filamentos.push({
        desde: k,
        hasta: k + 1,
        umbral: 0,
        curva: [entre(-1, 1), entre(-1, 1), entre(-0.5, 0.5)],
        color: this.nodos[k]?.color ?? 1,
        alfa: 0.16,
        conOrden: false,
        fase: entre(0, TAU)
      });
    }

    for (let k = 0; k < n.particulas; k++) {
      this.particulas.push({ filamento: -1, t: azar(), velocidad: 0, sentido: 1, brillo: 1 });
    }
    this.proyectados.push(...this.nodos.map(() => ({ x: 0, y: 0, escala: 1, profundidad: 1 })));
    for (let i = 0; i < RAMAS; i++) {
      this.anclasProyectadas.push({ x: 0, y: 0, escala: 1, profundidad: 1 });
    }
  }

  // ---------------------------------------------------------------- tamaño

  redimensionar(anchoCss: number, altoCss: number, dpr: number): void {
    this.ancho = anchoCss;
    this.alto = altoCss;
    this.dpr = dpr;
    this.lienzo.width = Math.max(1, Math.round(anchoCss * dpr));
    this.lienzo.height = Math.max(1, Math.round(altoCss * dpr));
  }

  /** Rama (servicio) bajo el puntero, en px del lienzo; -1 si ninguna. */
  ramaBajo(x: number, y: number, estado: EstadoNarrativo): number {
    let elegida = -1;
    let mejor = 22;
    for (let i = 0; i < RAMAS; i++) {
      const nodo = this.nodos[i];
      const p = this.proyectados[i];
      if (!nodo || !p || this.encendido(nodo, estado.red) < 0.6) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < mejor) {
        mejor = d;
        elegida = i;
      }
    }
    return elegida;
  }

  // ---------------------------------------------------------------- dibujo

  private encendido(nodo: Nodo, red: number): number {
    if (nodo.tipo === 'lejano') return 1;
    return suave((red - nodo.umbral - CRECIMIENTO * 0.6) / 0.1);
  }

  private crecido(f: Filamento, estado: EstadoNarrativo): number {
    if (f.conOrden)
      return suave((estado.orden - 0.35) / 0.5) * suave((estado.red - f.umbral) / 0.2);
    return limitar((estado.red - f.umbral) / CRECIMIENTO);
  }

  private posicion(i: number): Vec3 | undefined {
    return i < 0 ? this.anclas3d[-1 - i] : this.posiciones[i];
  }

  private pantalla(i: number): Proyeccion | undefined {
    return i < 0 ? this.anclasProyectadas[-1 - i] : this.proyectados[i];
  }

  /** Puntos de control de la curva de un filamento, ya en pantalla. */
  private curva(
    f: Filamento,
    proyectar: (p: Vec3, d: Proyeccion) => Proyeccion,
    estado: EstadoNarrativo,
    tiempo: number,
    control: Proyeccion
  ): boolean {
    const a = this.posicion(f.desde);
    const b = this.posicion(f.hasta);
    if (!a || !b) return false;
    const largo = distancia(a, b);
    // Curvatura orgánica que se tensa con el orden y respira despacio.
    const tension = (0.32 - 0.22 * estado.orden) * largo;
    const respiro = 0.06 * largo * Math.sin(tiempo * 0.22 + f.fase) * (1 - estado.orden * 0.7);
    proyectar(
      [
        (a[0] + b[0]) / 2 + f.curva[0] * tension + respiro,
        (a[1] + b[1]) / 2 + f.curva[1] * tension,
        (a[2] + b[2]) / 2 + f.curva[2] * tension - respiro
      ],
      control
    );
    return true;
  }

  dibujar(m: MarcoDeRed): void {
    const { ctx, dpr } = this;
    const { estado } = m;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.lienzo.width, this.lienzo.height);
    if (this.ancho === 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    const proyectar = crearProyector(m.camara, this.ancho, this.alto);
    const orden = suave(estado.orden);
    const deriva = m.movimiento ? 1 - orden * 0.7 : 0;
    this.anclas3d = m.anclas;
    this.posiciones = this.nodos.map((nodo) => {
      const p = mezcla(nodo.base, nodo.ordenado, orden);
      const t = m.tiempo * 0.3 + nodo.fase;
      return [
        p[0] + 0.06 * Math.sin(t) * deriva,
        p[1] + 0.05 * Math.sin(t * 0.8 + 1) * deriva,
        p[2] + 0.06 * Math.cos(t * 0.7) * deriva
      ];
    });
    this.posiciones.forEach((p, i) => {
      const destino = this.proyectados[i];
      if (destino) proyectar(p, destino);
    });
    this.anclas3d.forEach((p, i) => {
      const destino = this.anclasProyectadas[i];
      if (destino) proyectar(p, destino);
    });

    // La red se apaga con la escena para que mande el contenido, y nunca
    // pesa más que la arquitectura (PRESENCIA).
    const presencia = PRESENCIA * (1 - estado.atenuacion * 0.6);
    const centro = proyectar([0, 0, 0], { x: 0, y: 0, escala: 1, profundidad: 1 });
    const radioEscultura = 1.15 * centro.escala;
    const control: Proyeccion = { x: 0, y: 0, escala: 1, profundidad: 1 };

    // ---- filamentos
    this.filamentos.forEach((f) => {
      const crecido = this.crecido(f, estado);
      if (crecido <= 0.001) return;
      const a = this.pantalla(f.desde);
      const b = this.pantalla(f.hasta);
      if (!a || !b || !this.curva(f, proyectar, estado, m.tiempo, control)) return;
      const esFoco = f.desde === -1 - m.foco;
      const destacado = esFoco ? m.brilloFoco : 0;
      // Lo que pasa por detrás de la escultura se ve a través de ella, más tenue.
      const detras =
        control.profundidad > centro.profundidad &&
        Math.hypot(control.x - centro.x, control.y - centro.y) < radioEscultura
          ? 0.35
          : 1;
      const lejania = Math.min(1, 9 / (control.profundidad + 2));
      const alfa = f.alfa * presencia * detras * lejania * (1 + destacado * 0.9);

      // Crece desde su origen: se corta la curva en `crecido` (de Casteljau).
      const p01x = a.x + (control.x - a.x) * crecido;
      const p01y = a.y + (control.y - a.y) * crecido;
      const p12x = control.x + (b.x - control.x) * crecido;
      const p12y = control.y + (b.y - control.y) * crecido;
      const fx = p01x + (p12x - p01x) * crecido;
      const fy = p01y + (p12y - p01y) * crecido;

      const color = COLORES[f.color] ?? COLORES[0]!;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(p01x, p01y, fx, fy);
      // Halo ancho y tenue + hilo fino y nítido: luz contenida, sin bloom.
      ctx.strokeStyle = rgba(color, alfa * 0.16);
      ctx.lineWidth = 3.4 + destacado * 2;
      ctx.stroke();
      if (f.desde < 0) {
        // Las ramas nacen blancas en el metal y toman su color hacia fuera.
        const gradiente = ctx.createLinearGradient(a.x, a.y, fx, fy);
        gradiente.addColorStop(0, rgba(BLANCO, alfa));
        gradiente.addColorStop(1, rgba(destacado > 0.5 ? VERDE : color, alfa));
        ctx.strokeStyle = gradiente;
      } else {
        ctx.strokeStyle = rgba(color, alfa);
      }
      ctx.lineWidth = 0.9 + destacado * 0.7;
      ctx.stroke();
    });

    // ---- nodos
    this.nodos.forEach((nodo, i) => {
      const luz = this.encendido(nodo, estado.red);
      if (luz <= 0.01) return;
      const p = this.proyectados[i];
      if (!p) return;
      const esFoco = i === m.foco ? m.brilloFoco : 0;
      const pulso = m.movimiento ? 0.85 + 0.15 * Math.sin(m.tiempo * 1.3 + nodo.fase) : 1;
      const lejania = Math.min(1, 9 / (p.profundidad + 2));
      const alfa = luz * presencia * lejania * pulso * (nodo.tipo === 'lejano' ? 0.35 : 1);
      const verde = (nodo.verde && estado.red > 0.55) || esFoco > 0.5;
      const destello = verde
        ? this.destelloVerde
        : (this.destellos[nodo.color] ?? this.destellos[0]!);
      const lado = (10 + nodo.tam * 16) * (1 + esFoco * 0.8) * Math.min(1.4, p.escala / 120);
      ctx.globalAlpha = Math.min(1, alfa * (0.55 + esFoco * 0.45));
      ctx.drawImage(destello, p.x - lado / 2, p.y - lado / 2, lado, lado);
      ctx.globalAlpha = Math.min(1, alfa);
      ctx.fillStyle = rgba(verde ? VERDE : BLANCO, 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.9 + nodo.tam * 0.8) * (1 + esFoco * 0.5), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // ---- energía que viaja
    if (m.movimiento) this.moverParticulas(m, proyectar, control, presencia);

    // ---- nombre del nodo bajo el puntero
    if (m.etiquetarFoco && m.foco >= 0 && m.brilloFoco > 0.05) {
      const p = this.proyectados[m.foco];
      const nombre = this.etiquetas[m.foco];
      if (p && nombre) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `500 12px ${this.fuente}`;
        ctx.fillStyle = rgba([245, 247, 255], m.brilloFoco);
        ctx.fillText(nombre, p.x + 12, p.y - 10);
      }
    }

    // ---- la red se aparta del texto
    this.despejar(m.zonas);
  }

  private moverParticulas(
    m: MarcoDeRed,
    proyectar: (p: Vec3, d: Proyeccion) => Proyeccion,
    control: Proyeccion,
    presencia: number
  ): void {
    const { ctx } = this;
    const listos = (f: Filamento) => f.alfa >= 0.3 && this.crecido(f, m.estado) >= 1 && !f.conOrden;
    // La velocidad sigue al flujo de la escultura: en la escena final todo se calma.
    const ritmo = 0.5 + m.estado.flujo * 0.8;
    this.particulas.forEach((particula, k) => {
      let f = this.filamentos[particula.filamento];
      if (!f || !listos(f) || particula.t > 1) {
        // Hacia dónde va: la rama destacada recibe energía constante; si no,
        // un filamento que continúa desde donde terminó, o uno cualquiera.
        const llegada = f ? (particula.sentido > 0 ? f.hasta : f.desde) : -99;
        const candidatos = this.filamentos.map((g, i) => ({ g, i })).filter(({ g }) => listos(g));
        if (candidatos.length === 0) return;
        const alFoco =
          m.foco >= 0 && k < 2 ? candidatos.filter(({ g }) => g.desde === -1 - m.foco) : [];
        const siguen = candidatos.filter(({ g }) => g.desde === llegada || g.hasta === llegada);
        const grupo = alFoco.length
          ? alFoco
          : siguen.length && this.azar() < 0.7
            ? siguen
            : candidatos;
        const elegido = grupo[Math.floor(this.azar() * grupo.length)] ?? candidatos[0]!;
        particula.filamento = elegido.i;
        particula.sentido = elegido.g.hasta === llegada ? -1 : alFoco.length ? -1 : 1;
        particula.t = 0;
        particula.velocidad = 0.22 + this.azar() * 0.22;
        particula.brillo = 0.6 + this.azar() * 0.4;
        f = elegido.g;
      }
      particula.t += m.dt * particula.velocidad * ritmo;
      const a = this.pantalla(f.desde);
      const b = this.pantalla(f.hasta);
      if (!a || !b || !this.curva(f, proyectar, m.estado, m.tiempo, control)) return;
      const punto = (t: number) => {
        const u = particula.sentido > 0 ? t : 1 - t;
        const v = 1 - u;
        return [
          v * v * a.x + 2 * v * u * control.x + u * u * b.x,
          v * v * a.y + 2 * v * u * control.y + u * u * b.y
        ] as const;
      };
      // Entra y sale con un fundido: nunca aparece de golpe.
      const vida = Math.sin(Math.min(1, particula.t) * Math.PI);
      const alfa = vida * particula.brillo * presencia;
      for (let s = 3; s >= 0; s--) {
        const t = particula.t - s * 0.018;
        if (t < 0) continue;
        const [x, y] = punto(t);
        const cola = 1 - s / 4;
        const lado = (s === 0 ? 14 : 8) * particula.brillo;
        ctx.globalAlpha = alfa * cola * 0.9;
        ctx.drawImage(this.destelloBlanco, x - lado / 2, y - lado / 2, lado, lado);
      }
      ctx.globalAlpha = 1;
    });
  }

  /** Borra suavemente la red detrás de los textos: nunca cruza un párrafo o un botón. */
  private despejar(zonas: DOMRect[]): void {
    if (zonas.length === 0) return;
    const { ctx } = this;
    ctx.globalCompositeOperation = 'destination-out';
    for (const z of zonas) {
      for (const [margen, alfa] of [
        [36, 0.25],
        [20, 0.4],
        [6, 0.6],
        [-8, 0.85]
      ] as const) {
        ctx.fillStyle = `rgba(0,0,0,${alfa})`;
        ctx.fillRect(z.left - margen, z.top - margen, z.width + margen * 2, z.height + margen * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Posición en pantalla del centro de la escultura y su radio aparente (para el respaldo CSS). */
  centro(camara: Camara): Proyeccion {
    return crearProyector(
      camara,
      this.ancho,
      this.alto
    )([0, 0, 0], {
      x: 0,
      y: 0,
      escala: 1,
      profundidad: 1
    });
  }

  liberar(): void {
    this.ctx.clearRect(0, 0, this.lienzo.width, this.lienzo.height);
    this.lienzo.width = 1;
    this.lienzo.height = 1;
  }
}
