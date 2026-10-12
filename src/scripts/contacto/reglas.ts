/**
 * reglas.ts
 * Reglas de validación del formulario de contacto, por nombre de campo.
 * Son el espejo de server/src/middleware/validateContact.js: aquí dan
 * respuesta inmediata, pero la seguridad la pone el servidor.
 */

type Campo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export interface Regla {
  valida: (campo: Campo) => boolean;
  error: string;
}

const texto = (campo: Campo): string => campo.value.trim();

export const REGLAS: Record<string, Regla> = {
  nombre: {
    valida: (campo) => texto(campo).length >= 2 && texto(campo).length <= 80,
    error: 'Escribe tu nombre: entre 2 y 80 caracteres.'
  },
  email: {
    valida: (campo) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(texto(campo)),
    error: 'Revisa el correo: debe tener el formato nombre@dominio.com.'
  },
  empresa: {
    valida: (campo) => texto(campo).length <= 80,
    error: 'El nombre de la empresa no puede superar 80 caracteres.'
  },
  telefono: {
    valida: (campo) => texto(campo) === '' || /^[+()\d\s-]{7,20}$/.test(texto(campo)),
    error: 'El teléfono solo admite números, espacios, paréntesis, + y guiones.'
  },
  servicio: {
    valida: (campo) => texto(campo) !== '',
    error: 'Selecciona el servicio que te interesa.'
  },
  mensaje: {
    valida: (campo) => texto(campo).length >= 20 && texto(campo).length <= 2000,
    error: 'Cuéntanos un poco más: al menos 20 caracteres.'
  },
  consentimiento: {
    // Un checkbox no se valida por su texto sino por si quedó marcado.
    valida: (campo) => campo instanceof HTMLInputElement && campo.checked,
    error: 'Debes aceptar la Política de Privacidad para enviar el formulario.'
  }
};
