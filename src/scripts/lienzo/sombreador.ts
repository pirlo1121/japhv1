/**
 * sombreador.ts
 * El guía de metal líquido en un único fragment shader, dibujado sobre un
 * triángulo que cubre la pantalla. Sin mallas ni texturas descargadas.
 *
 * - Forma: el robot (escultura.ts), hecho de funciones de distancia con
 *   unión suave (smin): cuerpo, cabeza, brazos, cola y la estela de gotas
 *   que deja al viajar se funden como líquido. Al cargar, nace de una gota
 *   (uFormacion): la gota adelgaza mientras el robot crece dentro de ella.
 * - Material: cromo. Refleja un estudio procedural de paredes azul
 *   medianoche con luces diseñadas: una caja cenital blanca (el cromo sigue
 *   leyéndose como cromo), un filo cian, una tira azul eléctrico, contraluz
 *   violeta y una luz blanca que barre la superficie. El visor brilla cian;
 *   en la escena del núcleo se encienden circuitos de luz en el cuerpo.
 * - Paneles líquidos: algunas piezas de la página ([data-liquido]) nacen
 *   como metal líquido que se solidifica en su forma exacta antes de que
 *   aparezca su contenido. Son un campo de distancias 2D con relieve (no
 *   marchan rayos): baratas también en móvil. Se dibujan detrás del robot.
 * - Rayos: la misma cámara que camara.ts (función `rayo`).
 */
import { FOCAL } from './camara';
import { GOTAS_DE_ESTELA, MAX_PIEZAS, PIEZA, RADIO_LIMITE } from './escultura';

/** Bloques de texto delante de los que la escultura baja sus brillos. */
export const MAX_ZONAS_DE_LECTURA = 3;
/** Paneles líquidos que se dibujan a la vez (solo los visibles que están cambiando). */
export const MAX_PANELES = 4;

export const VERTICE = /* glsl */ `#version 300 es
void main() {
  // Triángulo que cubre la pantalla, sin búfer de vértices.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const f = (n: number) => n.toFixed(4);

export const FRAGMENTO = /* glsl */ `#version 300 es
precision highp float;

#define MAX_PIEZAS ${MAX_PIEZAS}
#define GOTAS ${GOTAS_DE_ESTELA}
#define MAX_ZONAS ${MAX_ZONAS_DE_LECTURA}
#define MAX_PANELES ${MAX_PANELES}

uniform vec2 uRes;
uniform float uTiempo;
uniform float uDetalle;     // 1 completo; 0 ligero (menos pasos, sin oclusión)
uniform vec3 uCamara;
uniform vec3 uObjetivo;
uniform vec2 uDesplazamiento;
uniform float uFase;        // tiempo del movimiento interno (integrado con su velocidad)
uniform float uAtenuacion;  // 0..1: apaga la escena para que mande el contenido
uniform float uRed;         // 0..1: la red despierta; tiñe el borde del cromo
uniform float uGrietas;     // 0..1: circuitos de luz dentro del cuerpo
uniform vec4 uPiezas[MAX_PIEZAS]; // robot: articulaciones, pose, viaje y estela (escultura.ts)
uniform vec4 uZonas[MAX_ZONAS];
uniform int uNumZonas;
uniform vec4 uPaneles[MAX_PANELES];      // rectángulo en uv (x0, y0, x1, y1; y hacia arriba)
uniform vec4 uEstadosPanel[MAX_PANELES]; // x: solidez 0..1, y: semilla, z: radio de esquina (px CSS)
uniform int uNumPaneles;
uniform float uPxCss;                    // píxeles del lienzo por píxel CSS

out vec4 color;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float LIMITE = ${f(RADIO_LIMITE)};
const float FOCAL = ${f(FOCAL)};

// Paleta (tokens.css), en lineal aproximado para la luz.
const vec3 FONDO = vec3(0.0118, 0.0275, 0.0667);
const vec3 CIAN = vec3(0.0, 0.9, 1.0);
const vec3 AZUL = vec3(0.086, 0.467, 1.0);
const vec3 VIOLETA = vec3(0.486, 0.227, 0.929);
const vec3 PURPURA = vec3(0.694, 0.361, 1.0);

float T; // tiempo del movimiento interno

// ---------------------------------------------------------------- utilidades

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Unión suave: dos superficies se funden como gotas.
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float sdCapsula(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdCaja(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// Elipsoide aproximado (distancia acotada, suficiente para relieves pequeños).
float sdElipsoide(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

// ---------------------------------------------------------------- la gota

// La gota de la que nace el robot: una masa con otra gota que se separa y vuelve.
float gota(vec3 p) {
  float d = length(p) - 1.05;
  d += 0.07 * sin(1.7 * p.x + T * 0.9) * sin(1.9 * p.y + T * 0.7) * sin(1.6 * p.z + T * 1.1);
  vec3 g = vec3(0.92 * cos(T * 0.35), 0.62 + 0.1 * sin(T * 0.5), 0.45 * sin(T * 0.35));
  return smin(d, length(p - g) - 0.36, 0.55);
}

// ---------------------------------------------------------------- el guía

// Del mundo al espacio del robot: deshace el giro, la flotación, la
// inclinación y el estiramiento que aplica la página (alMundo en escultura.ts).
vec3 espacioRobot(vec3 p) {
  vec4 pose = uPiezas[${PIEZA.pose}];
  float c = cos(pose.z), s = sin(pose.z);
  vec3 q = vec3(p.x * c - p.z * s, p.y - pose.y, p.x * s + p.z * c);
  q.x -= q.y * uPiezas[${PIEZA.viaje}].x;
  float alto = 1.0 + pose.x;
  float ancho = 1.0 - pose.x * 0.5;
  return q / vec3(ancho, alto, ancho);
}

// Abdominales: seis relieves bajos que se funden con el cuerpo.
float abdominales(vec3 q, float d) {
  for (int i = 0; i < 6; i++) {
    float lado = (i - 2 * (i / 2)) == 0 ? -1.0 : 1.0;
    float fila = float(i / 2);
    vec3 centro = vec3(lado * (0.1 - fila * 0.006), 0.21 - fila * 0.15, 0.36 - fila * 0.006);
    vec3 radio = vec3(0.084, 0.066, 0.05) * (1.0 - fila * 0.07);
    d = smin(d, sdElipsoide(q - centro, radio), 0.05);
  }
  return d;
}

// Cola de animal: nace de la gota del cuerpo, baja hacia un lado y se curva
// arriba en la punta. Se balancea con retraso, y más cuando el robot viaja.
float cola(vec3 q, float velocidad) {
  const int TRAMOS = 6;
  float agite = 0.1 + 0.12 * velocidad;
  vec3 previo = vec3(0.0, -0.66, -0.04);
  float d = 1e3;
  for (int i = 1; i <= TRAMOS; i++) {
    float u = float(i) / float(TRAMOS);
    float vaiven = agite * sin(T * 1.6 - u * 2.4) * u;
    vec3 punto = vec3(
      0.42 * u * u + vaiven,
      -0.66 - 0.62 * u + 0.62 * u * u * u,
      -0.04 - 0.22 * u + 0.08 * cos(T * 1.1 - u * 2.0) * u
    );
    float grosor = mix(0.12, 0.032, u);
    d = smin(d, sdCapsula(q, previo, punto, grosor), 0.04);
    previo = punto;
  }
  return smin(d, length(q - previo) - 0.06, 0.05);
}

// Visor de la cabeza: el hueco que se talla en ella (y que brilla).
float visor(vec3 q) {
  return sdCaja(q - vec3(0.0, 1.1, 0.36), vec3(0.24, 0.08, 0.1), 0.07);
}

// Cada pieza solo se evalúa si el punto está cerca de ella: lejos, una
// cota barata basta para avanzar el rayo (volúmenes envolventes). Los
// márgenes cubren el radio de las uniones suaves, así que la forma no cambia.
float robot(vec3 p) {
  vec4 pose = uPiezas[${PIEZA.pose}];
  // Lejos de todo el robot (cuerpo, brazos extendidos y antena): una esfera.
  vec3 centro = vec3(0.0, pose.y + 0.45, 0.0);
  float lejos = length(p - centro) - 1.95;
  float estela = 1e3;
  for (int k = 0; k < GOTAS; k++) {
    vec4 g = uPiezas[${PIEZA.estela} + k];
    if (g.w < 0.005) continue;
    estela = min(estela, length(p - g.xyz) - g.w);
  }
  if (lejos > 0.3 && estela > 0.3) return min(lejos, estela);

  float alto = 1.0 + pose.x;
  float ancho = 1.0 - pose.x * 0.5;
  vec3 q = espacioRobot(p);

  // Cuerpo atlético pero blando: cintura de huevo, pecho más ancho, dos
  // pectorales apenas marcados y una gota abajo, como si flotara.
  float cuerpo = sdCapsula(q, vec3(0.0), vec3(0.0, 0.28, 0.0), 0.4);
  cuerpo = smin(cuerpo, sdElipsoide(q - vec3(0.0, 0.42, 0.0), vec3(0.56, 0.3, 0.42)), 0.16);
  vec3 pecho = vec3(abs(q.x), q.y, q.z);
  cuerpo = smin(cuerpo, sdElipsoide(pecho - vec3(0.17, 0.46, 0.33), vec3(0.17, 0.1, 0.08)), 0.07);
  cuerpo = smin(cuerpo, length(q - vec3(0.0, -0.6, 0.0)) - 0.15, 0.36);
  // Abdominales solo delante del vientre; cola solo cerca de su recorrido.
  bool vientre = abs(q.x) < 0.42 && q.y > -0.2 && q.y < 0.45 && q.z > 0.12;
  if (uDetalle > 0.5 && vientre) cuerpo = abdominales(q, cuerpo);
  if (length(q - vec3(0.22, -0.98, -0.16)) < 0.85) cuerpo = smin(cuerpo, cola(q, pose.w), 0.08);
  // Cabeza pequeña y redonda, con una visera hundida que recoge la luz.
  float cabeza = sdCaja(q - vec3(0.0, 1.08, 0.0), vec3(0.34, 0.25, 0.3), 0.22);
  cabeza = max(cabeza, -visor(q));
  float cuello = sdCapsula(q, vec3(0.0, 0.66, 0.0), vec3(0.0, 0.95, 0.0), 0.13);
  float d = smin(smin(cuerpo, cuello, 0.1), cabeza, 0.1) * min(alto, ancho);

  // Brazos y antena, en el mundo: cápsulas blandas fundidas con el cuerpo.
  vec3 hombroI = uPiezas[${PIEZA.hombroIzq}].xyz;
  vec3 codoI = uPiezas[${PIEZA.codoIzq}].xyz;
  vec4 manoI = uPiezas[${PIEZA.manoIzq}];
  vec3 hombroD = uPiezas[${PIEZA.hombroDer}].xyz;
  vec3 codoD = uPiezas[${PIEZA.codoDer}].xyz;
  vec4 manoD = uPiezas[${PIEZA.manoDer}];
  float radioHombro = uPiezas[${PIEZA.hombroIzq}].w;
  // Cada brazo, solo si el punto está cerca de él (hombro → mano).
  if (sdCapsula(p, hombroI, manoI.xyz, 0.42) < d + 0.12) {
    d = smin(d, length(p - hombroI) - radioHombro, 0.12);
    d = smin(d, sdCapsula(p, hombroI, codoI, 0.105), 0.1);
    d = smin(d, sdCapsula(p, codoI, manoI.xyz, 0.082), 0.08);
    d = smin(d, length(p - manoI.xyz) - manoI.w, 0.1);
  }
  if (sdCapsula(p, hombroD, manoD.xyz, 0.42) < d + 0.12) {
    d = smin(d, length(p - hombroD) - radioHombro, 0.12);
    d = smin(d, sdCapsula(p, hombroD, codoD, 0.105), 0.1);
    d = smin(d, sdCapsula(p, codoD, manoD.xyz, 0.082), 0.08);
    d = smin(d, length(p - manoD.xyz) - manoD.w, 0.1);
  }
  vec4 antena = uPiezas[${PIEZA.antena}];
  d = smin(d, sdCapsula(p, uPiezas[${PIEZA.cabeza}].xyz, antena.xyz, 0.028), 0.05);
  d = smin(d, length(p - antena.xyz) - antena.w, 0.06);

  // La estela: gotas que lo siguen al viajar y se funden con él.
  for (int k = 0; k < GOTAS; k++) {
    vec4 g = uPiezas[${PIEZA.estela} + k];
    if (g.w < 0.005) continue;
    d = smin(d, length(p - g.xyz) - g.w, 0.3);
  }
  return d;
}

// La distancia a la escena: el robot, o la gota condensándose en él.
float mapa(vec3 p) {
  float s = uPiezas[${PIEZA.viaje}].y;
  if (s >= 0.999) return robot(p);
  if (s <= 0.001) return gota(p);
  s = s * s * (3.0 - 2.0 * s);
  // La gota adelgaza mientras el robot crece dentro de ella, unidos como líquido.
  return smin(gota(p) + s * 0.6, robot(p) + (1.0 - s) * 0.6, 0.3);
}

// El paso crece con la distancia (t): las uniones suaves no son distancias
// exactas y un paso fijo y muy fino daba normales ruidosas.
vec3 normal(vec3 p, float t) {
  vec2 e = vec2(1.0, -1.0) * (0.002 + 0.0004 * t);
  return normalize(
    e.xyy * mapa(p + e.xyy) + e.yyx * mapa(p + e.yyx) +
    e.yxy * mapa(p + e.yxy) + e.xxx * mapa(p + e.xxx)
  );
}

float oclusion(vec3 p, vec3 n) {
  float o = (0.1 - mapa(p + n * 0.1)) + (0.28 - mapa(p + n * 0.28)) * 0.5;
  return clamp(1.0 - o * 2.4, 0.35, 1.0);
}

// ---------------------------------------------------------------- estudio

// Distancia angular sin costura.
float separacion(float a, float b) {
  return abs(mod(a - b + PI, TAU) - PI);
}

// Tira de luz vertical en un azimut: estrecha, alta y de bordes nítidos.
float tira(float az, float h, float centro, float ancho, float suave) {
  float lado = 1.0 - smoothstep(ancho, ancho + suave, separacion(az, centro));
  return lado * (1.0 - smoothstep(0.45, 0.8, abs(h)));
}

// Lo que ve un rayo reflejado. Casi todo es oscuridad azul; la luz está
// diseñada. "a" ensancha los bordes: la aspereza del metal.
vec3 estudio(vec3 d, float a) {
  float az = atan(d.x, d.z);
  float h = d.y;
  // Paredes azul medianoche que se aclaran hacia arriba: el metal necesita
  // algo que reflejar, y así el negro del cromo es azul, no gris.
  vec3 c = mix(vec3(0.012, 0.02, 0.045), vec3(0.075, 0.1, 0.17), smoothstep(-0.05, 0.85, h));

  // Suelo y una línea de horizonte fría: la banda que recorre todo el cromo.
  c = mix(c, vec3(0.02, 0.03, 0.06) * (1.0 + h), step(h, 0.0));
  c += vec3(0.45, 0.6, 0.9) * 0.2 * smoothstep(-0.3, -0.85, h);
  c += vec3(0.75, 0.92, 1.0) * 0.5 * exp(-abs(h) / (0.028 + a));

  // Relleno frontal, amplio y tenue: las caras que miran al espectador se leen.
  c += vec3(0.22, 0.26, 0.36) * exp(-pow(separacion(az, 0.4) / 0.7, 2.0)) * smoothstep(-0.15, 0.25, h) * (1.0 - smoothstep(0.4, 0.9, h));

  // Caja cenital blanca: la luz principal, la que hace que el cromo sea cromo.
  if (h > 0.05) {
    vec2 q = abs(d.xz / h);
    float borde = 0.06 + a * 4.0;
    float caja = (1.0 - smoothstep(1.0, 1.0 + borde, q.x)) * (1.0 - smoothstep(0.55, 0.55 + borde, q.y));
    float barras = smoothstep(0.06, 0.1 + a * 2.0, abs(fract(q.x * 1.5 + 0.5) - 0.5));
    c += vec3(0.96, 0.98, 1.0) * 1.9 * caja * mix(0.35, 1.0, barras) * (1.0 - 0.45 * q.x);
  }

  // Filo cian a la izquierda, tira de azul eléctrico al otro lado.
  c += mix(vec3(1.0), CIAN, 0.55) * 2.6 * tira(az, h, -1.95, 0.03, 0.015 + a);
  c += mix(vec3(1.0), AZUL, 0.7) * 1.8 * tira(az, h, 2.25, 0.018, 0.012 + a);
  // Luz blanca que barre despacio la superficie.
  c += vec3(1.0) * 1.6 * tira(az, h, mod(uTiempo * 0.16, TAU) - PI, 0.02, 0.014 + a);
  // Luz amplia y suave a la derecha, azul.
  c += AZUL * 0.45 * exp(-pow(separacion(az, 1.2) / (0.42 + a), 2.0)) * smoothstep(-0.2, 0.3, h);
  // Contraluz violeta: dibuja el borde.
  c += mix(PURPURA, vec3(1.0), 0.2) * 0.95 * tira(az, h * 1.4, PI, 0.16, 0.08 + a);
  // Una tira turquesa baja y muy estrecha, apenas un destello.
  c += mix(vec3(1.0), CIAN, 0.4) * 0.7 * tira(az, (h + 0.35) * 3.0, 0.9, 0.012, 0.01 + a);
  return c;
}

// ---------------------------------------------------------------- lectura

float zonaDeLectura() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float zona = 0.0;
  for (int i = 0; i < MAX_ZONAS; i++) {
    if (i >= uNumZonas) break;
    vec4 r = uZonas[i];
    vec2 desde = smoothstep(r.xy - 0.05, r.xy + 0.02, uv);
    vec2 hasta = 1.0 - smoothstep(r.zw - 0.02, r.zw + 0.05, uv);
    zona = max(zona, desde.x * desde.y * hasta.x * hasta.y);
  }
  return zona;
}

// ---------------------------------------------------------------- materiales

// Circuitos: los ceros de un campo suave forman una red de líneas finas.
float campoDeCircuitos(vec3 q) {
  return sin(q.x * 6.1 + sin(q.y * 4.3) * 1.2) * sin(q.y * 5.7 + sin(q.z * 5.3)) * sin(q.z * 5.9 + sin(q.x * 3.7));
}

// Se dibujan en el espacio del robot (viajan con él) y se encienden de
// arriba abajo con uGrietas. Distancia a la línea = valor / pendiente:
// grosor uniforme, sin manchas donde se cruzan.
float circuito(vec3 q) {
  float n = campoDeCircuitos(q);
  const float e = 0.01;
  vec3 g = vec3(
    campoDeCircuitos(q + vec3(e, 0.0, 0.0)),
    campoDeCircuitos(q + vec3(0.0, e, 0.0)),
    campoDeCircuitos(q + vec3(0.0, 0.0, e))
  ) - n;
  float distancia = abs(n) / max(length(g) / e, 0.5);
  float linea = 1.0 - smoothstep(0.003, 0.011, distancia);
  float avance = uGrietas * 1.4 - 0.2;
  float revelado = smoothstep(avance, avance - 0.3, 0.6 - q.y * 0.5 + 0.1 * sin(q.x * 4.0));
  return linea * revelado;
}

vec3 cromo(vec3 p, vec3 n, vec3 rd, float ndv) {
  vec3 r = reflect(rd, n);
  // Reflectancia alta y casi neutra, apenas fría; más blanca en el borde (Fresnel).
  vec3 f0 = vec3(0.77, 0.8, 0.85);
  float borde = pow(1.0 - ndv, 5.0);
  vec3 fresnel = f0 + (1.0 - f0) * borde;
  float aspereza = 0.008 + 0.03 * (0.5 + 0.5 * sin(p.x * 3.1 + p.y * 2.3) * sin(p.z * 2.7 - p.y));
  vec3 metal = estudio(r, aspereza) * fresnel;
  // Con la red despierta, el borde del metal recoge un poco de su luz.
  metal += CIAN * 0.12 * uRed * pow(1.0 - ndv, 3.0);
  return metal + vec3(0.016, 0.02, 0.03) * (0.5 + 0.5 * n.y);
}

// ---------------------------------------------------------------- paneles líquidos

// Distancia a un rectángulo redondeado (2D).
float sdRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Dónde termina cada gota cuando el panel se extiende (en el rectángulo, de -1 a 1).
const vec2 HOGARES[7] = vec2[7](
  vec2(-0.66, -0.5), vec2(0.0, -0.55), vec2(0.66, -0.5),
  vec2(-0.66, 0.5), vec2(0.0, 0.55), vec2(0.66, 0.5), vec2(0.0)
);

// El campo del panel en el píxel px: una gota que crece junto a su borde
// superior, el que entra primero en pantalla (solidez 0 → 0.18), se divide
// en gotas que bajan, se extienden y se funden (→ 0.65) y se solidifica en
// el rectángulo exacto del elemento (→ 0.92).
float campoPanel(vec2 px, vec2 centro, vec2 mitad, vec4 estado) {
  float s = estado.x;
  float semilla = estado.y;
  float lado = min(mitad.x, mitad.y);
  float crece = smoothstep(0.0, 0.18, s);
  float extiende = smoothstep(0.1, 0.65, s);
  float solido = smoothstep(0.55, 0.92, s);
  float d = 1e5;
  float k = mix(0.35, 0.6, extiende) * lado;
  vec2 origen = vec2(centro.x, centro.y + mitad.y - lado * 0.55);
  for (int j = 0; j < 7; j++) {
    float fj = float(j) + semilla;
    vec2 temblor = vec2(sin(uFase * 1.3 + fj * 2.1), cos(uFase * 1.1 + fj * 1.7)) * lado * 0.12 * (1.0 - solido);
    vec2 liquido = origen + HOGARES[j] * lado * 0.35 + temblor;
    vec2 destino = centro + HOGARES[j] * mitad * 0.62;
    vec2 c = mix(liquido, destino, extiende);
    float r = mix(lado * 0.22, max(mitad.x * 0.42, mitad.y * 0.6), extiende) * crece * (0.82 + 0.18 * sin(fj * 1.7));
    float dj = length(px - c) - r;
    float h = max(k - abs(d - dj), 0.0) / k;
    d = min(d, dj) - h * h * k * 0.25;
  }
  float radio = estado.z * uPxCss;
  return mix(d, sdRect(px - centro, mitad, radio), solido);
}

// Pinta los paneles sobre el fondo: cromo líquido con relieve que se
// convierte en una placa azul profunda con borde de cromo. Al final se
// desvanece y queda el elemento HTML (que aparece encima a la vez).
vec3 pintarPaneles(vec3 col) {
  vec2 px = gl_FragCoord.xy;
  for (int i = 0; i < MAX_PANELES; i++) {
    if (i >= uNumPaneles) break;
    vec4 r = uPaneles[i] * vec4(uRes, uRes);
    vec4 estado = uEstadosPanel[i];
    vec2 centro = (r.xy + r.zw) * 0.5;
    vec2 mitad = (r.zw - r.xy) * 0.5;
    // Fuera de su caja (con margen para las gotas) no hay nada que pintar.
    vec2 fuera = abs(px - centro) - mitad;
    if (max(fuera.x, fuera.y) > min(mitad.x, mitad.y) * 0.2 + 4.0) continue;

    float d = campoPanel(px, centro, mitad, estado);
    if (d > 2.0 * uPxCss) continue;
    float solido = smoothstep(0.55, 0.92, estado.x);
    float lado = min(mitad.x, mitad.y);
    // Relieve: gotas redondas en estado líquido; un bisel fino al solidificarse.
    float bisel = mix(lado * 0.5, 7.0 * uPxCss, solido);
    float x = clamp(-d / bisel, 0.0, 1.0);
    float borde = 1.0 - x;
    float e = max(1.0, uPxCss);
    vec2 gradiente = vec2(
      campoPanel(px + vec2(e, 0.0), centro, mitad, estado) - d,
      campoPanel(px + vec2(0.0, e), centro, mitad, estado) - d
    );
    vec2 hacia = normalize(gradiente + 1e-5);
    vec3 n = normalize(vec3(hacia * borde * 2.2, 1.0 - borde * 0.55));
    vec3 reflejo = reflect(vec3(0.0, 0.0, -1.0), n);
    // El estudio es el mismo que refleja el robot: el panel es del mismo metal.
    // Se mira inclinado hacia arriba: la cara plana refleja la pared azul y
    // los bordes curvos recorren las tiras de luz.
    vec3 hacia3 = normalize(vec3(reflejo.x, reflejo.y + 0.55, reflejo.z * 0.55));
    // Algo más contenido que el robot: el panel no debe competir con el contenido.
    vec3 metal = estudio(hacia3, 0.012) * (0.62 + 0.25 * pow(borde, 3.0));
    metal += CIAN * 0.25 * pow(borde, 4.0) * (0.6 + 0.4 * sin(uFase * 2.0 + estado.y));
    metal = metal / (1.0 + metal * 0.55) * 1.2;
    // La cara se vuelve la superficie del panel (--superficie) al solidificarse.
    vec3 cara = vec3(0.031, 0.067, 0.13) + vec3(0.0, 0.03, 0.06) * (px.y - r.y) / max(r.w - r.y, 1.0);
    vec3 color = mix(metal, cara, solido * smoothstep(0.15, 0.6, x));
    float cobertura = 1.0 - smoothstep(-uPxCss, uPxCss, d);
    float visible = 1.0 - smoothstep(0.88, 1.0, estado.x);
    col = mix(col, color, cobertura * visible);
  }
  return col;
}

// ---------------------------------------------------------------- composición

// Rayo de la cámara (igual que camara.ts): el centro del robot cae en uDesplazamiento.
vec3 rayo(vec2 ndc) {
  vec3 f = normalize(uObjetivo - uCamara);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  float aspecto = uRes.x / uRes.y;
  return normalize(f * FOCAL + (ndc.x - uDesplazamiento.x) * aspecto * r + (ndc.y - uDesplazamiento.y) * u);
}

void main() {
  T = uFase;
  vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec3 ro = uCamara;
  vec3 rd = rayo(ndc);

  // Fondo: azul medianoche con un halo azul muy contenido detrás del guía y
  // un resto violeta lejano. Es el mismo color que la página.
  vec2 alCentro = (ndc - uDesplazamiento) * vec2(uRes.x / uRes.y, 1.0);
  vec3 col = FONDO + vec3(0.012, 0.035, 0.085) * exp(-dot(alCentro, alCentro) * 0.9) * (1.0 - 0.5 * uAtenuacion);
  col += VIOLETA * 0.018 * exp(-dot(alCentro + vec2(1.2, 0.9), alCentro + vec2(1.2, 0.9)) * 0.6);

  if (uNumPaneles > 0) col = pintarPaneles(col);

  // Solo se marcha dentro de la esfera que contiene al robot y su estela.
  float b = dot(ro, rd);
  float disc = b * b - dot(ro, ro) + LIMITE * LIMITE;
  if (disc > 0.0) {
    float raiz = sqrt(disc);
    float t = max(-b - raiz, 0.0);
    float fin = -b + raiz;
    int pasos = uDetalle > 0.5 ? 100 : 64;
    bool toca = false;
    float d = 1.0;
    for (int i = 0; i < 100; i++) {
      if (i >= pasos) break;
      d = mapa(ro + rd * t);
      if (d < 0.0008 * t) { toca = true; break; }
      // Pasos cortos: las uniones suaves no son distancias exactas.
      t += d * 0.65;
      if (t > fin) break;
    }
    // Los rayos que rozan la silueta pueden quedarse sin pasos justo antes
    // de tocarla: si acabaron pegados a la superficie, cuentan como impacto.
    if (!toca && d < 0.01 && t < fin) toca = true;
    if (toca) t += d;
    if (toca) {
      vec3 p = ro + rd * t;
      vec3 n = normal(p, t);
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      vec3 metal = cromo(p, n, rd, ndv);

      // Ya formado: el visor brilla cian y, en el núcleo, los circuitos.
      float formado = smoothstep(0.6, 1.0, uPiezas[${PIEZA.viaje}].y);
      if (formado > 0.0) {
        vec3 q = espacioRobot(p);
        float enVisor = (1.0 - smoothstep(-0.004, 0.025, visor(q))) * step(0.22, q.z);
        float franja = exp(-pow((q.y - 1.1) / 0.035, 2.0));
        metal += mix(CIAN, vec3(1.0), 0.25) * 1.6 * enVisor * (0.35 + franja) * formado;
        if (uGrietas > 0.01 && q.y < 0.95) {
          vec3 luz = mix(CIAN, PURPURA, smoothstep(-0.6, 0.7, q.y));
          metal += luz * 1.3 * circuito(q) * formado;
        }
      }

      // En la silueta misma el reflejo cambia de un píxel a otro: se apaga suavemente.
      metal *= 0.35 + 0.65 * smoothstep(0.0, 0.22, ndv);
      if (uDetalle > 0.5) metal *= oclusion(p, n);
      // Detrás del texto, el guía baja sus brillos.
      metal *= 1.0 - 0.6 * zonaDeLectura();
      // Curva suave: los brillos no se queman.
      metal = metal / (1.0 + metal * 0.55) * 1.2;
      // La atenuación apaga al guía, no el fondo: la página no cambia de color.
      col = mix(metal, mix(col, metal, 0.22), uAtenuacion);
    }
  }

  // Grano finísimo: evita bandas en los degradados oscuros.
  col += (hash(gl_FragCoord.xy + fract(uTiempo)) - 0.5) * 0.008;
  color = vec4(col, 1.0);
}`;
