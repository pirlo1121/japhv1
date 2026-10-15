/**
 * trabajador.ts
 * Worker que dibuja la escultura con OffscreenCanvas (ver pintor.ts). Aquí
 * ocurre todo lo costoso de WebGL, lejos del hilo principal.
 */
import type { MensajeAlHilo, MensajeDelHilo } from './pintor';
import { Renderizador } from './renderizador';

const hilo = self as unknown as {
  postMessage(mensaje: MensajeDelHilo): void;
  addEventListener(tipo: 'message', escucha: (evento: MessageEvent<MensajeAlHilo>) => void): void;
};

let renderizador: Renderizador | null = null;

function esperarCompilacion(): void {
  if (!renderizador) return;
  if (!renderizador.compilado()) return void setTimeout(esperarCompilacion, 16);
  try {
    renderizador.enlazar();
    hilo.postMessage({ tipo: 'listo' });
  } catch (error) {
    hilo.postMessage({ tipo: 'error', mensaje: String(error) });
  }
}

hilo.addEventListener('message', ({ data: mensaje }) => {
  try {
    switch (mensaje.tipo) {
      case 'iniciar':
        renderizador = new Renderizador(mensaje.lienzo);
        esperarCompilacion();
        break;
      case 'configurar':
        renderizador?.redimensionar(mensaje.anchoPx, mensaje.altoPx);
        break;
      case 'dibujar': {
        if (!renderizador?.enlazado) break;
        const desde = performance.now();
        renderizador.dibujar(mensaje.estado);
        // Esperar a la GPU aquí no bloquea la página y evita que se acumulen
        // fotogramas. Lo que tarda es el coste real del fotograma: no cuenta
        // el tiempo en que la página no pidió pintar (reposo, medio ritmo).
        renderizador.terminar();
        hilo.postMessage({ tipo: 'pintado', ms: performance.now() - desde });
        break;
      }
      case 'liberar':
        renderizador?.liberar();
        renderizador = null;
        break;
    }
  } catch (error) {
    hilo.postMessage({ tipo: 'error', mensaje: String(error) });
  }
});
