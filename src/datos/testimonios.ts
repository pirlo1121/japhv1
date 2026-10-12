/**
 * testimonios.ts
 * EJEMPLO: ninguna de estas citas corresponde a una persona real.
 * Reemplázalas por opiniones autorizadas por escrito, con nombre, cargo y
 * empresa verificables, y cambia `ejemplo` a false.
 */

export interface Testimonio {
  cita: string;
  autor: string;
  ejemplo: boolean;
}

export const testimonios: Testimonio[] = [
  {
    cita: 'Espacio para la cita del cliente. Funciona mejor si menciona un problema concreto y qué cambió después del proyecto.',
    autor: 'Nombre y apellido · Cargo, Empresa',
    ejemplo: true
  },
  {
    cita: 'Segunda cita de ejemplo. Conviene que hable de la forma de trabajo: tiempos, comunicación o acompañamiento posterior.',
    autor: 'Nombre y apellido · Cargo, Empresa',
    ejemplo: true
  },
  {
    cita: 'Tercera cita de ejemplo. Si el cliente puede dar una cifra verificable, este es el lugar para incluirla.',
    autor: 'Nombre y apellido · Cargo, Empresa',
    ejemplo: true
  }
];
