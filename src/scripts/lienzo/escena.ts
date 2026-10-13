/**
 * escena.ts
 * Une las piezas del lienzo: ajusta el tamaño, mueve la cámara, posa al
 * guía y dibuja en un único bucle el robot (WebGL2, pintor.ts) y la red viva
 * (Canvas 2D, red.ts), con la misma cámara.
 *
 * Lo que cambia con la historia (dónde está el guía, la cámara, la red, el
 * servicio activo) llega en un EstadoNarrativo que anima el scroll; aquí se
 * le suma lo que lo hace fluir:
 * - un muelle en su posición en pantalla: sigue al scroll con inercia, sin
 *   saltos, y se asienta con un leve rebote;
 * - al viajar se estira como una gota, se inclina hacia donde va, agita la
 *   cola y deja una estela de gotas que se reabsorbe al frenar;
 * - empieza como una gota que flota y toma forma de robot cuando la
 *   historia lo pide (`forma`, ligado al scroll), con algo de inercia.
 *
 * El guía señala la página: el servicio activo ([data-rama][data-activa]) o,
 * si no hay, el [data-guia] visible más cercano al centro. Lo alcanza con el
 * brazo de ese lado, rebota al cambiar de objetivo y un hilo de luz une su
 * mano con lo que señala. Los filamentos de la red nacen de su cuerpo. La
 * escena se aparta de los textos marcados con [data-zona-lectura].
 *
 * Algunas piezas de la página ([data-liquido]) llegan como metal líquido:
 * al entrar en pantalla su solidez (0..1) sigue al scroll con suavizado,
 * el sombreador las dibuja de gota a placa y el CSS (--solidez) hace
 * aparecer su contenido al final. Al subir, vuelven a licuarse.
 *
 * Si WebGL no está disponible la red sigue viva y la gota de respaldo (CSS)
 * se coloca donde estaría el guía. El bucle se detiene cuando el lienzo sale
 * de pantalla o la pestaña se oculta. Con "reducir movimiento" no hay
 * bucle: se dibuja un fotograma fijo y solo se repinta cuando algo cambia.
 */
import {
  aMundo,
  calcularCamara,
  ejesDePantalla,
  proyectar,
  type Camara,
  type Vec3
} from './camara';
import { Calidad, esTactil } from './calidad';
import { anclas, manoDe, MAX_PIEZAS, robot, type Brazo } from './escultura';
import type { EstadoNarrativo } from './narrativa';
import { crearPintor, type Pintor } from './pintor';
import { Red, type Densidad } from './red';
import { MAX_PANELES, MAX_ZONAS_DE_LECTURA } from './sombreador';

/** Cuánto gira la cámara siguiendo al puntero (radianes). */
const PARALAJE_PUNTERO = 0.06;
const SUAVIDAD_PUNTERO = 3;
/** Deriva lenta de la cámara para que el guía respire. */
const DERIVA = { amplitud: 0.03, periodo: 18 };
/**
 * Muelle de la posición en pantalla: rigidez (1/s²) y amortiguación
 * relativa (<1: se pasa un poco y vuelve, como un líquido que se asienta).
 */
const MUELLE_POSICION = { rigidez: 70, amortiguacion: 0.78 };
/** Rebote al cambiar de objetivo: amplitud, amortiguación (1/s) y frecuencia (rad/s). */
const REBOTE = { amplitud: 0.13, amortiguacion: 3.6, frecuencia: 13 };
/** Qué tan rápido sube o baja un brazo y viaja la mano de un elemento a otro (por segundo). */
const RAPIDEZ_DEL_BRAZO = 3.5;
const RAPIDEZ_DE_LA_MANO = 4;
/** Píxeles de margen antes de cambiar de brazo: evita que dude entre los dos. */
const HISTERESIS_BRAZO = 40;
/** Cuánto se gira hacia el lado que señala (radianes). */
const GIRO_AL_SENALAR = 0.2;
/** Viaje: estiramiento e inclinación máximos y velocidad (pantallas/s) que los alcanza. */
const VIAJE = { estiramiento: 0.12, inclinacion: 0.2, velocidadPlena: 1.1 };
/**
 * Formación (gota → robot): sigue a `forma` con esta rapidez (por segundo),
 * tras esperar un momento cuando WebGL queda listo. Al recargar a media
 * página, o en las interiores, la gota se condensa nada más aparecer.
 */
const FORMACION = { rapidez: 3.2, espera: 0.35 };
/** Qué tan rápido se enciende y se apaga la rama destacada (por segundo). */
const RAPIDEZ_DEL_FOCO = 5;
/** Con la escena así de apagada se dibuja un fotograma de cada dos. */
const ATENUACION_PARA_MEDIA_FRECUENCIA = 0.5;
/** Momento fijo que se dibuja con "reducir movimiento". */
const TIEMPO_ESTATICO = 7;
/**
 * Paneles líquidos: la solidez va de 0 (el borde superior entra por abajo)
 * a 1 cuando ese borde sube esta fracción de la pantalla, y la sigue con
 * esta rapidez (por segundo): continuo, sin pausas.
 */
const PANEL = { recorrido: 0.38, rapidez: 7 };
/** La red se dibuja con menos resolución que la pantalla: son líneas finas y luz. */
const TOPE_DPR_RED = { tactil: 1.25, escritorio: 1.5 };
const MAX_ZONAS_RED = 6;

interface Liquido {
  elemento: HTMLElement;
  /** Radio de las esquinas (px CSS), leído una vez. */
  radio: number;
  semilla: number;
  solidez: number;
  escrita: number;
  /**
   * Ya estaba en pantalla cuando WebGL quedó listo (al recargar a media
   * página): se queda sólido hasta que salga, no se licúa ante los ojos.
   */
  retenido: boolean;
}

interface Objetivo {
  elemento: HTMLElement;
  caja: DOMRect;
  /** Punto de la caja más cercano al guía, en píxeles del lienzo. */
  x: number;
  y: number;
}

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const suave = (x: number) => {
  const t = acotar(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Menos red en pantallas pequeñas o táctiles: misma historia, menos piezas. */
function densidad(): Densidad {
  const ancho = window.innerWidth;
  if (ancho < 768 || (esTactil() && ancho < 1024)) return 'ligera';
  if (ancho < 1180) return 'media';
  return 'completa';
}

export class Escena {
  private pintor: Pintor | null = null;
  private readonly red: Red | null = null;
  private webglListo = false;
  private readonly calidad = new Calidad();
  private readonly sinMovimiento: boolean;

  private ancho = 0;
  private alto = 0;
  private camara!: Camara;
  /** Giro suavizado que añaden el puntero y la deriva. */
  private readonly extra = { azimut: 0, elevacion: 0 };
  private puntero = { x: 0, y: 0 };
  /** Puntero en px del lienzo (para los nodos); null fuera de la ventana. */
  private punteroPx: { x: number; y: number } | null = null;
  private visible = true;
  private cuadro = 0;
  private saltar = false;
  private anterior = 0;
  private iniciado = false;
  private readonly inicio = performance.now();
  /** Tiempo del movimiento interno, integrado con el flujo: cambiar de velocidad no da saltos. */
  private fase = 0;
  private readonly limpieza = new AbortController();

  // El guía (todo suavizado fotograma a fotograma).
  private readonly piezas = new Float32Array(MAX_PIEZAS * 4);
  private anclas: Vec3[] = [];
  /** Posición en pantalla (desplazamiento de la cámara) y su velocidad, con muelle. */
  private posicion: [number, number] | null = null;
  private velocidadPantalla: [number, number] = [0, 0];
  private velocidad = 0;
  private inclinacion = 0;
  private direccion: Vec3 = [0, 0, 0];
  private brazo: Brazo = -1;
  private gestos: [number, number] = [0, 0];
  private mano: Vec3 | null = null;
  private giro = 0;
  private senalado: HTMLElement | null = null;
  private rebote = -Infinity;
  /** 0 gota, 1 robot: sigue a historia.forma desde que WebGL está listo. */
  private formacion = 0;
  private inicioFormacion = Infinity;

  private brilloFoco = 0;
  private focoVisible = -1;
  private focoDelPuntero = false;
  /** Textos que la escena despeja; se miden en cada fotograma. */
  private readonly lecturas = [...document.querySelectorAll<HTMLElement>('[data-zona-lectura]')];
  private readonly zonas = new Float32Array(MAX_ZONAS_DE_LECTURA * 4);
  private readonly respaldo: HTMLElement | null;
  private readonly liquidos: Liquido[];
  private readonly paneles = new Float32Array(MAX_PANELES * 4);
  private readonly estadosPanel = new Float32Array(MAX_PANELES * 4);
  private pxCss = 1;
  private liquidosActivos = false;
  private readonly observador: ResizeObserver;
  private readonly vigia: IntersectionObserver;

  constructor(
    private readonly contenedor: HTMLElement,
    lienzo: HTMLCanvasElement,
    lienzoRed: HTMLCanvasElement | null,
    private readonly historia: EstadoNarrativo,
    etiquetas: string[]
  ) {
    this.sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.respaldo = contenedor.querySelector<HTMLElement>('[data-respaldo]');
    this.liquidos = [...document.querySelectorAll<HTMLElement>('[data-liquido]')].map(
      (elemento, i) => ({
        elemento,
        radio: parseFloat(getComputedStyle(elemento).borderTopLeftRadius) || 10,
        semilla: i * 3.7,
        solidez: 1,
        escrita: 1,
        retenido: false
      })
    );
    const { signal } = this.limpieza;

    if (lienzoRed) {
      try {
        this.red = new Red(lienzoRed, densidad(), etiquetas);
      } catch (error) {
        console.warn('[lienzo] La red no se puede dibujar:', error);
      }
    }

    try {
      this.pintor = crearPintor(lienzo);
    } catch (error) {
      this.sinWebgl(error);
    }

    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(contenedor);

    this.vigia = new IntersectionObserver(([entrada]) => {
      this.visible = entrada?.isIntersecting ?? true;
      this.reanudar();
    });
    this.vigia.observe(contenedor);

    document.addEventListener('visibilitychange', () => this.reanudar(), { signal });

    if (!esTactil()) {
      window.addEventListener(
        'pointermove',
        (e) => {
          this.puntero = {
            x: (e.clientX / window.innerWidth - 0.5) * 2,
            y: (e.clientY / window.innerHeight - 0.5) * 2
          };
          const caja = this.contenedor.getBoundingClientRect();
          this.punteroPx = { x: e.clientX - caja.left, y: e.clientY - caja.top };
          if (this.sinMovimiento) this.solicitar();
        },
        { passive: true, signal }
      );
      document.addEventListener('pointerleave', () => (this.punteroPx = null), { signal });
    }
    // Sin bucle, se repinta al desplazarse (el guía señala otro elemento).
    if (this.sinMovimiento) {
      window.addEventListener('scroll', () => this.solicitar(), { passive: true, signal });
    }

    if (this.pintor) {
      // Cada fotograma pintado informa de su duración; el guía se muestra con el primero.
      this.pintor.alPintar = (ms) => {
        this.contenedor.dataset.listo = 'true';
        const medioRitmo = this.historia.atenuacion >= ATENUACION_PARA_MEDIA_FRECUENCIA;
        if (!medioRitmo && !this.sinMovimiento && this.calidad.medir(ms)) this.ajustar();
      };
      this.pintor.preparar(
        () => {
          this.webglListo = true;
          this.inicioFormacion = this.ahora() + FORMACION.espera;
          this.ajustar();
        },
        (error) => this.sinWebgl(error)
      );
    }
    this.iniciado = true;
    this.ajustar();
  }

  /** Sin WebGL: queda la gota de respaldo y la red sigue viva. */
  private sinWebgl(error: unknown): void {
    console.warn('[lienzo] Se mantiene la gota de respaldo:', error);
    this.webglListo = false;
    this.pintor?.liberar();
    this.pintor = null;
    this.contenedor.dataset.sinWebgl = 'true';
    this.solicitar();
  }

  private ahora = () =>
    this.sinMovimiento ? TIEMPO_ESTATICO : (performance.now() - this.inicio) / 1000;

  private ajustar(): void {
    if (!this.iniciado) return;
    const caja = this.contenedor.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) return;
    this.ancho = caja.width;
    this.alto = caja.height;
    if (this.pintor && this.webglListo) {
      const [anchoPx, altoPx] = this.calidad.tamano(this.ancho, this.alto);
      this.pintor.configurar(anchoPx, altoPx);
      this.pxCss = anchoPx / this.ancho;
    }
    const tope = esTactil() ? TOPE_DPR_RED.tactil : TOPE_DPR_RED.escritorio;
    this.red?.redimensionar(this.ancho, this.alto, Math.min(window.devicePixelRatio || 1, tope));
    this.solicitar();
    this.reanudar();
  }

  private reanudar(): void {
    if (!this.iniciado) return;
    if (this.sinMovimiento) return this.solicitar();
    const activa = this.visible && document.visibilityState === 'visible';
    if (activa && !this.cuadro) {
      this.calidad.pausa();
      this.anterior = performance.now();
      this.cuadro = requestAnimationFrame(this.paso);
    } else if (!activa && this.cuadro) {
      cancelAnimationFrame(this.cuadro);
      this.cuadro = 0;
    }
  }

  /** Dibuja un fotograma suelto (modo sin movimiento o tras un cambio de tamaño). */
  private solicitar(): void {
    if (this.cuadro || !this.iniciado) return;
    this.cuadro = requestAnimationFrame((t) => {
      this.cuadro = 0;
      this.dibujar(this.sinMovimiento ? 0 : 1 / 60);
      this.anterior = t;
      if (!this.sinMovimiento) this.reanudar();
    });
  }

  private paso = (t: number) => {
    // Con el contenido en primer plano el guía casi no se ve: media frecuencia.
    const medioRitmo = this.historia.atenuacion >= ATENUACION_PARA_MEDIA_FRECUENCIA;
    this.saltar = !this.saltar;
    if (this.saltar && medioRitmo) {
      this.cuadro = requestAnimationFrame(this.paso);
      return;
    }
    const dt = Math.min((t - this.anterior) / 1000, 0.1);
    this.anterior = t;
    this.dibujar(dt);
    this.cuadro = requestAnimationFrame(this.paso);
  };

  /** Textos visibles que la escena despeja: en uv para el sombreador y en px para la red. */
  private medirZonas(): { numZonas: number; cajas: DOMRect[] } {
    const lienzo = this.contenedor.getBoundingClientRect();
    const cajas: DOMRect[] = [];
    let n = 0;
    for (const el of this.lecturas) {
      if (cajas.length >= MAX_ZONAS_RED) break;
      const caja = el.getBoundingClientRect();
      const arriba = caja.top - lienzo.top;
      const abajo = caja.bottom - lienzo.top;
      if (abajo < 0 || arriba > this.alto || caja.width === 0) continue;
      cajas.push(new DOMRect(caja.left - lienzo.left, arriba, caja.width, caja.height));
      if (n >= MAX_ZONAS_DE_LECTURA) continue;
      this.zonas.set(
        [
          (caja.left - lienzo.left) / this.ancho,
          1 - abajo / this.alto,
          (caja.right - lienzo.left) / this.ancho,
          1 - arriba / this.alto
        ],
        n * 4
      );
      n += 1;
    }
    return { numZonas: n, cajas };
  }

  /**
   * Lo que el guía señala: el servicio activo si se ve; si no, de los
   * [data-guia] visibles, el más cercano al centro vertical de la pantalla.
   * Se consulta en cada fotograma porque las escenas marcan y desmarcan
   * elementos (el servicio activo, la fase actual).
   */
  private buscarObjetivo(centro: { x: number; y: number }): Objetivo | null {
    const lienzo = this.contenedor.getBoundingClientRect();
    const visible = (caja: DOMRect) =>
      caja.width > 0 && caja.bottom > 72 && caja.top < window.innerHeight - 24;
    const crear = (elemento: HTMLElement, c: DOMRect): Objetivo => {
      const caja = new DOMRect(c.left - lienzo.left, c.top - lienzo.top, c.width, c.height);
      return {
        elemento,
        caja,
        x: acotar(centro.x, caja.left, caja.right),
        y: acotar(centro.y, caja.top, caja.bottom)
      };
    };
    const activo = document.querySelector<HTMLElement>('[data-rama][data-activa]');
    const cajaActiva = activo?.getBoundingClientRect();
    if (activo && cajaActiva && visible(cajaActiva)) return crear(activo, cajaActiva);

    let mejor: Objetivo | null = null;
    let distancia = Infinity;
    for (const el of document.querySelectorAll<HTMLElement>('[data-guia]')) {
      const caja = el.getBoundingClientRect();
      if (!visible(caja)) continue;
      const d = Math.abs((caja.top + caja.bottom) / 2 - window.innerHeight / 2);
      if (d >= distancia) continue;
      distancia = d;
      mejor = crear(el, caja);
    }
    return mejor;
  }

  /**
   * La posición en pantalla sigue a la historia con un muelle: el guía
   * viaja con inercia y se asienta con un leve rebote. Su velocidad da el
   * estiramiento, la inclinación, el agite de la cola y la estela.
   */
  private mover(dt: number): void {
    const h = this.historia;
    const meta: [number, number] = [h.desplazamientoX, h.desplazamientoY];
    if (!this.posicion || this.sinMovimiento) {
      this.posicion = [...meta];
      this.velocidadPantalla = [0, 0];
      return;
    }
    const { rigidez, amortiguacion } = MUELLE_POSICION;
    const friccion = 2 * Math.sqrt(rigidez) * amortiguacion;
    // Pasos cortos: el muelle es estable aunque un fotograma tarde.
    const pasos = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h0 = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      for (const e of [0, 1] as const) {
        const a = rigidez * (meta[e] - this.posicion[e]) - friccion * this.velocidadPantalla[e];
        this.velocidadPantalla[e] += a * h0;
        this.posicion[e] += this.velocidadPantalla[e] * h0;
      }
    }
    const [vx, vy] = this.velocidadPantalla;
    // Pantallas por segundo (el desplazamiento va de -1 a 1).
    const rapidez = Math.hypot(vx, vy) / 2;
    const objetivo = Math.min(1, rapidez / VIAJE.velocidadPlena);
    this.velocidad += (objetivo - this.velocidad) * Math.min(1, dt * 6);
    const inclinacion = acotar((vx / 2 / VIAJE.velocidadPlena) * VIAJE.inclinacion, -0.2, 0.2);
    this.inclinacion += (inclinacion - this.inclinacion) * Math.min(1, dt * 8);
  }

  /** Pose del guía: hacia dónde señala, con qué brazo, cuánto se estira, se inclina y rebota. */
  private posarGuia(tiempo: number, dt: number, objetivo: Objetivo | null): void {
    const h = this.historia;
    const inmediato = this.sinMovimiento;
    const seguir = (rapidez: number) => (inmediato ? 1 : Math.min(1, dt * rapidez));

    // Brazo del lado del objetivo, con margen para no dudar entre los dos.
    const centro = proyectar([0, 0.3, 0], this.camara, this.ancho, this.alto);
    if (objetivo) {
      if (objetivo.x < centro.x - HISTERESIS_BRAZO) this.brazo = -1;
      else if (objetivo.x > centro.x + HISTERESIS_BRAZO) this.brazo = 1;
    }
    // Mientras aún es gota no señala.
    const listo = suave((this.formacion - 0.7) / 0.3);
    const metas: [number, number] = objetivo
      ? [this.brazo < 0 ? listo : 0, this.brazo > 0 ? listo : 0]
      : [0, 0];
    this.gestos = [
      this.gestos[0] + (metas[0] - this.gestos[0]) * seguir(RAPIDEZ_DEL_BRAZO),
      this.gestos[1] + (metas[1] - this.gestos[1]) * seguir(RAPIDEZ_DEL_BRAZO)
    ];

    // La mano viaja de un elemento a otro en vez de saltar.
    if (objetivo) {
      const meta = aMundo(objetivo.x, objetivo.y, this.camara, this.ancho, this.alto);
      if (!this.mano) this.mano = meta;
      const k = seguir(RAPIDEZ_DE_LA_MANO);
      this.mano = [
        this.mano[0] + (meta[0] - this.mano[0]) * k,
        this.mano[1] + (meta[1] - this.mano[1]) * k,
        this.mano[2] + (meta[2] - this.mano[2]) * k
      ];
    }

    // Se gira un poco hacia el lado que señala.
    const giroMeta = h.giro + this.brazo * GIRO_AL_SENALAR * Math.max(...this.gestos);
    this.giro += (giroMeta - this.giro) * seguir(3);

    // Rebote de muelle cada vez que cambia lo que señala.
    if (objetivo && objetivo.elemento !== this.senalado) {
      if (this.senalado) this.rebote = tiempo;
      this.senalado = objetivo.elemento;
    }
    const desde = tiempo - this.rebote;
    // Sin rebote aún (rebote = -∞) no hay muelle: exp(-∞)·sin(∞) daría NaN y borraría al robot.
    const muelle =
      inmediato || !Number.isFinite(desde)
        ? 0
        : REBOTE.amplitud *
          Math.exp(-desde * REBOTE.amortiguacion) *
          Math.sin(desde * REBOTE.frecuencia);

    // La estela queda detrás del movimiento en pantalla, llevado al mundo.
    const [vx, vy] = this.velocidadPantalla;
    const [r, u] = ejesDePantalla(this.camara);
    const aspecto = this.ancho / this.alto;
    const dir: Vec3 = [
      r[0] * vx * aspecto + u[0] * vy,
      r[1] * vx * aspecto + u[1] * vy,
      r[2] * vx * aspecto + u[2] * vy
    ];
    const l = Math.hypot(...dir);
    const metaDir: Vec3 = l > 1e-4 ? [dir[0] / l, dir[1] / l, dir[2] / l] : this.direccion;
    const k = seguir(5);
    this.direccion = [
      this.direccion[0] + (metaDir[0] - this.direccion[0]) * k,
      this.direccion[1] + (metaDir[1] - this.direccion[1]) * k,
      this.direccion[2] + (metaDir[2] - this.direccion[2]) * k
    ];

    robot(
      {
        gestos: this.gestos,
        objetivo: this.mano ?? [0, 0, 0],
        giro: this.giro,
        elastico: muelle + this.velocidad * VIAJE.estiramiento,
        velocidad: this.velocidad,
        inclinacion: this.inclinacion,
        direccion: this.direccion,
        formacion: this.formacion,
        tiempo: inmediato ? 0 : this.fase
      },
      this.piezas
    );
    this.anclas = anclas(this.piezas, this.anclas);
  }

  /** Mano que señala, en px del lienzo, y cuánto está extendido el brazo. */
  private senal(objetivo: Objetivo | null) {
    if (!objetivo) return null;
    const gesto = this.gestos[this.brazo < 0 ? 0 : 1];
    if (gesto < 0.5) return null;
    const i = manoDe(this.brazo) * 4;
    const mano: Vec3 = [this.piezas[i] ?? 0, this.piezas[i + 1] ?? 0, this.piezas[i + 2] ?? 0];
    const p = proyectar(mano, this.camara, this.ancho, this.alto);
    if (!p.delante) return null;
    return { caja: objetivo.caja, mano: { x: p.x, y: p.y }, fuerza: suave((gesto - 0.5) / 0.4) };
  }

  /**
   * Solidez de cada panel líquido según dónde está su borde superior. Solo
   * lee el DOM; la escritura (--solidez) va al final del fotograma. Sin
   * WebGL o sin movimiento los paneles son sólidos desde el principio.
   */
  private medirLiquidos(dt: number): number {
    const activo = this.webglListo && !this.sinMovimiento;
    const recienActivo = activo && !this.liquidosActivos;
    this.liquidosActivos = activo;
    const alto = window.innerHeight;
    const lienzo = this.contenedor.getBoundingClientRect();
    let n = 0;
    for (const l of this.liquidos) {
      const caja = l.elemento.getBoundingClientRect();
      // Fuera de pantalla no hay nada que ver: salta directo a su estado.
      const enPantalla = caja.bottom > 0 && caja.top < alto && caja.width > 0;
      if (recienActivo && enPantalla) l.retenido = true;
      if (!enPantalla) l.retenido = false;
      const meta =
        activo && !l.retenido ? acotar((alto - caja.top) / (alto * PANEL.recorrido), 0, 1) : 1;
      if (!enPantalla || !activo) l.solidez = meta;
      else l.solidez += (meta - l.solidez) * Math.min(1, dt * PANEL.rapidez);
      if (Math.abs(meta - l.solidez) < 0.002) l.solidez = meta;
      if (!enPantalla || l.solidez >= 0.999 || l.solidez <= 0.001 || n >= MAX_PANELES) continue;
      this.paneles.set(
        [
          (caja.left - lienzo.left) / this.ancho,
          1 - (caja.bottom - lienzo.top) / this.alto,
          (caja.right - lienzo.left) / this.ancho,
          1 - (caja.top - lienzo.top) / this.alto
        ],
        n * 4
      );
      this.estadosPanel.set([l.solidez, l.semilla, l.radio, 0], n * 4);
      n += 1;
    }
    return n;
  }

  /** El contenido de cada panel aparece cuando el líquido ya es sólido (CSS lee --solidez). */
  private escribirLiquidos(): void {
    for (const l of this.liquidos) {
      if (Math.abs(l.solidez - l.escrita) < 0.001) continue;
      l.escrita = l.solidez;
      l.elemento.style.setProperty('--solidez', l.solidez.toFixed(3));
    }
  }

  /** Sin WebGL, la gota de respaldo sigue al guía (centro y tamaño aparentes). */
  private colocarRespaldo(): void {
    if (!this.respaldo || !this.red || this.webglListo) return;
    const centro = this.red.centro(this.camara);
    this.respaldo.style.setProperty('--x', `${centro.x.toFixed(1)}px`);
    this.respaldo.style.setProperty('--y', `${centro.y.toFixed(1)}px`);
    this.respaldo.style.setProperty('--lado', `${(centro.escala * 2.2).toFixed(1)}px`);
    this.respaldo.style.setProperty('--apagado', this.historia.atenuacion.toFixed(3));
  }

  private dibujar(dt: number): void {
    if (this.ancho === 0) return;
    const tiempo = this.ahora();
    const h = this.historia;
    // Lecturas del DOM antes de cualquier escritura.
    const { numZonas, cajas } = this.medirZonas();
    const numPaneles = this.medirLiquidos(dt);

    if (!this.sinMovimiento) {
      const seguir = Math.min(1, dt * SUAVIDAD_PUNTERO);
      const deriva = Math.sin((tiempo / DERIVA.periodo) * Math.PI * 2) * DERIVA.amplitud;
      this.extra.azimut +=
        (this.puntero.x * PARALAJE_PUNTERO + deriva - this.extra.azimut) * seguir;
      this.extra.elevacion +=
        (this.puntero.y * PARALAJE_PUNTERO * 0.5 - this.extra.elevacion) * seguir;
      this.fase += dt * h.flujo;
      // El scroll ya llega suavizado (scrub); esto solo absorbe saltos (anclas, recargas).
      const meta = tiempo < this.inicioFormacion ? 0 : h.forma;
      this.formacion += (meta - this.formacion) * Math.min(1, dt * FORMACION.rapidez);
      if (Math.abs(meta - this.formacion) < 0.001) this.formacion = meta;
    } else {
      this.fase = TIEMPO_ESTATICO * h.flujo;
      this.formacion = h.forma;
    }
    // Sin WebGL no hay gota que condensar: la red se ancla al cuerpo del guía.
    if (!this.pintor) this.formacion = 1;

    this.mover(dt);
    const [dx, dy] = this.posicion ?? [h.desplazamientoX, h.desplazamientoY];
    this.camara = calcularCamara(
      {
        ...h,
        azimut: h.azimut + this.extra.azimut,
        elevacion: h.elevacion + this.extra.elevacion,
        desplazamientoX: dx,
        desplazamientoY: dy
      },
      this.ancho / this.alto
    );
    const centro = proyectar([0, 0.3, 0], this.camara, this.ancho, this.alto);
    const objetivo = this.buscarObjetivo(centro);
    this.posarGuia(tiempo, dt, objetivo);

    // Rama destacada: el servicio activo manda; si no hay, el nodo bajo el puntero.
    const bajoPuntero =
      this.punteroPx && this.red ? this.red.ramaBajo(this.punteroPx.x, this.punteroPx.y, h) : -1;
    const deseado = h.foco >= 0 ? h.foco : bajoPuntero;
    // Se enciende y se apaga despacio; al cambiar de rama, primero se apaga.
    if (deseado !== this.focoVisible && this.brilloFoco < 0.05) {
      this.focoVisible = deseado;
      this.focoDelPuntero = h.foco < 0;
    }
    const meta = deseado >= 0 && deseado === this.focoVisible ? 1 : 0;
    this.brilloFoco = this.sinMovimiento
      ? meta
      : this.brilloFoco + (meta - this.brilloFoco) * Math.min(1, dt * RAPIDEZ_DEL_FOCO);

    this.red?.dibujar({
      tiempo,
      dt: this.sinMovimiento ? 0 : dt,
      fase: this.fase,
      camara: this.camara,
      estado: h,
      foco: this.focoVisible,
      brilloFoco: this.brilloFoco,
      etiquetarFoco: this.focoDelPuntero,
      anclas: this.anclas,
      senal: this.senal(objetivo),
      zonas: cajas,
      movimiento: !this.sinMovimiento
    });
    this.colocarRespaldo();
    this.escribirLiquidos();

    // Si el fotograma anterior aún se está pintando, este se salta.
    if (this.pintor && this.webglListo) {
      this.pintor.dibujar({
        tiempo,
        detalle: this.calidad.detalle,
        camara: this.camara,
        fase: this.fase,
        atenuacion: h.atenuacion,
        red: h.red,
        grietas: h.grietas,
        piezas: this.piezas,
        zonas: this.zonas,
        numZonas,
        paneles: this.paneles,
        estadosPanel: this.estadosPanel,
        numPaneles,
        pxCss: this.pxCss
      });
    }
  }

  liberar(): void {
    cancelAnimationFrame(this.cuadro);
    this.limpieza.abort();
    this.observador.disconnect();
    this.vigia.disconnect();
    this.pintor?.liberar();
    this.red?.liberar();
    for (const l of this.liquidos) l.elemento.style.removeProperty('--solidez');
  }
}

/**
 * Arranca la escena. Sin WebGL queda la gota de respaldo y, si hay Canvas
 * 2D, la red. `etiquetas` son los nombres de las ramas (los servicios).
 */
export function iniciarLienzo(historia: EstadoNarrativo, etiquetas: string[] = []): Escena | null {
  const contenedor = document.querySelector<HTMLElement>('[data-lienzo]');
  const lienzo = contenedor?.querySelector<HTMLCanvasElement>('canvas[data-escultura]');
  const lienzoRed = contenedor?.querySelector<HTMLCanvasElement>('canvas[data-red]') ?? null;
  if (!contenedor || !lienzo) return null;
  try {
    return new Escena(contenedor, lienzo, lienzoRed, historia, etiquetas);
  } catch (error) {
    console.warn('[lienzo] Se mantiene la imagen de respaldo:', error);
    return null;
  }
}
