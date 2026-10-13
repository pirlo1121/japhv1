/**
 * escena.ts
 * Une las piezas del lienzo: ajusta el tamaño, mueve la cámara, compone la
 * arquitectura y la escultura y dibuja en un único bucle la escena (WebGL2,
 * pintor.ts) y la red viva (Canvas 2D, red.ts), con la misma cámara.
 *
 * Lo que cambia con la historia (la cámara, el plano de la arquitectura,
 * la forma de la escultura, la red, el servicio activo, la fase del
 * proceso) llega en un EstadoNarrativo que anima el scroll; aquí se le suma
 * lo que lo hace vivo y suave:
 * - un muelle en la posición en pantalla del objetivo: sigue al scroll con
 *   inercia, sin saltos;
 * - la escultura flota y ondula (escultura.ts);
 * - al cargar, la gota se ve ya en su póster (Lienzo.astro) y, cuando WebGL
 *   pinta, la arquitectura emerge de la oscuridad (REVELADO): misterio,
 *   luego descubrimiento;
 * - la cámara responde un poco al puntero y deriva despacio.
 *
 * La escena se aparta de los textos marcados con [data-zona-lectura]: baja
 * los brillos de la escultura y apaga las aristas detrás de ellos.
 *
 * Si WebGL no está disponible la red sigue viva y el póster de la gota se
 * coloca donde estaría la escultura. El bucle se detiene cuando el lienzo
 * sale de pantalla o la pestaña se oculta. Con "reducir movimiento" no hay
 * bucle: se dibuja un fotograma fijo y solo se repinta cuando algo cambia.
 */
import { arquitectura, type Arquitectura } from './arquitectura';
import { calcularCamara, crearProyector, type Camara, type Proyeccion, type Vec3 } from './camara';
import { Calidad, esTactil } from './calidad';
import { anclas, liquido, MAX_LIQUIDO } from './escultura';
import type { EstadoNarrativo } from './narrativa';
import { crearPintor, type Pintor } from './pintor';
import { Red, type Densidad } from './red';
import { MAX_ZONAS_DE_LECTURA } from './sombreador';

/** Cuánto gira la cámara siguiendo al puntero (radianes). */
const PARALAJE_PUNTERO = 0.05;
const SUAVIDAD_PUNTERO = 3;
/** Deriva lenta de la cámara para que la escena respire. */
const DERIVA = { amplitud: 0.025, periodo: 20 };
/**
 * Segundos en que entran el giro del puntero y la deriva cuando WebGL
 * queda listo: el primer fotograma es el del póster (Lienzo.astro) y desde
 * ahí la cámara empieza a moverse, sin saltos.
 */
const ENTRADA = 1.5;
/**
 * La arquitectura emerge de la oscuridad cuando WebGL pinta: espera
 * (segundos) y duración. Mientras, la gota del póster ya está viva.
 */
const REVELADO = { espera: 0.5, duracion: 2.4 };
/**
 * Muelle de la posición en pantalla del objetivo: rigidez (1/s²) y
 * amortiguación relativa (1 = sin rebote: la cámara no se pasa de largo).
 */
const MUELLE_POSICION = { rigidez: 40, amortiguacion: 1 };
/**
 * Forma (gota → cinta): sigue a `forma` con esta rapidez (por segundo),
 * tras esperar un momento cuando WebGL queda listo. Al recargar a media
 * página, la gota se estira nada más aparecer.
 */
const FORMACION = { rapidez: 3.2, espera: 0.35 };
/** Qué tan rápido se enciende y se apaga el servicio destacado (por segundo). */
const RAPIDEZ_DEL_FOCO = 5;
/** Con la escultura así de apagada se dibuja un fotograma de cada dos. */
const ATENUACION_PARA_MEDIA_FRECUENCIA = 0.5;
/** Momento fijo que se dibuja con "reducir movimiento" (la gota en la fase 0, la del póster). */
const TIEMPO_ESTATICO = 0;
/** La red se dibuja con menos resolución que la pantalla: son líneas finas y luz. */
const TOPE_DPR_RED = { tactil: 1.25, escritorio: 1.5 };
/** Y con un tope de píxeles: en tablets y pantallas grandes entregar el lienzo pesa más que dibujarlo. */
const TOPE_PIXELES_RED = { tactil: 0.7e6, escritorio: 1.4e6 };
const MAX_ZONAS_RED = 6;

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const suave = (x: number) => {
  const t = acotar(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Menos red y menos arquitectura en pantallas pequeñas o táctiles: misma historia, menos piezas. */
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
  private ligera = false;

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

  /** Posición en pantalla del objetivo (desplazamiento de la cámara) y su velocidad, con muelle. */
  private posicion: [number, number] | null = null;
  private velocidadPantalla: [number, number] = [0, 0];
  /** 0 gota, 1 cinta: sigue a historia.forma desde que WebGL está listo. */
  private formacion = 0;
  private inicioFormacion = Infinity;
  /** Cuándo quedó listo WebGL (s): desde ahí entra el movimiento y emerge la arquitectura. */
  private entrada = 0;
  private revelado = 0;
  private posterOculto = false;

  private readonly piezas = new Float32Array(MAX_LIQUIDO * 4);
  private anclas: Vec3[] = [];
  private estructura: Arquitectura | undefined;
  private brilloFoco = 0;
  private focoVisible = -1;
  private focoDelPuntero = false;
  /** Textos que la escena despeja; se miden en cada fotograma. */
  private readonly lecturas = [...document.querySelectorAll<HTMLElement>('[data-zona-lectura]')];
  private readonly zonas = new Float32Array(MAX_ZONAS_DE_LECTURA * 4);
  private readonly respaldo: HTMLElement | null;
  private readonly proyeccion: Proyeccion = { x: 0, y: 0, escala: 1, profundidad: 1 };
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
    this.ligera = densidad() === 'ligera';
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
    // Sin bucle, se repinta al desplazarse (cambia la escena).
    if (this.sinMovimiento) {
      window.addEventListener('scroll', () => this.solicitar(), { passive: true, signal });
    }

    if (this.pintor) {
      // Cada fotograma pintado informa de su duración; la escena se muestra con el primero.
      this.pintor.alPintar = (ms) => {
        this.contenedor.dataset.listo = 'true';
        const medioRitmo = this.historia.atenuacion >= ATENUACION_PARA_MEDIA_FRECUENCIA;
        if (!medioRitmo && !this.sinMovimiento && this.calidad.medir(ms)) this.ajustar();
      };
      this.pintor.preparar(
        () => {
          this.webglListo = true;
          // Arranca en el fotograma del póster: fase 0, sin giro de cámara, arquitectura oculta.
          this.fase = 0;
          this.entrada = this.ahora();
          this.inicioFormacion = this.entrada + FORMACION.espera;
          this.ajustar();
        },
        (error) => this.sinWebgl(error)
      );
    }
    this.iniciado = true;
    this.ajustar();
  }

  /** Sin WebGL: el póster de la gota queda como respaldo y la red sigue viva. */
  private sinWebgl(error: unknown): void {
    console.warn('[lienzo] Se mantiene la gota de respaldo:', error);
    this.webglListo = false;
    this.pintor?.liberar();
    this.pintor = null;
    this.contenedor.dataset.sinWebgl = 'true';
    // El póster pasa a ser la gota de respaldo: sigue a la escultura.
    this.posterOculto = false;
    if (this.respaldo) delete this.respaldo.dataset.oculto;
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
    this.ligera = densidad() === 'ligera';
    if (this.pintor && this.webglListo) {
      const [anchoPx, altoPx] = this.calidad.tamano(this.ancho, this.alto);
      this.pintor.configurar(anchoPx, altoPx);
    }
    const tipo = esTactil() ? 'tactil' : 'escritorio';
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      TOPE_DPR_RED[tipo],
      Math.sqrt(TOPE_PIXELES_RED[tipo] / (this.ancho * this.alto))
    );
    this.red?.redimensionar(this.ancho, this.alto, dpr);
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
    // Con el contenido en primer plano la escultura casi no se ve: media frecuencia.
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

  /** La posición en pantalla del objetivo sigue a la historia con un muelle: viaja con inercia. */
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
  }

  /**
   * Sin WebGL, el póster de la gota sigue a la escultura (centro y px por
   * unidad del mundo). Mientras WebGL carga se queda en su sitio; si al
   * recargar a media página la escena ya no es la gota, se oculta.
   */
  private colocarRespaldo(): void {
    if (!this.respaldo || this.webglListo) return;
    if (this.pintor) {
      if (!this.posterOculto && this.historia.forma > 0.02) {
        this.posterOculto = true;
        this.respaldo.dataset.oculto = '';
      }
      return;
    }
    const centro = crearProyector(this.camara, this.ancho, this.alto)([0, 0, 0], this.proyeccion);
    this.respaldo.style.setProperty('--x', `${centro.x.toFixed(1)}px`);
    this.respaldo.style.setProperty('--y', `${centro.y.toFixed(1)}px`);
    this.respaldo.style.setProperty('--s', `${centro.escala.toFixed(2)}px`);
    this.respaldo.style.setProperty('--apagado', this.historia.atenuacion.toFixed(3));
  }

  private dibujar(dt: number): void {
    if (this.ancho === 0) return;
    const tiempo = this.ahora();
    const h = this.historia;
    // Lecturas del DOM antes de cualquier escritura.
    const { numZonas, cajas } = this.medirZonas();
    const desde = tiempo - this.entrada;

    if (!this.sinMovimiento) {
      const seguir = Math.min(1, dt * SUAVIDAD_PUNTERO);
      // Hasta que WebGL pinta, la cámara se queda en el encuadre del póster.
      const entra = !this.pintor ? 1 : this.webglListo ? suave(desde / ENTRADA) : 0;
      const deriva = Math.sin((desde / DERIVA.periodo) * Math.PI * 2) * DERIVA.amplitud;
      this.extra.azimut +=
        ((this.puntero.x * PARALAJE_PUNTERO + deriva) * entra - this.extra.azimut) * seguir;
      this.extra.elevacion +=
        (this.puntero.y * PARALAJE_PUNTERO * 0.5 * entra - this.extra.elevacion) * seguir;
      this.fase += dt * h.flujo;
      // El scroll ya llega suavizado (scrub); esto solo absorbe saltos (anclas, recargas).
      const meta = tiempo < this.inicioFormacion ? 0 : h.forma;
      this.formacion += (meta - this.formacion) * Math.min(1, dt * FORMACION.rapidez);
      if (Math.abs(meta - this.formacion) < 0.001) this.formacion = meta;
      // La arquitectura emerge de la oscuridad cuando WebGL pinta.
      this.revelado = this.webglListo ? suave((desde - REVELADO.espera) / REVELADO.duracion) : 0;
    } else {
      this.fase = TIEMPO_ESTATICO * h.flujo;
      this.formacion = h.forma;
      this.revelado = 1;
    }
    // Sin WebGL no hay gota que estirar: la red se ancla a la cinta.
    if (!this.pintor) this.formacion = 1;

    // Servicio destacado: el activo manda; si no hay, el nodo bajo el puntero.
    const bajoPuntero =
      this.punteroPx && this.red ? this.red.ramaBajo(this.punteroPx.x, this.punteroPx.y, h) : -1;
    const deseado = h.foco >= 0 ? h.foco : bajoPuntero;
    // Se enciende y se apaga despacio; al cambiar de rama, primero se apaga.
    if (deseado !== this.focoVisible && this.brilloFoco < 0.05) {
      this.focoVisible = deseado;
      this.focoDelPuntero = h.foco < 0;
    }
    const metaFoco = deseado >= 0 && deseado === this.focoVisible ? 1 : 0;
    this.brilloFoco = this.sinMovimiento
      ? metaFoco
      : this.brilloFoco + (metaFoco - this.brilloFoco) * Math.min(1, dt * RAPIDEZ_DEL_FOCO);

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

    this.estructura = arquitectura(
      {
        escena: h.escena,
        foco: this.focoDelPuntero ? -1 : this.focoVisible,
        brilloFoco: this.brilloFoco,
        etapa: h.etapa,
        revelado: this.revelado,
        ligera: this.ligera
      },
      this.estructura
    );
    liquido(
      {
        forma: this.formacion,
        cinta: this.estructura.cinta,
        tiempo: this.sinMovimiento ? 0 : this.fase
      },
      this.piezas
    );
    this.anclas = anclas(this.piezas, this.anclas);

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
      zonas: cajas,
      movimiento: !this.sinMovimiento
    });
    this.colocarRespaldo();

    // Si el fotograma anterior aún se está pintando, este se salta.
    if (this.pintor && this.webglListo) {
      this.pintor.dibujar({
        tiempo: this.sinMovimiento ? 0 : Math.max(desde, 0),
        detalle: this.calidad.detalle,
        camara: this.camara,
        fase: this.sinMovimiento ? 0 : this.fase,
        atenuacion: h.atenuacion,
        red: h.red,
        liquido: this.piezas,
        cajas: this.estructura.cajas,
        numCajas: this.estructura.numCajas,
        luz: this.estructura.luz,
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
 * Arranca la escena. Sin WebGL queda el póster de la gota y, si hay Canvas
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
