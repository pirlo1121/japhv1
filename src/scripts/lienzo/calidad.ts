/**
 * calidad.ts
 * Cuánto puede permitirse el dispositivo. Empieza con un tope de píxeles por
 * tipo de pantalla y, en equipos modestos, con el detalle reducido. Si los
 * fotogramas tardan demasiado de media, o demasiados pierden el refresco,
 * primero quita detalle y luego resolución.
 * Nunca vuelve a subir: evita oscilar entre dos calidades.
 */

const TOPE_DPR_TACTIL = 1.5;
const TOPE_DPR_ESCRITORIO = 1.5;
/**
 * Píxeles máximos del lienzo (ancho × alto en píxeles reales). La escultura
 * se traza rayo a rayo: el cromo es liso y el texto es HTML, así que una
 * resolución algo menor que la de la pantalla no se nota y ahorra mucho.
 */
const TOPE_PIXELES_TACTIL = 0.9e6;
const TOPE_PIXELES_ESCRITORIO = 2.2e6;

const FOTOGRAMAS_DE_MUESTRA = 45;
/** Media por encima de la cual la muestra es lenta. */
const MS_LENTO = 24;
/** Un fotograma que pierde el refresco de una pantalla de 60 Hz. */
const MS_TIRON = 22;
/** Con esta fracción de tirones la muestra también es lenta, aunque la media aguante. */
const FRACCION_DE_TIRONES = 0.25;
const PASO_DE_BAJADA = 0.8;
const ESCALA_MINIMA = 0.45;

export const esTactil = () => window.matchMedia('(pointer: coarse)').matches;

/** Táctil con pocos núcleos o poca memoria: se empieza con el detalle reducido. */
function esEquipoModesto(): boolean {
  const nucleos = navigator.hardwareConcurrency ?? 8;
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return esTactil() && (nucleos <= 4 || memoria <= 4);
}

export class Calidad {
  /** 1 = detalle completo; 0 = sin capas secundarias (ver uDetalle en el sombreador). */
  detalle = esEquipoModesto() ? 0 : 1;
  private escala = 1;
  private acumulado = 0;
  private muestras = 0;
  private tirones = 0;

  /** Tamaño en píxeles reales del lienzo para un tamaño CSS dado. */
  tamano(anchoCss: number, altoCss: number): [number, number] {
    const tactil = esTactil();
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      tactil ? TOPE_DPR_TACTIL : TOPE_DPR_ESCRITORIO
    );
    const tope = tactil ? TOPE_PIXELES_TACTIL : TOPE_PIXELES_ESCRITORIO;
    let factor = dpr * this.escala;
    const pixeles = anchoCss * altoCss * factor * factor;
    if (pixeles > tope) factor *= Math.sqrt(tope / pixeles);
    return [Math.max(1, Math.round(anchoCss * factor)), Math.max(1, Math.round(altoCss * factor))];
  }

  /** Registra la duración de un fotograma. Devuelve true si se redujo la calidad. */
  medir(ms: number): boolean {
    // Saltos enormes son pestañas en segundo plano o pausas, no lentitud.
    if (ms > 200) return false;
    this.acumulado += ms;
    this.muestras += 1;
    if (ms > MS_TIRON) this.tirones += 1;
    if (this.muestras < FOTOGRAMAS_DE_MUESTRA) return false;

    const media = this.acumulado / this.muestras;
    const tirones = this.tirones / this.muestras;
    this.acumulado = 0;
    this.muestras = 0;
    this.tirones = 0;
    if (media <= MS_LENTO && tirones <= FRACCION_DE_TIRONES) return false;
    if (this.detalle > 0) {
      this.detalle = 0;
      return true;
    }
    if (this.escala > ESCALA_MINIMA) {
      this.escala = Math.max(ESCALA_MINIMA, this.escala * PASO_DE_BAJADA);
      return true;
    }
    return false;
  }
}
