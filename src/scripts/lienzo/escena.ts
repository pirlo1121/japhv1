/**
 * escena.ts
 * Une las piezas del lienzo: ajusta el tamaño, mueve la cámara y dibuja la
 * escultura (WebGL2, pintor.ts) y la red viva (Canvas 2D, red.ts) en un
 * único bucle de animación, con la misma cámara.
 *
 * Lo que cambia con la historia (forma, cámara, red, grietas, foco) llega en
 * un EstadoNarrativo que anima el scroll; aquí solo se le suma la reacción
 * al puntero y una deriva lenta.
 *
 * La escena también ata el contenido a la red: el servicio activo
 * ([data-rama][data-activa]) enciende su rama y un hilo lo une con su ancla en
 * la escultura; pasar el
 * puntero por un nodo lo ilumina y muestra su nombre. La escultura y la red
 * se apartan de los textos marcados con [data-zona-lectura].
 *
 * Si WebGL no está disponible la red sigue viva y la gota de respaldo (CSS)
 * se coloca donde estaría la escultura. El bucle se detiene cuando el lienzo
 * sale de pantalla o la pestaña se oculta. Con "reducir movimiento" no hay
 * bucle: se dibuja un fotograma fijo y solo se repinta cuando algo cambia.
 */
import { calcularCamara, type Camara } from './camara';
import { Calidad, esTactil } from './calidad';
import type { EstadoNarrativo } from './narrativa';
import { crearPintor, type Pintor } from './pintor';
import { Red, type Densidad } from './red';
import { MAX_ZONAS_DE_LECTURA } from './sombreador';

/** Cuánto gira la cámara siguiendo al puntero (radianes). */
const PARALAJE_PUNTERO = 0.06;
const SUAVIDAD_PUNTERO = 3;
/** Deriva lenta de la cámara para que la escultura respire. */
const DERIVA = { amplitud: 0.03, periodo: 18 };
/** Qué tan rápido se enciende y se apaga la pieza destacada (por segundo). */
const RAPIDEZ_DEL_FOCO = 5;
/** Con la escena así de apagada se dibuja un fotograma de cada dos. */
const ATENUACION_PARA_MEDIA_FRECUENCIA = 0.5;
/** Momento fijo que se dibuja con "reducir movimiento". */
const TIEMPO_ESTATICO = 7;
/** La red se dibuja con menos resolución que la pantalla: son líneas finas y luz. */
const TOPE_DPR_RED = { tactil: 1.25, escritorio: 1.5 };
const MAX_ZONAS_RED = 6;

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
  private brilloFoco = 0;
  private focoVisible = -1;
  private focoDelPuntero = false;
  /** Textos que la escultura y la red despejan; se miden en cada fotograma. */
  private readonly lecturas = [...document.querySelectorAll<HTMLElement>('[data-zona-lectura]')];
  private readonly zonas = new Float32Array(MAX_ZONAS_DE_LECTURA * 4);
  private readonly respaldo: HTMLElement | null;
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
    // Sin bucle, se repinta al desplazarse (las zonas de lectura y la historia cambian).
    if (this.sinMovimiento) {
      window.addEventListener('scroll', () => this.solicitar(), { passive: true, signal });
    }

    if (this.pintor) {
      // Cada fotograma pintado informa de su duración; la escultura se muestra con el primero.
      this.pintor.alPintar = (ms) => {
        this.contenedor.dataset.listo = 'true';
        const medioRitmo = this.historia.atenuacion >= ATENUACION_PARA_MEDIA_FRECUENCIA;
        if (!medioRitmo && !this.sinMovimiento && this.calidad.medir(ms)) this.ajustar();
      };
      this.pintor.preparar(
        () => {
          this.webglListo = true;
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
    // Con el contenido en primer plano la escena casi no se ve: media frecuencia.
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

  /** El texto del servicio activo, en px del lienzo, para unirlo con su nodo. */
  private origenDelFoco(): DOMRect | null {
    const el = document.querySelector<HTMLElement>('[data-rama][data-activa]');
    if (!el) return null;
    const caja = el.getBoundingClientRect();
    const lienzo = this.contenedor.getBoundingClientRect();
    if (caja.bottom < 0 || caja.top > window.innerHeight || caja.height === 0) return null;
    return new DOMRect(caja.left - lienzo.left, caja.top - lienzo.top, caja.width, caja.height);
  }

  /** Sin WebGL, la gota de respaldo sigue a la escultura (centro y tamaño aparentes). */
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
    const origenFoco = this.origenDelFoco();

    if (!this.sinMovimiento) {
      const seguir = Math.min(1, dt * SUAVIDAD_PUNTERO);
      const deriva = Math.sin((tiempo / DERIVA.periodo) * Math.PI * 2) * DERIVA.amplitud;
      this.extra.azimut +=
        (this.puntero.x * PARALAJE_PUNTERO + deriva - this.extra.azimut) * seguir;
      this.extra.elevacion +=
        (this.puntero.y * PARALAJE_PUNTERO * 0.5 - this.extra.elevacion) * seguir;
      this.fase += dt * h.flujo;
    } else {
      this.fase = TIEMPO_ESTATICO * h.flujo;
    }
    this.camara = calcularCamara(
      {
        ...h,
        azimut: h.azimut + this.extra.azimut,
        elevacion: h.elevacion + this.extra.elevacion
      },
      this.ancho / this.alto
    );

    // Foco: el servicio activo en la página manda; si no hay, el nodo bajo el puntero.
    const bajoPuntero =
      this.punteroPx && this.red ? this.red.ramaBajo(this.punteroPx.x, this.punteroPx.y, h) : -1;
    const deseado = h.foco >= 0 ? h.foco : bajoPuntero;
    // El foco se enciende y se apaga despacio; al cambiar de pieza, primero se apaga.
    if (deseado !== this.focoVisible && this.brilloFoco < 0.05) {
      this.focoVisible = deseado;
      this.focoDelPuntero = h.foco < 0;
    }
    const objetivo = deseado >= 0 && deseado === this.focoVisible ? 1 : 0;
    this.brilloFoco = this.sinMovimiento
      ? objetivo
      : this.brilloFoco + (objetivo - this.brilloFoco) * Math.min(1, dt * RAPIDEZ_DEL_FOCO);

    this.red?.dibujar({
      tiempo,
      dt: this.sinMovimiento ? 0 : dt,
      fase: this.fase,
      camara: this.camara,
      estado: h,
      foco: this.focoVisible,
      brilloFoco: this.brilloFoco,
      etiquetarFoco: this.focoDelPuntero,
      origenFoco: this.focoDelPuntero ? null : origenFoco,
      zonas: cajas,
      movimiento: !this.sinMovimiento
    });
    this.colocarRespaldo();

    // Si el fotograma anterior aún se está pintando, este se salta.
    if (this.pintor && this.webglListo) {
      this.pintor.dibujar({
        tiempo,
        detalle: this.calidad.detalle,
        camara: this.camara,
        forma: h.forma,
        fase: this.fase,
        atenuacion: h.atenuacion,
        red: h.red,
        grietas: h.grietas,
        foco: this.focoVisible,
        brilloFoco: this.brilloFoco,
        zonas: this.zonas,
        numZonas
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
