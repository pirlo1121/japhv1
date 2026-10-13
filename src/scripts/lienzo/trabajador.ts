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
let ultimo = 0;

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
      case 'atlas':
        renderizador?.prepararAtlas(mensaje.ancho, mensaje.alto);
        break;
      case 'titular':
        renderizador?.subirTitular(mensaje.x, mensaje.y, mensaje.mascara);
        break;
      case 'dibujar': {
        if (!renderizador?.enlazado) break;
        renderizador.dibujar(mensaje.estado);
        // Esperar a la GPU aquí no bloquea la página y evita que se acumulen fotogramas.
        renderizador.terminar();
        const ahora = performance.now();
        hilo.postMessage({ tipo: 'pintado', ms: ultimo ? ahora - ultimo : 16 });
        ultimo = ahora;
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
