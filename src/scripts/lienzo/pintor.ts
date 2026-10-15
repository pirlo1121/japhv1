/**
 * pintor.ts
 * Quién dibuja la escultura. Si el navegador lo permite, todo el trabajo de
 * WebGL (crear el contexto, compilar el shader, dibujar) ocurre en un worker
 * con OffscreenCanvas: el hilo principal solo envía el estado de cada
 * fotograma y nunca se bloquea. Si no, se dibuja en la página.
 *
 * Ambos pintores tienen la misma forma, así la escena no sabe cuál usa.
 */
import type { Medida } from './calidad';
import { Renderizador, type EstadoDeEscena } from './renderizador';

export interface Pintor {
  /** alListo cuando el shader está listo; alFallar si no se puede dibujar. */
  preparar(alListo: () => void, alFallar: (error: unknown) => void): void;
  configurar(anchoPx: number, altoPx: number): void;
  /** false si el fotograma anterior aún no terminó: este se salta. */
  dibujar(estado: EstadoDeEscena): boolean;
  /**
   * Se llama con los ms de cada fotograma pintado: lo que costó en la GPU
   * (medida "coste", en el worker) o el intervalo desde el anterior
   * ("intervalo", en la página, donde esperar a la GPU bloquearía).
   */
  alPintar: (ms: number) => void;
  readonly medida: Medida;
  liberar(): void;
}

export type MensajeAlHilo =
  | { tipo: 'iniciar'; lienzo: OffscreenCanvas }
  | { tipo: 'configurar'; anchoPx: number; altoPx: number }
  | { tipo: 'dibujar'; estado: EstadoDeEscena }
  | { tipo: 'liberar' };

export type MensajeDelHilo =
  { tipo: 'listo' } | { tipo: 'error'; mensaje: string } | { tipo: 'pintado'; ms: number };

/** Dibuja en el hilo principal (navegadores sin OffscreenCanvas en workers). */
class PintorLocal implements Pintor {
  private readonly renderizador: Renderizador;
  private ultimo = 0;
  readonly medida = 'intervalo';
  alPintar: (ms: number) => void = () => {};

  constructor(lienzo: HTMLCanvasElement) {
    this.renderizador = new Renderizador(lienzo);
  }

  preparar(alListo: () => void, alFallar: (error: unknown) => void): void {
    // Se pregunta una vez por fotograma si terminó de compilar, sin esperar.
    const esperar = () => {
      if (!this.renderizador.compilado()) return void requestAnimationFrame(esperar);
      try {
        this.renderizador.enlazar();
        alListo();
      } catch (error) {
        alFallar(error);
      }
    };
    esperar();
  }

  configurar(anchoPx: number, altoPx: number): void {
    this.renderizador.redimensionar(anchoPx, altoPx);
  }

  dibujar(estado: EstadoDeEscena): boolean {
    this.renderizador.dibujar(estado);
    const ahora = performance.now();
    this.alPintar(this.ultimo ? ahora - this.ultimo : 16);
    this.ultimo = ahora;
    return true;
  }

  liberar(): void {
    this.renderizador.liberar();
  }
}

/** Dibuja en un worker; la página solo manda mensajes. */
class PintorEnHilo implements Pintor {
  private readonly hilo: Worker;
  private ocupado = false;
  readonly medida = 'coste';
  alPintar: (ms: number) => void = () => {};

  constructor(lienzo: HTMLCanvasElement) {
    this.hilo = new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module' });
    const fuera = lienzo.transferControlToOffscreen();
    this.enviar({ tipo: 'iniciar', lienzo: fuera }, [fuera]);
  }

  private enviar(mensaje: MensajeAlHilo, transferir: Transferable[] = []): void {
    this.hilo.postMessage(mensaje, transferir);
  }

  preparar(alListo: () => void, alFallar: (error: unknown) => void): void {
    this.hilo.addEventListener('message', (evento: MessageEvent<MensajeDelHilo>) => {
      const mensaje = evento.data;
      if (mensaje.tipo === 'listo') alListo();
      else if (mensaje.tipo === 'error') alFallar(new Error(mensaje.mensaje));
      else {
        this.ocupado = false;
        this.alPintar(mensaje.ms);
      }
    });
    this.hilo.addEventListener('error', (evento) => alFallar(evento));
  }

  configurar(anchoPx: number, altoPx: number): void {
    this.enviar({ tipo: 'configurar', anchoPx, altoPx });
  }

  dibujar(estado: EstadoDeEscena): boolean {
    if (this.ocupado) return false;
    this.ocupado = true;
    this.enviar({ tipo: 'dibujar', estado });
    return true;
  }

  liberar(): void {
    this.enviar({ tipo: 'liberar' });
    this.hilo.terminate();
  }
}

export function crearPintor(lienzo: HTMLCanvasElement): Pintor {
  const puedeEnHilo = typeof Worker !== 'undefined' && 'transferControlToOffscreen' in lienzo;
  if (puedeEnHilo) {
    try {
      return new PintorEnHilo(lienzo);
    } catch {
      // El worker no se pudo crear (antes de transferir el lienzo): se dibuja aquí.
    }
  }
  return new PintorLocal(lienzo);
}
