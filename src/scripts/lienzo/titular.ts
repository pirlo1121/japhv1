/**
 * titular.ts
 * Titulares que nacen de una gota de metal líquido ([data-gota]). Cada uno,
 * al entrar en pantalla, recibe una gota que cae desde encima, se posa y se
 * derrama en sus letras, que se vuelven de cromo y dejan paso al texto real.
 * El de la escena 02 ([data-gota="burbuja"]) es especial: mientras la gota
 * grande aún no es robot, una burbuja brota de ella, se suelta, cruza la
 * pantalla y se vuelve el titular; el resto de la gota se vuelve el robot.
 *
 * - Las letras: la máscara de cada titular (la misma medición que usa la
 *   seda) se dibuja una sola vez, una por momento ocioso, y viaja al
 *   pintor, que calcula su campo de distancias fuera de la página
 *   (distancias.ts) y lo coloca en una sola textura (atlas). Por fotograma solo se muestrea,
 *   y solo dentro de la caja de los titulares que están cambiando (hasta
 *   MAX_TITULARES) y de su gota.
 * - El progreso (0..1): el de la burbuja lo da la historia (scroll); el del
 *   resto sigue a la posición del titular en pantalla, con suavizado, y es
 *   reversible. Lo que ya se veía al activarse no se licúa ante los ojos.
 * - El CSS (--gota) muestra el texto real al final. Hasta que su mapa está
 *   listo, sin WebGL o sin movimiento, el titular se ve normal.
 */
import { dibujarLetras } from '@/scripts/seda/forma';
import { crearProyector, ejesDePantalla, type Camara, type Proyeccion, type Vec3 } from './camara';
import { PIEZA, type Pose } from './escultura';
import type { Pintor } from './pintor';
import type { MascaraDeTexto } from './distancias';
import { MAX_TITULARES, RANGO_TITULAR } from './sombreador';

/**
 * Burbuja de la escena 02. Tramos del progreso (0..1): brota de la gota, se
 * suelta y vuela en 3D, relevo a 2D (al final de la suelta), vuela por la
 * pantalla y se extiende en las letras. Las distancias (desde el centro de
 * la gota, que mide 1.05) y el radio son de la burbuja 3D, en el mundo: nace
 * dentro (`dentro`), asoma por la superficie (`asoma`) y se aleja hasta
 * `distancia`.
 */
export const DESPRENDIMIENTO = {
  brote: 0.15,
  suelta: 0.3,
  relevo: 0.06,
  llegada: 0.62,
  dentro: 0.6,
  asoma: 1.2,
  distancia: 1.95,
  radio: 0.26,
  /** Desde aquí el texto real aparece mientras el cromo se desvanece (igual que en base.css). */
  revelado: 0.92
} as const;

/**
 * El resto de titulares: la gota aparece sobre el titular (`altura` radios
 * por encima de su borde), cae, se posa y se extiende. Tramos del progreso
 * y su radio (fracción del tamaño de su letra). El progreso va de 0 (el
 * titular asoma por abajo) a 1 cuando su borde superior ha subido
 * `recorrido` de la pantalla, y lo sigue con `rapidez` (por segundo).
 */
export const CAIDA = {
  aparece: 0.3,
  cae: 0.55,
  altura: 3,
  radio: 0.42,
  recorrido: 0.5,
  rapidez: 6
} as const;

/**
 * Dónde aterriza la gota (fracción de la caja del titular), cuánto se
 * arquea el vuelo de la burbuja (fracción del recorrido) y cuánto mira
 * hacia la cámara al brotar (para que no salga por detrás de la gota).
 */
const TITULAR = { aterrizaje: [0.6, 0.55], arco: 0.18, haciaCamara: 0.45 } as const;

/** Lado máximo del atlas de letras (WebGL2 garantiza al menos 2048). */
const LADO_ATLAS = 2048;
/** Texels de separación entre titulares en el atlas: el filtrado no mezcla vecinos. */
const SEPARACION = 2;

/**
 * La máscara de las letras del elemento (1 = letra) con RANGO_TITULAR px
 * CSS de margen alrededor de su caja (`cssAncho` × `cssAlto` en total), a
 * `escala` texels por px CSS. Fila 0 = arriba. Es lo único que se hace en
 * la página: el campo de distancias lo calcula el pintor (distancias.ts).
 */
function mascaraDeTexto(
  elemento: HTMLElement,
  escala: number,
  cssAncho: number,
  cssAlto: number
): MascaraDeTexto | null {
  const caja = elemento.getBoundingClientRect();
  if (caja.width === 0 || caja.height === 0) return null;
  const ancho = Math.ceil(cssAncho * escala);
  const alto = Math.ceil(cssAlto * escala);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.scale(escala, escala);
  dibujarLetras(elemento, ctx, caja, RANGO_TITULAR);
  const pixeles = ctx.getImageData(0, 0, ancho, alto).data;
  const datos = new Uint8Array(ancho * alto);
  for (let i = 0; i < datos.length; i++) datos[i] = (pixeles[i * 4 + 3] ?? 0) > 127 ? 1 : 0;
  return { ancho, alto, escala, datos };
}

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const suave = (x: number) => {
  const t = acotar(x, 0, 1);
  return t * t * (3 - 2 * t);
};
/** Al final el cromo se desvanece y aparece el texto real. */
const visibleSegun = (p: number) =>
  p >= 1 ? 0 : 1 - suave((p - DESPRENDIMIENTO.revelado) / (1 - DESPRENDIMIENTO.revelado));

export interface Fases {
  /** Burbuja 3D: distancia al centro de la gota y radio (0: no hay). */
  distancia: number;
  radio: number;
  /** 0..1: de la burbuja 3D a su relevo 2D (tamaño de la gota 2D sobre su tamaño de relevo). */
  relevo: number;
  /** 0..1: vuelo 2D desde el relevo hasta el titular. */
  vuelo: number;
  /** 0..1: la gota se extiende en las letras. */
  extension: number;
  /** 0..1: cuánto se ve aún el cromo (al final aparece el texto real). */
  visible: number;
}

/** El estado de la burbuja de la escena 02 para un progreso p (0..1). */
export function fases(p: number): Fases {
  const D = DESPRENDIMIENTO;
  const brota = suave(p / D.brote);
  const sale = suave((p - D.brote) / (D.suelta - D.brote));
  const relevo = suave((p - (D.suelta - D.relevo)) / D.relevo);
  // Brota desde dentro de la gota hasta asomar, y luego se aleja hasta soltarse.
  const distancia = D.dentro + (D.asoma - D.dentro) * brota + (D.distancia - D.asoma) * sale;
  return {
    distancia,
    radio: D.radio * brota * (1 - relevo),
    relevo,
    vuelo: suave((p - D.suelta) / (D.llegada - D.suelta)),
    extension: suave((p - D.llegada) / (1 - D.llegada)),
    visible: visibleSegun(p)
  };
}

interface Lugar {
  /** Texels en el atlas. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Lo que cubre en px CSS (la caja del titular más RANGO_TITULAR a cada lado). */
  cssAncho: number;
  cssAlto: number;
}

interface Titular {
  elemento: HTMLElement;
  burbuja: boolean;
  /** Radio de la gota que cae (px CSS), según el tamaño de su letra; se lee una vez. */
  radio: number;
  /** Su sitio en el atlas; null hasta que su campo está subido. */
  lugar: Lugar | null;
  progreso: number;
  escrito: number | null;
  /** Ya se veía al activarse: se queda entero hasta que salga de pantalla. */
  retenido: boolean;
  activo: boolean;
  /** Caja en px del lienzo mientras está cambiando (este fotograma); si no, null. */
  caja: DOMRect | null;
}

type Punto = { x: number; y: number };

export class Titulares {
  /** Para el sombreador (px del lienzo, hacia arriba): caja, atlas (uv), gota y frente de cada uno. */
  readonly datos = {
    cajas: new Float32Array(MAX_TITULARES * 4),
    atlas: new Float32Array(MAX_TITULARES * 4),
    gotas: new Float32Array(MAX_TITULARES * 4),
    frentes: new Float32Array(MAX_TITULARES * 4),
    numero: 0
  };

  private readonly lista: Titular[];
  private atlasAncho = 1;
  private atlasAlto = 1;
  /** WebGL listo y con movimiento. */
  private encendidos = false;
  private generacion = 0;
  private observador: ResizeObserver | null = null;
  private readonly proyeccion: Proyeccion = { x: 0, y: 0, escala: 1, profundidad: 1 };

  constructor(elementos: Iterable<HTMLElement>) {
    this.lista = [...elementos].map((elemento) => ({
      elemento,
      burbuja: elemento.dataset.gota === 'burbuja',
      radio: (parseFloat(getComputedStyle(elemento).fontSize) || 40) * CAIDA.radio,
      lugar: null,
      progreso: 1,
      escrito: null,
      retenido: false,
      activo: false,
      caja: null
    }));
  }

  /**
   * Prepara el atlas cuando las fuentes ya cargaron y, desde ahí, un
   * titular por momento ocioso; lo rehace si cambia el tamaño de alguno.
   * `alSubir` pide un fotograma.
   */
  preparar(pintor: Pintor, alSubir: () => void): void {
    if (this.lista.length === 0) return;
    this.encendidos = true;
    let pendiente = false;
    const ocioso = (tarea: () => void) =>
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(tarea, { timeout: 1000 })
        : window.setTimeout(tarea, 100);
    const construir = () => {
      pendiente = false;
      const generacion = ++this.generacion;
      for (const t of this.lista) t.lugar = null;
      const medidas = this.lista.map((t) => {
        const caja = t.elemento.getBoundingClientRect();
        return {
          cssAncho: Math.ceil(caja.width + RANGO_TITULAR * 2),
          cssAlto: Math.ceil(caja.height + RANGO_TITULAR * 2)
        };
      });
      // Estantes de izquierda a derecha; a media resolución si no caben.
      const empaquetar = (escala: number) => {
        let x = 0;
        let y = 0;
        let fila = 0;
        let ancho = 1;
        const lugares = medidas.map(({ cssAncho, cssAlto }) => {
          const w = Math.ceil(cssAncho * escala);
          const h = Math.ceil(cssAlto * escala);
          if (x + w > LADO_ATLAS) {
            x = 0;
            y += fila + SEPARACION;
            fila = 0;
          }
          const lugar: Lugar = { x, y, ancho: w, alto: h, cssAncho, cssAlto };
          x += w + SEPARACION;
          fila = Math.max(fila, h);
          ancho = Math.max(ancho, x);
          return lugar;
        });
        return { lugares, ancho, alto: y + fila };
      };
      let escala = 1;
      let plan = empaquetar(escala);
      if (plan.alto > LADO_ATLAS) plan = empaquetar((escala = 0.5));
      this.atlasAncho = plan.ancho;
      this.atlasAlto = plan.alto;
      pintor.prepararAtlas(plan.ancho, plan.alto);
      const siguiente = (i: number) => {
        if (generacion !== this.generacion || i >= this.lista.length) return;
        const t = this.lista[i]!;
        const lugar = plan.lugares[i]!;
        const mascara = mascaraDeTexto(t.elemento, escala, lugar.cssAncho, lugar.cssAlto);
        if (mascara) {
          pintor.subirTitular(lugar.x, lugar.y, mascara);
          t.lugar = lugar;
          alSubir();
        }
        ocioso(() => siguiente(i + 1));
      };
      ocioso(() => siguiente(0));
    };
    this.observador = new ResizeObserver(() => {
      if (pendiente) return;
      pendiente = true;
      void document.fonts.ready.then(() => ocioso(construir));
    });
    for (const t of this.lista) this.observador.observe(t.elemento);
  }

  /**
   * Lee la caja de cada titular y actualiza su progreso. `burbuja` es el
   * progreso narrativo de la escena 02. Solo lee el DOM.
   */
  medir(dt: number, lienzo: DOMRect, burbuja: number): void {
    const alto = window.innerHeight;
    for (const t of this.lista) {
      const listo = this.encendidos && t.lugar !== null;
      if (!listo) {
        t.activo = false;
        t.progreso = 1;
        t.caja = null;
        continue;
      }
      const r = t.elemento.getBoundingClientRect();
      const enPantalla = r.bottom > 0 && r.top < alto && r.width > 0;
      if (!t.activo && enPantalla) t.retenido = true;
      t.activo = true;
      if (!enPantalla) t.retenido = false;
      if (t.retenido) t.progreso = 1;
      else if (t.burbuja) t.progreso = acotar(burbuja, 0, 1);
      else {
        const meta = acotar((alto - r.top) / (alto * CAIDA.recorrido), 0, 1);
        if (!enPantalla) t.progreso = meta;
        else t.progreso += (meta - t.progreso) * Math.min(1, dt * CAIDA.rapidez);
        if (Math.abs(meta - t.progreso) < 0.002) t.progreso = meta;
      }
      // La burbuja sale de la gota antes de que su titular asome: se mide aunque no se vea.
      const cambiando = t.progreso > 0 && t.progreso < 1 && (enPantalla || t.burbuja);
      t.caja = cambiando
        ? new DOMRect(r.left - lienzo.left, r.top - lienzo.top, r.width, r.height)
        : null;
    }
  }

  private aterrizaje(caja: DOMRect): Punto {
    return {
      x: caja.left + caja.width * TITULAR.aterrizaje[0],
      y: caja.top + caja.height * TITULAR.aterrizaje[1]
    };
  }

  /**
   * La burbuja 3D brota de la gota hacia donde aterrizará (llevado al
   * mundo, algo hacia la cámara). `centro`: el del guía en px del lienzo.
   */
  brote(camara: Camara, centro: Punto, destino: Pose['brote']): void {
    const t = this.lista.find((t) => t.burbuja);
    if (!t?.caja) {
      destino.radio = 0;
      return;
    }
    const aterrizaje = this.aterrizaje(t.caja);
    const [r, u] = ejesDePantalla(camara);
    const [px, py, pz] = camara.posicion;
    const [ox, oy, oz] = camara.objetivo;
    const cerca = Math.hypot(px - ox, py - oy, pz - oz) || 1;
    const dx = aterrizaje.x - centro.x;
    const dy = centro.y - aterrizaje.y;
    const largo = Math.hypot(dx, dy) || 1;
    const k = TITULAR.haciaCamara;
    const dir: Vec3 = [
      (r[0] * dx + u[0] * dy) / largo + ((px - ox) / cerca) * k,
      (r[1] * dx + u[1] * dy) / largo + ((py - oy) / cerca) * k,
      (r[2] * dx + u[2] * dy) / largo + ((pz - oz) / cerca) * k
    ];
    const l = Math.hypot(...dir) || 1;
    const f = fases(t.progreso);
    destino.direccion = [dir[0] / l, dir[1] / l, dir[2] / l];
    destino.distancia = f.distancia;
    destino.radio = f.radio;
  }

  /**
   * Lo que el sombreador necesita de los titulares que están cambiando
   * (la burbuja primero): su caja y su sitio en el atlas, su gota y el
   * frente que extiende las letras. `piezas` trae la burbuja 3D ya colocada.
   */
  componer(camara: Camara, ancho: number, alto: number, pxCss: number, piezas: Float32Array) {
    const { cajas, atlas, gotas, frentes } = this.datos;
    let n = 0;
    const ordenados = [...this.lista].sort((a, b) => Number(b.burbuja) - Number(a.burbuja));
    for (const t of ordenados) {
      if (n >= MAX_TITULARES) break;
      if (!t.caja || !t.lugar) continue;
      const caja = t.caja;
      const aterrizaje = this.aterrizaje(caja);
      let gota: Punto;
      let radio: number;
      let extension: number;
      if (t.burbuja) {
        // Relevo: una gota 2D del tamaño en pantalla de la burbuja 3D, que vuela en arco.
        const f = fases(t.progreso);
        const i = PIEZA.desprendida * 4;
        const pieza: Vec3 = [piezas[i] ?? 0, piezas[i + 1] ?? 0, piezas[i + 2] ?? 0];
        const relevo = crearProyector(camara, ancho, alto)(pieza, this.proyeccion);
        const vx = aterrizaje.x - relevo.x;
        const vy = aterrizaje.y - relevo.y;
        const arco = Math.sin(Math.PI * f.vuelo) * Math.hypot(vx, vy) * TITULAR.arco;
        gota = { x: relevo.x + vx * f.vuelo, y: relevo.y + vy * f.vuelo - arco };
        radio =
          DESPRENDIMIENTO.radio * relevo.escala * (f.vuelo > 0 ? 1 : f.relevo) * (1 - f.extension);
        extension = f.extension;
      } else {
        // Aparece sobre el titular, cae (acelerando) y se vacía en las letras.
        const p = t.progreso;
        const crece = suave(p / CAIDA.aparece);
        const cae = acotar((p - CAIDA.aparece) / (CAIDA.cae - CAIDA.aparece), 0, 1);
        extension = suave((p - CAIDA.cae) / (1 - CAIDA.cae));
        const desde = caja.top - t.radio * CAIDA.altura;
        gota = { x: aterrizaje.x, y: desde + (aterrizaje.y - desde) * cae * cae };
        radio = t.radio * crece * (1 - extension);
      }
      // Alcance del frente: hasta la esquina más lejana de la caja.
      const alcance = Math.hypot(
        Math.max(aterrizaje.x - caja.left, caja.right - aterrizaje.x),
        Math.max(aterrizaje.y - caja.top, caja.bottom - aterrizaje.y)
      );
      const { lugar } = t;
      const arriba = caja.top - RANGO_TITULAR;
      const izquierda = caja.left - RANGO_TITULAR;
      const k = pxCss;
      const j = n * 4;
      cajas.set(
        [
          izquierda * k,
          (alto - arriba - lugar.cssAlto) * k,
          (izquierda + lugar.cssAncho) * k,
          (alto - arriba) * k
        ],
        j
      );
      // Centros de los texels de sus bordes: (izquierda, arriba) y (derecha, abajo).
      atlas.set(
        [
          (lugar.x + 0.5) / this.atlasAncho,
          (lugar.y + 0.5) / this.atlasAlto,
          (lugar.x + lugar.ancho - 0.5) / this.atlasAncho,
          (lugar.y + lugar.alto - 0.5) / this.atlasAlto
        ],
        j
      );
      gotas.set([gota.x * k, (alto - gota.y) * k, radio * k, 0], j);
      frentes.set(
        [
          aterrizaje.x * k,
          (alto - aterrizaje.y) * k,
          extension * alcance * 1.1 * k,
          visibleSegun(t.progreso)
        ],
        j
      );
      n += 1;
    }
    this.datos.numero = n;
  }

  /** El texto real aparece al final (CSS lee --gota); si no está activo, se ve normal. */
  escribir(): void {
    for (const t of this.lista) {
      const valor = t.activo ? t.progreso : null;
      const igual =
        valor === null || t.escrito === null
          ? valor === t.escrito
          : Math.abs(valor - t.escrito) < 0.001;
      if (igual) continue;
      t.escrito = valor;
      if (valor === null) t.elemento.style.removeProperty('--gota');
      else t.elemento.style.setProperty('--gota', valor.toFixed(3));
    }
  }

  liberar(): void {
    this.generacion += 1;
    this.observador?.disconnect();
    for (const t of this.lista) t.elemento.style.removeProperty('--gota');
  }
}
