/**
 * seda.ts
 * Hilos de seda que navegan por la página y toman la forma del texto y de
 * los componentes ([data-seda="texto" | "caja"]).
 *
 * - Hebras: unas pocas curvas finas y luminosas. Su cabeza sigue un campo de
 *   flujo suave y el resto de la hebra la sigue con retraso, como seda en el
 *   aire. Nunca se detienen.
 * - Tejido: cuando una pieza entra en pantalla, su contorno (forma.ts) se
 *   dibuja de izquierda a derecha como si se cosiera; las hebras más
 *   cercanas hacen de aguja y siguen la punta. Al final aparece el contenido
 *   real (--tejido) y el contorno de seda se desvanece. Si la pieza sale por
 *   abajo y vuelve, se teje otra vez.
 *
 * Un solo lienzo 2D por encima del contenido (sin eventos de puntero). El
 * contorno de cada pieza se calcula una vez; cada fotograma solo traza
 * curvas, con menos hebras y menos resolución en pantallas táctiles.
 * Con "reducir movimiento" no se monta nada y todo se ve normal.
 */
import { formaDeCaja, formaDeTexto, type Forma, type Trazo } from './forma';

type Estado = 'oculto' | 'tejiendo' | 'hecho';

interface Tejido {
  elemento: HTMLElement;
  tipo: 'texto' | 'caja';
  forma: Forma | null;
  estado: Estado;
  /** Segundo en que empezó a tejerse. */
  inicio: number;
  duracion: number;
  /** Segundo en que terminó (para desvanecer el contorno). */
  fin: number;
}

interface Hebra {
  /** x, y de cada punto: la cabeza es el primero. */
  puntos: Float32Array;
  fase: number;
  color: number;
  velocidad: number;
  aguja: Tejido | null;
}

/** Colores de la seda (tokens.css): cian, púrpura, turquesa y un blanco frío. */
const COLORES: [number, number, number][] = [
  [0, 229, 255],
  [177, 92, 255],
  [0, 245, 212],
  [235, 245, 255]
];
const PUNTOS_POR_HEBRA = 34;
/** Duración del tejido (s) y cuándo empieza a aparecer el contenido (fracción). */
const TEJIDO = { caja: 0.75, textoMinimo: 0.9, textoMaximo: 1.5, revelar: 0.6, desvanecer: 0.7 };
const AGUJAS_POR_PIEZA = 2;
/**
 * Resolución del lienzo: densidad máxima y píxeles máximos (táctil /
 * escritorio). Son hebras finas sobre toda la pantalla: en tablets y
 * pantallas grandes entregar el lienzo entero en cada fotograma pesa más
 * que dibujarlo.
 */
const RESOLUCION = {
  dpr: { tactil: 1.25, escritorio: 1.5 },
  pixeles: { tactil: 0.7e6, escritorio: 1.4e6 }
};

const rgba = ([r, g, b]: [number, number, number], a: number) =>
  `rgba(${r},${g},${b},${a.toFixed(3)})`;
const suave = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export class Seda {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hebras: Hebra[] = [];
  private readonly tejidos: Tejido[];
  private readonly vigia: IntersectionObserver;
  private ancho = 0;
  private alto = 0;
  private dpr = 1;
  private cuadro = 0;
  private anterior = 0;
  private readonly inicio = performance.now();
  private readonly tactil = window.matchMedia('(pointer: coarse)').matches;

  constructor(private readonly lienzo: HTMLCanvasElement) {
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.ajustar();

    const cuantas = this.tactil || window.innerWidth < 768 ? 5 : 9;
    for (let i = 0; i < cuantas; i++) {
      const puntos = new Float32Array(PUNTOS_POR_HEBRA * 2);
      const x = Math.random() * this.ancho;
      const y = Math.random() * this.alto;
      for (let k = 0; k < PUNTOS_POR_HEBRA; k++) puntos.set([x, y], k * 2);
      this.hebras.push({
        puntos,
        fase: Math.random() * Math.PI * 2,
        color: i % COLORES.length,
        velocidad: 55 + Math.random() * 55,
        aguja: null
      });
    }

    this.tejidos = [...document.querySelectorAll<HTMLElement>('[data-seda]')].map((elemento) => ({
      elemento,
      tipo: elemento.dataset.seda === 'caja' ? 'caja' : 'texto',
      forma: null,
      estado: 'oculto',
      inicio: 0,
      duracion: TEJIDO.caja,
      fin: 0
    }));
    for (const t of this.tejidos) t.elemento.style.setProperty('--tejido', '0');

    // Se teje al entrar (un poco por encima del borde inferior); al salir por abajo, se deshace.
    this.vigia = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const t = this.tejidos.find((x) => x.elemento === entrada.target);
          if (!t) continue;
          if (entrada.isIntersecting && t.estado === 'oculto') this.tejer(t);
          else if (!entrada.isIntersecting && entrada.boundingClientRect.top > window.innerHeight) {
            this.deshacer(t);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    for (const t of this.tejidos) this.vigia.observe(t.elemento);

    window.addEventListener('resize', () => {
      this.ajustar();
      // El texto se reacomoda: su forma se vuelve a medir la próxima vez.
      for (const t of this.tejidos) t.forma = null;
    });
    document.addEventListener('visibilitychange', () => this.reanudar());
    this.reanudar();
  }

  private ahora = () => (performance.now() - this.inicio) / 1000;

  private ajustar(): void {
    this.ancho = window.innerWidth;
    this.alto = window.innerHeight;
    const tipo = this.tactil ? 'tactil' : 'escritorio';
    this.dpr = Math.min(
      window.devicePixelRatio || 1,
      RESOLUCION.dpr[tipo],
      Math.sqrt(RESOLUCION.pixeles[tipo] / (this.ancho * this.alto))
    );
    this.lienzo.width = Math.round(this.ancho * this.dpr);
    this.lienzo.height = Math.round(this.alto * this.dpr);
  }

  private reanudar(): void {
    if (document.visibilityState === 'visible' && !this.cuadro) {
      this.anterior = performance.now();
      this.cuadro = requestAnimationFrame(this.paso);
    } else if (document.visibilityState !== 'visible' && this.cuadro) {
      cancelAnimationFrame(this.cuadro);
      this.cuadro = 0;
    }
  }

  private medirForma(t: Tejido): Forma | null {
    const caja = t.elemento.getBoundingClientRect();
    if (t.tipo === 'caja') {
      const radio = parseFloat(getComputedStyle(t.elemento).borderTopLeftRadius) || 0;
      return formaDeCaja(caja.width, caja.height, radio);
    }
    const tamano = parseFloat(getComputedStyle(t.elemento).fontSize) || 16;
    return formaDeTexto(t.elemento, tamano > 40 ? 0.5 : 0.75);
  }

  private tejer(t: Tejido): void {
    t.forma ??= this.medirForma(t);
    if (!t.forma || t.forma.trazos.length === 0) {
      this.revelar(t);
      return;
    }
    t.estado = 'tejiendo';
    t.inicio = this.ahora();
    t.duracion =
      t.tipo === 'caja'
        ? TEJIDO.caja
        : Math.min(TEJIDO.textoMaximo, Math.max(TEJIDO.textoMinimo, 0.7 + t.forma.ancho / 1500));
    // Las hebras más cercanas hacen de aguja.
    const caja = t.elemento.getBoundingClientRect();
    const libres = this.hebras
      .filter((h) => !h.aguja)
      .sort(
        (a, b) =>
          Math.hypot((a.puntos[0] ?? 0) - caja.left, (a.puntos[1] ?? 0) - caja.top) -
          Math.hypot((b.puntos[0] ?? 0) - caja.left, (b.puntos[1] ?? 0) - caja.top)
      );
    for (const h of libres.slice(0, AGUJAS_POR_PIEZA)) h.aguja = t;
  }

  private revelar(t: Tejido): void {
    t.estado = 'hecho';
    t.fin = this.ahora();
    t.elemento.dataset.tejido = '';
    t.elemento.style.removeProperty('--tejido');
    for (const h of this.hebras) if (h.aguja === t) h.aguja = null;
  }

  private deshacer(t: Tejido): void {
    t.estado = 'oculto';
    delete t.elemento.dataset.tejido;
    t.elemento.style.setProperty('--tejido', '0');
    for (const h of this.hebras) if (h.aguja === t) h.aguja = null;
  }

  private paso = (ahoraMs: number) => {
    const dt = Math.min((ahoraMs - this.anterior) / 1000, 0.05);
    this.anterior = ahoraMs;
    this.dibujar(dt);
    this.cuadro = requestAnimationFrame(this.paso);
  };

  /** Avance de un trazo (0..1): empieza según su posición horizontal y dura algo más de la mitad. */
  private avance(trazo: Trazo, progreso: number): number {
    return suave((progreso - trazo.inicio * 0.4) / 0.6);
  }

  /** Punto del trazo a una fracción de su largo. */
  private puntoEn(trazo: Trazo, fraccion: number): [number, number] {
    const objetivo = fraccion * trazo.largo;
    const { acumulado, puntos } = trazo;
    let i = 1;
    while (i < acumulado.length - 1 && (acumulado[i] ?? 0) < objetivo) i++;
    const p = puntos[i] ?? puntos[0]!;
    return [p[0], p[1]];
  }

  private dibujar(dt: number): void {
    const { ctx } = this;
    const t = this.ahora();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.lienzo.width, this.lienzo.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ---- tejidos en curso: avance, punta de la aguja y revelado del contenido
    const puntas = new Map<Tejido, [number, number]>();
    // Las escrituras en el DOM van después de todas las lecturas del fotograma.
    const revelados: [Tejido, number][] = [];
    const terminados: Tejido[] = [];
    for (const tej of this.tejidos) {
      if (!tej.forma) continue;
      const desvanecido = tej.estado === 'hecho' ? (t - tej.fin) / TEJIDO.desvanecer : 0;
      if (tej.estado === 'oculto' || desvanecido >= 1) continue;
      // El tejido avanza aunque la pieza salga de pantalla: nunca queda a medias.
      const progreso = tej.estado === 'hecho' ? 1 : (t - tej.inicio) / tej.duracion;
      if (tej.estado === 'tejiendo') {
        if (progreso >= 1) terminados.push(tej);
        else {
          revelados.push([tej, suave((progreso - TEJIDO.revelar) / (1 - TEJIDO.revelar))]);
        }
      }
      const caja = tej.elemento.getBoundingClientRect();
      if (caja.bottom < 0 || caja.top > this.alto) continue;
      const alfa = 1 - suave(desvanecido);
      let punta: [number, number] | null = null;
      tej.forma.trazos.forEach((trazo, i) => {
        const a = this.avance(trazo, Math.min(progreso, 1));
        if (a <= 0) return;
        const color = COLORES[i % 3 === 2 ? 1 : 0]!;
        this.trazarParcial(trazo, a, caja.left, caja.top, color, alfa);
        if (a < 1) {
          const [x, y] = this.puntoEn(trazo, a);
          punta = [caja.left + x, caja.top + y];
        }
      });
      if (punta && tej.estado === 'tejiendo') puntas.set(tej, punta);
    }

    for (const [tej, valor] of revelados)
      tej.elemento.style.setProperty('--tejido', valor.toFixed(3));
    for (const tej of terminados) this.revelar(tej);

    // ---- hebras: navegan por un campo de flujo; las agujas siguen su punta
    const seguir = 1 - Math.pow(1 - 0.32, dt * 60);
    for (const h of this.hebras) {
      const p = h.puntos;
      let x = p[0] ?? 0;
      let y = p[1] ?? 0;
      const punta = h.aguja ? puntas.get(h.aguja) : undefined;
      if (punta) {
        const k = 1 - Math.pow(1 - 0.18, dt * 60);
        x += (punta[0] + Math.sin(t * 9 + h.fase) * 6 - x) * k;
        y += (punta[1] + Math.cos(t * 9 + h.fase) * 6 - y) * k;
      } else {
        let angulo =
          Math.sin(x * 0.0021 + t * 0.13 + h.fase) * 1.4 +
          Math.cos(y * 0.0027 - t * 0.11 + h.fase * 1.7) * 1.2 +
          h.fase;
        // Fuera de la pantalla, vuelve hacia el centro.
        const margen = 60;
        if (x < -margen || x > this.ancho + margen || y < -margen || y > this.alto + margen) {
          angulo = Math.atan2(this.alto / 2 - y, this.ancho / 2 - x);
        }
        x += Math.cos(angulo) * h.velocidad * dt;
        y += Math.sin(angulo) * h.velocidad * dt;
      }
      p[0] = x;
      p[1] = y;
      for (let k = 1; k < PUNTOS_POR_HEBRA; k++) {
        const i = k * 2;
        p[i] = (p[i] ?? 0) + ((p[i - 2] ?? 0) - (p[i] ?? 0)) * seguir;
        p[i + 1] = (p[i + 1] ?? 0) + ((p[i - 1] ?? 0) - (p[i + 1] ?? 0)) * seguir;
      }
      this.trazarHebra(h, punta ? 1 : 0.55);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Una fracción del contorno, en seda: halo tenue y hilo nítido. */
  private trazarParcial(
    trazo: Trazo,
    fraccion: number,
    x0: number,
    y0: number,
    color: [number, number, number],
    alfa: number
  ): void {
    const { ctx } = this;
    const limite = fraccion * trazo.largo;
    ctx.beginPath();
    const primero = trazo.puntos[0]!;
    ctx.moveTo(x0 + primero[0], y0 + primero[1]);
    for (let i = 1; i < trazo.puntos.length; i++) {
      if ((trazo.acumulado[i] ?? 0) > limite) break;
      const p = trazo.puntos[i]!;
      ctx.lineTo(x0 + p[0], y0 + p[1]);
    }
    ctx.strokeStyle = rgba(color, 0.18 * alfa);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = rgba(COLORES[3]!, 0.75 * alfa);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  /** Una hebra: curva suave por sus puntos, más tenue hacia la cola. */
  private trazarHebra(h: Hebra, intensidad: number): void {
    const { ctx } = this;
    const p = h.puntos;
    const color = COLORES[h.color]!;
    const cabeza = [p[0] ?? 0, p[1] ?? 0] as const;
    const cola = [
      p[(PUNTOS_POR_HEBRA - 1) * 2] ?? 0,
      p[(PUNTOS_POR_HEBRA - 1) * 2 + 1] ?? 0
    ] as const;
    const gradiente = ctx.createLinearGradient(cabeza[0], cabeza[1], cola[0], cola[1]);
    gradiente.addColorStop(0, rgba(COLORES[3]!, 0.7 * intensidad));
    gradiente.addColorStop(0.3, rgba(color, 0.45 * intensidad));
    gradiente.addColorStop(1, rgba(color, 0));
    ctx.beginPath();
    ctx.moveTo(cabeza[0], cabeza[1]);
    for (let k = 1; k < PUNTOS_POR_HEBRA - 1; k++) {
      const i = k * 2;
      const mx = ((p[i] ?? 0) + (p[i + 2] ?? 0)) / 2;
      const my = ((p[i + 1] ?? 0) + (p[i + 3] ?? 0)) / 2;
      ctx.quadraticCurveTo(p[i] ?? 0, p[i + 1] ?? 0, mx, my);
    }
    ctx.strokeStyle = gradiente;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Una segunda fibra, apenas separada: la seda no es un solo hilo.
    ctx.translate(0.8, 0.8);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.translate(-0.8, -0.8);
  }
}

/** Monta la seda si hay movimiento; si no, todo queda visible. */
export function iniciarSeda(): Seda | null {
  const lienzo = document.querySelector<HTMLCanvasElement>('[data-seda-lienzo]');
  if (!lienzo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  try {
    document.documentElement.classList.add('seda');
    return new Seda(lienzo);
  } catch (error) {
    document.documentElement.classList.remove('seda');
    console.warn('[seda] No se puede dibujar:', error);
    return null;
  }
}
