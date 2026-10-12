/**
 * api.ts
 * Único archivo que habla con el servidor. Ningún otro módulo llama a fetch.
 */

import { PUBLIC_API_URL } from 'astro:env/client';

/**
 * Sin PUBLIC_API_URL: si el sitio se abre en la propia máquina (dev o preview)
 * se usa la API local; publicado, el mismo dominio del sitio.
 */
const ES_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const BASE = PUBLIC_API_URL ?? (ES_LOCAL ? 'http://localhost:4000' : '');
const TIEMPO_LIMITE = 12_000;

export interface ErrorDeCampo {
  campo: string;
  mensaje: string;
}

/** Error con la forma que espera la interfaz: mensaje legible + errores por campo. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly errores: ErrorDeCampo[];

  constructor(mensaje: string, { estado = 0, errores = [] as ErrorDeCampo[] } = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.errores = errores;
  }
}

interface RespuestaApi {
  ok?: boolean;
  mensaje?: string;
  errores?: ErrorDeCampo[];
}

/** Petición JSON con tiempo límite y errores normalizados. */
async function peticion(ruta: string, opciones: RequestInit = {}): Promise<RespuestaApi | null> {
  const control = new AbortController();
  const reloj = window.setTimeout(() => control.abort(), TIEMPO_LIMITE);

  try {
    const respuesta = await fetch(`${BASE}${ruta}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: control.signal,
      ...opciones
    });

    const esJson = respuesta.headers.get('content-type')?.includes('application/json');
    const cuerpo = esJson ? ((await respuesta.json()) as RespuestaApi) : null;

    if (!respuesta.ok) {
      throw new ErrorApi(cuerpo?.mensaje ?? 'No pudimos completar la operación.', {
        estado: respuesta.status,
        errores: Array.isArray(cuerpo?.errores) ? cuerpo.errores : []
      });
    }

    return cuerpo;
  } catch (error) {
    if (error instanceof ErrorApi) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ErrorApi('La conexión tardó demasiado. Inténtalo de nuevo.', { estado: 408 });
    }
    throw new ErrorApi('No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.');
  } finally {
    window.clearTimeout(reloj);
  }
}

export interface DatosDeContacto {
  nombre: string;
  email: string;
  empresa: string;
  telefono: string;
  servicio: string;
  mensaje: string;
  presupuesto: number;
  consentimiento: boolean;
  origen: string;
  /** Campo trampa: si un bot lo rellena, el servidor descarta el envío. */
  web: string;
}

/** POST /api/contact */
export function enviarContacto(datos: DatosDeContacto): Promise<RespuestaApi | null> {
  return peticion('/api/contact', { method: 'POST', body: JSON.stringify(datos) });
}

/** GET /api/health — comprobación de estado, útil para diagnóstico. */
export function consultarEstado(): Promise<RespuestaApi | null> {
  return peticion('/api/health');
}
