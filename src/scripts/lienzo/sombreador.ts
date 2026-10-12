/**
 * sombreador.ts
 * La escultura de metal líquido en un único fragment shader, dibujado sobre
 * un triángulo que cubre la pantalla. Sin mallas ni texturas descargadas.
 *
 * - Forma: funciones de distancia con unión suave (smin): las piezas se
 *   funden como líquido. Cada forma de la historia (escultura.ts) se mezcla
 *   con la siguiente según uForma; mezclar distancias oculta los cambios de
 *   topología (la gota se estira en cinta, la cinta se pliega alrededor del
 *   núcleo...). La gota y la cinta son las de la versión anterior, intactas.
 * - Material: cromo. Refleja un estudio procedural de paredes azul
 *   medianoche con luces diseñadas: una caja cenital blanca (el cromo sigue
 *   leyéndose como cromo), un filo cian, una tira azul eléctrico, contraluz
 *   violeta y una luz blanca que barre la superficie. El núcleo es
 *   obsidiana: un dieléctrico oscuro y pulido con grietas de luz.
 * - Rayos: la misma cámara que camara.ts (función `rayo`).
 */
import { FOCAL } from './camara';
import { CINTA, NUCLEO, ORBITA, PORTAL, RADIO_LIMITE, RAMAS } from './escultura';

/** Bloques de texto delante de los que la escultura baja sus brillos. */
export const MAX_ZONAS_DE_LECTURA = 3;

export const VERTICE = /* glsl */ `#version 300 es
void main() {
  // Triángulo que cubre la pantalla, sin búfer de vértices.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const f = (n: number) => n.toFixed(4);

export const FRAGMENTO = /* glsl */ `#version 300 es
precision highp float;

#define RAMAS ${RAMAS}
#define MAX_ZONAS ${MAX_ZONAS_DE_LECTURA}

uniform vec2 uRes;
uniform float uTiempo;
uniform float uDetalle;     // 1 completo; 0 ligero (menos pasos, sin oclusión)
uniform vec3 uCamara;
uniform vec3 uObjetivo;
uniform vec2 uDesplazamiento;
uniform float uForma;       // 0..4: masa, cinta, núcleo, portal, ecosistema
uniform float uFase;        // tiempo del movimiento interno (integrado con su velocidad)
uniform float uAtenuacion;  // 0..1: apaga la escena para que mande el contenido
uniform float uRed;         // 0..1: la red despierta; tiñe el borde del cromo
uniform float uGrietas;     // 0..1: grietas y aperturas del núcleo
uniform float uFoco;        // módulo destacado (ecosistema); -1 ninguno
uniform float uBrilloFoco;  // 0..1, suavizado en la página
uniform vec4 uZonas[MAX_ZONAS];
uniform int uNumZonas;

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

// Intersección suave: el complemento de smin (bordes redondeados al tallar).
float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
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

float sdToro(vec3 p, float radio, float grosor) {
  return length(vec2(length(p.xz) - radio, p.y)) - grosor;
}

float foco(int i) {
  return float(i) == uFoco ? uBrilloFoco : 0.0;
}

// ---------------------------------------------------------------- formas

// 0 · La gota: una masa monumental con una gota que se separa y vuelve.
float masa(vec3 p) {
  float d = length(p) - 1.05;
  d += 0.07 * sin(1.7 * p.x + T * 0.9) * sin(1.9 * p.y + T * 0.7) * sin(1.6 * p.z + T * 1.1);
  vec3 gota = vec3(0.92 * cos(T * 0.35), 0.62 + 0.1 * sin(T * 0.5), 0.45 * sin(T * 0.35));
  return smin(d, length(p - gota) - 0.36, 0.55);
}

// 1 · Una cinta que se curva y se retuerce sobre sí misma.
float cinta(vec3 p) {
  p.y -= ${f(CINTA.onda)} * sin(p.x * 1.3 + T * 0.6);
  p.yz *= rot(p.x * 0.8 + T * 0.25);
  float d = sdCaja(p, vec3(1.8, ${f(CINTA.alto)}, 0.05), 0.05);
  // Los extremos terminan en gotas: la cinta sigue siendo líquido.
  d = smin(d, length(p - vec3(1.82, 0.0, 0.0)) - 0.14, 0.2);
  return smin(d, length(p + vec3(1.82, 0.0, 0.0)) - 0.14, 0.2);
}

// 2 · El núcleo: una cáscara de obsidiana con aperturas que dejan ver un
// interior de cromo, y la cinta plegada a su alrededor en un arco abierto
// (casi se cierra, pero no llega a tocarse). Devuelve las tres piezas por
// separado porque el material cambia entre ellas; "corte" es la distancia
// a las aperturas (para la luz violeta que sale de dentro).
float nucleoPiezas(vec3 p, out float cascara, out float interior, out float arco, out float corte) {
  vec3 q = p;
  q.xz *= rot(T * 0.08);
  float r = length(q);
  cascara = abs(r - ${f(NUCLEO.cascara)}) - 0.07;
  // Dos ranuras curvas atraviesan la cáscara; se abren con las grietas.
  float ancho = 0.012 + 0.085 * uGrietas;
  float ranura1 = abs(q.y - 0.14 * sin(q.x * 2.2 + 0.4)) - ancho;
  float ranura2 = abs(dot(q, normalize(vec3(0.9, 0.35, 0.55))) + 0.1 * sin(q.y * 3.0)) - ancho * 0.8;
  corte = min(ranura1, ranura2);
  cascara = smax(cascara, -corte, 0.03);
  interior = r - ${f(NUCLEO.interior)} - 0.015 * sin(q.x * 6.0 + T) * sin(q.y * 5.0 - T * 0.7);

  // El arco: la cinta, curvada sobre un plano inclinado alrededor del núcleo.
  vec3 a = p;
  a.yz *= rot(${f(NUCLEO.inclinacion)});
  float angulo = atan(a.z, a.x);
  vec3 c = vec3(angulo * ${f(NUCLEO.arco)}, a.y, length(a.xz) - ${f(NUCLEO.arco)});
  c.y -= 0.2 * sin(angulo * 2.0 + T * 0.6);
  c.yz *= rot(angulo * 0.9 + T * 0.25);
  // Medio largo = ángulo cubierto (2.63 rad) × radio: el hueco del arco queda detrás.
  arco = sdCaja(c, vec3(${f(2.63 * NUCLEO.arco)}, 0.3, 0.045), 0.045);
  return min(min(cascara, interior), arco);
}

float nucleo(vec3 p) {
  float cascara, interior, arco, corte;
  return nucleoPiezas(p, cascara, interior, arco, corte);
}

// 3 · Un aro inclinado con una gota suspendida: el marco del trabajo.
float portal(vec3 p) {
  vec3 q = p;
  q.xy *= rot(${f(PORTAL.giroXY)});
  q.yz *= rot(${f(PORTAL.giroYZ)});
  float d = sdToro(q, ${f(PORTAL.radio)}, ${f(PORTAL.grosor)});
  return min(d, length(p - vec3(0.0, 0.2 * sin(T * 0.6), 0.0)) - 0.3);
}

// 4 · Núcleo, órbita y siete módulos unidos a él: el ecosistema. Cada
// módulo es un servicio; el destacado crece un poco.
float ecosistema(vec3 p) {
  float d = length(p) - 0.62;
  vec3 q = p;
  q.xy *= rot(${f(ORBITA.inclinacion)});
  d = min(d, sdToro(q, ${f(ORBITA.radio)}, 0.018));
  for (int i = 0; i < RAMAS; i++) {
    float a = float(i) * TAU / float(RAMAS) + T * ${f(ORBITA.velocidad)};
    vec3 c = vec3(cos(a) * ${f(ORBITA.radio)}, 0.0, sin(a) * ${f(ORBITA.radio)});
    d = smin(d, length(q - c) - 0.15 - 0.06 * foco(i), 0.12);
    d = smin(d, sdCapsula(q, vec3(0.0), c, 0.016), 0.1);
  }
  return d;
}

float forma(int i, vec3 p) {
  if (i == 0) return masa(p);
  if (i == 1) return cinta(p);
  if (i == 2) return nucleo(p);
  if (i == 3) return portal(p);
  return ecosistema(p);
}

// Mezclar dos distancias funde una forma en la siguiente como un líquido.
float mapa(vec3 p) {
  float x = clamp(uForma, 0.0, 4.0);
  int k = int(floor(x));
  float s = x - float(k);
  s = s * s * (3.0 - 2.0 * s);
  float d = forma(k, p);
  if (s > 0.002 && k < 4) d = mix(d, forma(k + 1, p), s);
  return d;
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
  // Rebote suave desde abajo: la mitad inferior no se hunde en negro.
  c += vec3(0.45, 0.6, 0.9) * 0.2 * smoothstep(-0.3, -0.85, h);
  c += vec3(0.75, 0.92, 1.0) * 0.5 * exp(-abs(h) / (0.028 + a));

  // Relleno frontal, amplio y tenue: las caras que miran al espectador se leen.
  c += vec3(0.22, 0.26, 0.36) * exp(-pow(separacion(az, 0.4) / 0.7, 2.0)) * smoothstep(-0.15, 0.25, h) * (1.0 - smoothstep(0.4, 0.9, h));

  // Caja cenital blanca: la luz principal, la que hace que el cromo sea cromo.
  if (h > 0.05) {
    vec2 q = abs(d.xz / h);
    float borde = 0.06 + a * 4.0;
    float caja = (1.0 - smoothstep(1.0, 1.0 + borde, q.x)) * (1.0 - smoothstep(0.55, 0.55 + borde, q.y));
    // Tres barras con juntas oscuras: se lee como luz de estudio, no como mancha.
    float barras = smoothstep(0.06, 0.1 + a * 2.0, abs(fract(q.x * 1.5 + 0.5) - 0.5));
    c += vec3(0.96, 0.98, 1.0) * 1.9 * caja * mix(0.35, 1.0, barras) * (1.0 - 0.45 * q.x);
  }

  // Filo cian a la izquierda: la luz estrecha que define la forma.
  c += mix(vec3(1.0), CIAN, 0.55) * 2.6 * tira(az, h, -1.95, 0.03, 0.015 + a);
  // Tira fina de azul eléctrico al otro lado: dos filos de luz dan volumen.
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

// Grietas de la obsidiana: los ceros de un campo suave forman una red de
// líneas finas; se encienden poco a poco, de arriba abajo, con uGrietas.
float campoDeGrietas(vec3 q) {
  return sin(q.x * 5.1 + sin(q.y * 4.3) * 1.2) * sin(q.y * 4.7 + sin(q.z * 5.3)) * sin(q.z * 4.9 + sin(q.x * 3.7));
}

float grieta(vec3 p) {
  vec3 q = p;
  q.xz *= rot(T * 0.08);
  // Distancia a la línea = valor / pendiente: grosor uniforme, sin manchas donde se cruzan.
  float n = campoDeGrietas(q);
  const float e = 0.01;
  vec3 g = vec3(
    campoDeGrietas(q + vec3(e, 0.0, 0.0)),
    campoDeGrietas(q + vec3(0.0, e, 0.0)),
    campoDeGrietas(q + vec3(0.0, 0.0, e))
  ) - n;
  float distancia = abs(n) / max(length(g) / e, 0.5);
  float linea = 1.0 - smoothstep(0.003, 0.011, distancia);
  float avance = uGrietas * 1.25 - 0.15;
  float revelado = smoothstep(avance, avance - 0.25, 0.5 - q.y * 0.6 + 0.12 * sin(q.x * 3.0));
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
  // Un mínimo de luz de relleno: ninguna zona queda negra del todo.
  return metal + vec3(0.016, 0.02, 0.03) * (0.5 + 0.5 * n.y);
}

vec3 obsidiana(vec3 p, vec3 n, vec3 rd, float ndv, float corte) {
  vec3 r = reflect(rd, n);
  // Dieléctrico oscuro y pulido: reflejos nítidos solo en ángulos rasantes.
  float fresnel = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
  vec3 c = vec3(0.006, 0.008, 0.016) + estudio(r, 0.004) * fresnel * 0.9;
  vec3 luz = mix(CIAN, PURPURA, smoothstep(-0.6, 0.7, p.y));
  c += luz * 1.3 * grieta(p);
  // Luz violeta que sale de dentro por las aperturas.
  c += mix(VIOLETA, PURPURA, 0.5) * 0.6 * uGrietas * exp(-max(corte, 0.0) * 40.0);
  return c;
}

// ---------------------------------------------------------------- composición

// Rayo de la cámara (igual que camara.ts): el centro de la escultura cae en uDesplazamiento.
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

  // Fondo: azul medianoche con un halo azul muy contenido detrás de la
  // escultura y un resto violeta lejano. Es el mismo color que la página.
  vec2 alCentro = (ndc - uDesplazamiento) * vec2(uRes.x / uRes.y, 1.0);
  vec3 col = FONDO + vec3(0.012, 0.035, 0.085) * exp(-dot(alCentro, alCentro) * 0.9) * (1.0 - 0.5 * uAtenuacion);
  col += VIOLETA * 0.018 * exp(-dot(alCentro + vec2(1.2, 0.9), alCentro + vec2(1.2, 0.9)) * 0.6);

  // Solo se marcha dentro de la esfera que contiene todas las formas.
  float b = dot(ro, rd);
  float disc = b * b - dot(ro, ro) + LIMITE * LIMITE;
  if (disc > 0.0) {
    float raiz = sqrt(disc);
    float t = max(-b - raiz, 0.0);
    float fin = -b + raiz;
    int pasos = uDetalle > 0.5 ? 110 : 70;
    bool toca = false;
    float d = 1.0;
    for (int i = 0; i < 110; i++) {
      if (i >= pasos) break;
      d = mapa(ro + rd * t);
      if (d < 0.0008 * t) { toca = true; break; }
      // Pasos cortos: las formas retorcidas no son distancias exactas.
      t += d * 0.6;
      if (t > fin) break;
    }
    // Los rayos que rozan la silueta pueden quedarse sin pasos justo antes
    // de tocarla: si acabaron pegados a la superficie, cuentan como impacto.
    if (!toca && d < 0.01 && t < fin) toca = true;
    // Un paso más para asentar el punto sobre la superficie: bordes sin dientes.
    if (toca) t += d;
    if (toca) {
      vec3 p = ro + rd * t;
      vec3 n = normal(p, t);
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      vec3 metal = cromo(p, n, rd, ndv);

      // Cerca del núcleo, la cáscara es obsidiana y el interior brilla violeta.
      float pesoNucleo = clamp(1.0 - abs(uForma - 2.0), 0.0, 1.0);
      if (pesoNucleo > 0.001) {
        float cascara, interior, arco, corte;
        nucleoPiezas(p, cascara, interior, arco, corte);
        float esCascara = 1.0 - smoothstep(-0.004, 0.02, cascara - min(interior, arco));
        float esInterior = 1.0 - smoothstep(-0.004, 0.02, interior - min(cascara, arco));
        metal += PURPURA * 0.22 * uGrietas * esInterior * pesoNucleo;
        metal = mix(metal, obsidiana(p, n, rd, ndv, corte), esCascara * pesoNucleo);
      }

      // En la silueta misma el reflejo cambia de un píxel a otro: se apaga suavemente.
      metal *= 0.35 + 0.65 * smoothstep(0.0, 0.22, ndv);
      if (uDetalle > 0.5) metal *= oclusion(p, n);
      // Detrás del texto, la escultura baja sus brillos.
      metal *= 1.0 - 0.6 * zonaDeLectura();
      // Curva suave: los brillos no se queman.
      metal = metal / (1.0 + metal * 0.55) * 1.2;
      // La atenuación apaga la escultura, no el fondo: la página no cambia de color.
      col = mix(metal, mix(col, metal, 0.22), uAtenuacion);
    }
  }

  // Grano finísimo: evita bandas en los degradados oscuros.
  col += (hash(gl_FragCoord.xy + fract(uTiempo)) - 0.5) * 0.008;
  color = vec4(col, 1.0);
}`;
