/**
 * preguntas.ts
 * Preguntas frecuentes: antes de contratar (servicios) y antes de escribir (contacto).
 */

export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

export const preguntasServicios: Pregunta[] = [
  {
    pregunta: '¿Puedo contratar un solo servicio?',
    respuesta:
      'Sí. La mayoría de proyectos empieza por uno solo, normalmente el sitio o la automatización. El siguiente paso se propone únicamente cuando los datos del proyecto lo justifican.'
  },
  {
    pregunta: '¿Cuánto tarda un proyecto?',
    respuesta:
      'Depende del alcance. En el diagnóstico definimos un cronograma con fechas concretas por entrega, y lo mantenemos visible durante todo el proyecto.'
  },
  {
    pregunta: '¿El código y las cuentas quedan a mi nombre?',
    respuesta:
      'Sí. Repositorio, dominio, alojamiento y cuentas de publicidad se crean o se transfieren a tu nombre. Trabajamos con accesos, no con propiedad sobre tus activos.'
  },
  {
    pregunta: '¿Trabajan junto a equipos internos?',
    respuesta:
      'Sí, y suele ser lo que mejor funciona. Entregamos documentación, sesiones de traspaso y convenciones de código para que tu equipo pueda continuar sin depender de nosotros.'
  }
];

export const preguntasContacto: Pregunta[] = [
  {
    pregunta: '¿Cobran el diagnóstico?',
    respuesta:
      'La primera conversación no tiene costo. El diagnóstico formal, con mapa del ecosistema y plan de trabajo, se cotiza aparte y se descuenta del proyecto si seguimos adelante.'
  },
  {
    pregunta: '¿Trabajan con clientes fuera de Colombia?',
    respuesta:
      'Sí. El equipo trabaja de forma remota y podemos facturar en moneda local o en dólares, según el caso.'
  },
  {
    pregunta: '¿Qué necesitan de mi lado?',
    respuesta:
      'Una persona con capacidad de decidir y responder con agilidad. Es la variable que más afecta los tiempos de entrega de cualquier proyecto.'
  }
];
