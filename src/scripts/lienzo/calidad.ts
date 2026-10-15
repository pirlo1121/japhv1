/**
 * calidad.ts
 * Cuánto puede permitirse el dispositivo. Empieza con un tope de píxeles por
 * tipo de pantalla y, en equipos modestos, con el detalle reducido. Si los
 * fotogramas tardan demasiado de media, o demasiados pierden el refresco,
 * primero quita detalle y luego resolución. Si varios fotogramas seguidos
 * son muy lentos (un equipo que no puede con la escena), no espera a
 * reunir la muestra: baja enseguida.
 * Nunca vuelve a subir: evita oscilar entre dos calidades.
 *
 * Se mide lo que cuesta pintar, no lo que tarda la página: con el worker
 * (pintor.ts) es el tiempo de GPU de cada fotograma; sin él, el intervalo
 * entre fotogramas. Así un tirón del hilo principal (al cargar, al montar
 * el scroll) no se confunde con una GPU lenta y no baja la nitidez para
 * siempre.
 */

/**
 * Densidad máxima: hasta 2 píxeles reales por píxel CSS. Las aristas de
 * los monolitos y la silueta de la gota son líneas de un píxel: a 1.5 y
 * estiradas a la pantalla se veían dentadas. Más allá de 2 apenas se nota
 * y cuesta mucho. Los equipos modestos empiezan en 1.5.
 */
const TOPE_DPR = 2;
const TOPE_DPR_MODESTO = 1.5;
/**
 * Píxeles máximos del lienzo (ancho × alto en píxeles reales): un móvil
 * grande a 2× (430 × 932) cabe entero; una tableta o un portátil retina se
 * quedan cerca de 2×. Si el equipo no puede, la calidad adaptativa baja.
 */
const TOPE_PIXELES_TACTIL = 1.8e6;
const TOPE_PIXELES_ESCRITORIO = 4.5e6;

/**
 * Fotogramas que no se miden al empezar: los primeros incluyen la
 * compilación perezosa del controlador y la carga de la página.
 */
const CALENTAMIENTO = 20;
const FOTOGRAMAS_DE_MUESTRA = 45;
/**
 * Umbrales según lo que se mida. "coste": ms de GPU por fotograma (con
 * más de un refresco de 60 Hz de media, la escena va a medio ritmo).
 * "intervalo": ms entre fotogramas, que ya incluyen el refresco y algo de
 * ruido del hilo principal.
 */
const UMBRALES = {
  coste: { lento: 17, tiron: 20 },
  intervalo: { lento: 24, tiron: 22 }
} as const;
export type Medida = keyof typeof UMBRALES;
/** Con esta fracción de tirones la muestra también es lenta, aunque la media aguante. */
const FRACCION_DE_TIRONES = 0.25;
const PASO_DE_BAJADA = 0.8;
const ESCALA_MINIMA = 0.35;
/** Un fotograma así de lento es grave; tantos seguidos bajan la calidad al momento. */
const MS_GRAVE = 50;
const GRAVES_SEGUIDOS = 3;
const PASO_DE_EMERGENCIA = 0.7;

export const esTactil = () => window.matchMedia('(pointer: coarse)').matches;

/** Táctil con pocos núcleos o poca memoria: se empieza con el detalle reducido. */
function esEquipoModesto(): boolean {
  const nucleos = navigator.hardwareConcurrency ?? 8;
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return esTactil() && (nucleos <= 4 || memoria <= 4);
}

export class Calidad {
  private readonly modesto = esEquipoModesto();
  /** 1 = detalle completo; 0 = sin capas secundarias (ver uDetalle en el sombreador). */
  detalle = this.modesto ? 0 : 1;
  /** Qué llega a medir(): coste de GPU o intervalo entre fotogramas (pintor.ts). */
  medida: Medida = 'intervalo';
  private escala = 1;
  private acumulado = 0;
  private muestras = 0;
  private tirones = 0;
  private graves = 0;
  /** Fotogramas que no se miden: el calentamiento y el primero tras una pausa. */
  private ignorar = CALENTAMIENTO;

  /** El bucle se detuvo (pestaña oculta, fuera de pantalla): el próximo intervalo no cuenta. */
  pausa(): void {
    this.ignorar = Math.max(this.ignorar, 1);
    this.graves = 0;
  }

  private bajar(paso: number): boolean {
    this.acumulado = 0;
    this.muestras = 0;
    this.tirones = 0;
    this.graves = 0;
    if (this.detalle > 0) {
      this.detalle = 0;
      return true;
    }
    if (this.escala > ESCALA_MINIMA) {
      this.escala = Math.max(ESCALA_MINIMA, this.escala * paso);
      return true;
    }
    return false;
  }

  /** Tamaño en píxeles reales del lienzo para un tamaño CSS dado. */
  tamano(anchoCss: number, altoCss: number): [number, number] {
    const tactil = esTactil();
    const dpr = Math.min(window.devicePixelRatio || 1, this.modesto ? TOPE_DPR_MODESTO : TOPE_DPR);
    const tope = tactil ? TOPE_PIXELES_TACTIL : TOPE_PIXELES_ESCRITORIO;
    let factor = dpr * this.escala;
    const pixeles = anchoCss * altoCss * factor * factor;
    if (pixeles > tope) factor *= Math.sqrt(tope / pixeles);
    return [Math.max(1, Math.round(anchoCss * factor)), Math.max(1, Math.round(altoCss * factor))];
  }

  /** Registra la duración de un fotograma. Devuelve true si se redujo la calidad. */
  medir(ms: number): boolean {
    if (this.ignorar > 0) {
      this.ignorar -= 1;
      return false;
    }
    this.graves = ms > MS_GRAVE ? this.graves + 1 : 0;
    if (this.graves >= GRAVES_SEGUIDOS) return this.bajar(PASO_DE_EMERGENCIA);
    this.acumulado += ms;
    this.muestras += 1;
    const umbral = UMBRALES[this.medida];
    if (ms > umbral.tiron) this.tirones += 1;
    if (this.muestras < FOTOGRAMAS_DE_MUESTRA) return false;

    const media = this.acumulado / this.muestras;
    const tirones = this.tirones / this.muestras;
    this.acumulado = 0;
    this.muestras = 0;
    this.tirones = 0;
    if (media <= umbral.lento && tirones <= FRACCION_DE_TIRONES) return false;
    return this.bajar(PASO_DE_BAJADA);
  }
}
