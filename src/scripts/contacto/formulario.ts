/**
 * formulario.ts
 * Interfaz del formulario de contacto: valida al salir de cada campo,
 * anuncia los errores de forma accesible y delega el envío en api.ts.
 */

import { enviarContacto, ErrorApi, type DatosDeContacto } from './api';
import { REGLAS } from './reglas';

type Campo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function iniciarFormulario(): void {
  iniciarPresupuesto();

  const formulario = document.querySelector<HTMLFormElement>('[data-formulario-contacto]');
  if (!formulario) return;

  const aviso = formulario.querySelector<HTMLElement>('[data-aviso]');
  const boton = formulario.querySelector<HTMLButtonElement>('button[type="submit"]');
  const textoBoton = boton?.textContent ?? 'Enviar mensaje';
  const campos = Array.from(
    formulario.querySelectorAll<Campo>('input[name], textarea[name], select[name]')
  ).filter((campo) => campo.name in REGLAS);

  for (const campo of campos) {
    campo.addEventListener('blur', () => validar(campo));
    campo.addEventListener('input', () => limpiar(campo));
    // Los checkbox no disparan un blur útil al hacer clic en todos los navegadores.
    if (campo.type === 'checkbox') campo.addEventListener('change', () => validar(campo));
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    ocultarAviso(aviso);

    const invalidos = campos.filter((campo) => !validar(campo));
    if (invalidos.length) {
      const plural = invalidos.length === 1 ? 'campo' : 'campos';
      mostrarAviso(
        aviso,
        'error',
        `Hay ${invalidos.length} ${plural} por corregir antes de enviar.`
      );
      invalidos[0]?.focus();
      return;
    }

    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Enviando…';
    }

    try {
      const respuesta = await enviarContacto(recogerDatos(formulario));
      formulario.reset();
      campos.forEach((campo) => pintarEstado(campo, ''));
      iniciarPresupuesto();
      mostrarAviso(
        aviso,
        'exito',
        respuesta?.mensaje ?? 'Mensaje enviado. Te respondemos lo antes posible.'
      );
    } catch (error) {
      // Si el servidor señaló campos concretos, se marcan uno a uno.
      if (error instanceof ErrorApi) {
        for (const detalle of error.errores) {
          const campo = formulario.querySelector<Campo>(`[name="${CSS.escape(detalle.campo)}"]`);
          if (campo) pintarEstado(campo, detalle.mensaje);
        }
      }
      const mensaje = error instanceof Error ? error.message : 'No pudimos enviar el mensaje.';
      mostrarAviso(aviso, 'error', mensaje);
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = textoBoton;
      }
    }
  });
}

function recogerDatos(formulario: HTMLFormElement): DatosDeContacto {
  const datos = new FormData(formulario);
  const leer = (nombre: string): string => String(datos.get(nombre) ?? '').trim();

  return {
    nombre: leer('nombre'),
    email: leer('email').toLowerCase(),
    empresa: leer('empresa'),
    telefono: leer('telefono'),
    servicio: leer('servicio'),
    mensaje: leer('mensaje'),
    presupuesto: Number(leer('presupuesto')) || 0,
    // Un checkbox sin marcar no aparece en FormData: se lee su propiedad directamente.
    consentimiento:
      formulario.querySelector<HTMLInputElement>('[name="consentimiento"]')?.checked === true,
    origen: document.referrer || 'directo',
    web: leer('web')
  };
}

/* --- Estado accesible de cada campo --------------------------------------- */
function validar(campo: Campo): boolean {
  const regla = REGLAS[campo.name];
  if (!regla) return true;
  const valido = regla.valida(campo);
  pintarEstado(campo, valido ? '' : regla.error);
  return valido;
}

function limpiar(campo: Campo): void {
  if (campo.closest<HTMLElement>('[data-campo]')?.dataset.error === 'true') pintarEstado(campo, '');
}

/** El mensaje de error ya está enlazado al campo con aria-describedby desde el HTML. */
function pintarEstado(campo: Campo, mensaje: string): void {
  const envoltura = campo.closest<HTMLElement>('[data-campo]');
  if (!envoltura) return;
  const salida = envoltura.querySelector<HTMLElement>('[data-error-campo]');
  const hayError = mensaje !== '';

  envoltura.dataset.error = String(hayError);
  campo.setAttribute('aria-invalid', String(hayError));
  if (salida) salida.textContent = mensaje;
}

function mostrarAviso(aviso: HTMLElement | null, estado: 'exito' | 'error', mensaje: string): void {
  if (!aviso) return;
  aviso.dataset.estado = estado;
  aviso.textContent = mensaje;
  aviso.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function ocultarAviso(aviso: HTMLElement | null): void {
  if (!aviso) return;
  aviso.removeAttribute('data-estado');
  aviso.textContent = '';
}

/* --- Deslizador de presupuesto -------------------------------------------- */
const formatoPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

function iniciarPresupuesto(): void {
  const rango = document.querySelector<HTMLInputElement>('[data-rango]');
  const salida = document.querySelector<HTMLOutputElement>('[data-rango-salida]');
  if (!rango || !salida) return;

  const pintar = (): void => {
    const valor = Number(rango.value);
    const texto = formatoPesos.format(valor);
    salida.textContent = valor >= Number(rango.max) ? `${texto} o más` : texto;
  };

  rango.oninput = pintar;
  pintar();
}
