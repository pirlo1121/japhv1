/**
 * sombreador.ts
 * La arquitectura monumental y la escultura de cromo en un único fragment shader,
 * dibujado sobre un triángulo que cubre la pantalla. Sin mallas ni
 * texturas descargadas.
 *
 * - Arquitectura (arquitectura.ts): monolitos, losas y marcos con hueco de
 *   grafito oscuro o cromo negro. Se intersecan analíticamente (rayo contra
 *   caja, sin marchar): bordes exactos y coste fijo por pieza. Absorben casi
 *   toda la luz; una luz principal con caída los modela y unas aristas
 *   metálicas finas (de grosor constante en píxeles) revelan su escala. Las
 *   tiras de luz son líneas de plata con halo. La niebla de profundidad
 *   funde lo lejano en el negro del fondo.
 * - Metal líquido (escultura.ts): una gota que se estira en una cinta curva
 *   (dos Bézier cuadráticas con grosor variable), unidas con unión suave.
 *   Se marcha solo dentro de su esfera límite. Es cromo: refleja un estudio
 *   procedural (caja cenital blanca, filo blanco, contraluz plateado y una
 *   sola tira de azul frío) y, de verdad, la arquitectura que tiene alrededor.
 * - Luz: blanca y plateada. El azul frío (FRIO) solo aparece donde algo
 *   significa: el módulo del servicio activo y la puerta de la fase actual
 *   (el cuarto vec4 de cada pieza dice cuánto de su luz es fría).
 * - La gota, el cromo, el estudio y el fondo son los mismos que pintan el
 *   póster de la gota (Lienzo.astro): con la arquitectura aún oculta, el
 *   primer fotograma coincide con él.
 * - Rayos: la misma cámara que camara.ts (función `rayo`).
 */
import { MAX_CAJAS, TIPO, VEC4_POR_CAJA } from './arquitectura';
import { LIQUIDO, MAX_LIQUIDO } from './escultura';

/** Bloques de texto delante de los que la escena baja sus brillos. */
export const MAX_ZONAS_DE_LECTURA = 3;

export const VERTICE = /* glsl */ `#version 300 es
void main() {
  // Triángulo que cubre la pantalla, sin búfer de vértices.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const L = (k: number) => `uLiquido[${k}]`;

export const FRAGMENTO = /* glsl */ `#version 300 es
precision highp float;

#define MAX_CAJAS ${MAX_CAJAS}
#define VEC4_CAJA ${VEC4_POR_CAJA}
#define MAX_ZONAS ${MAX_ZONAS_DE_LECTURA}
#define EMISIVO ${TIPO.emisivo}.0
#define MARCO ${TIPO.marco}.0

uniform vec2 uRes;
uniform float uTiempo;      // segundos desde que WebGL pinta (la luz que barre el estudio)
uniform float uDetalle;     // 1 completo; 0 ligero (menos pasos, sin oclusión)
uniform vec3 uCamara;
uniform vec3 uObjetivo;
uniform vec2 uDesplazamiento;
uniform float uFocal;       // 1 / tan(campo de visión / 2) (camara.ts)
uniform float uFase;        // tiempo del movimiento interno (integrado con su velocidad)
uniform float uAtenuacion;  // 0..1: apaga la escultura para que mande el contenido
uniform vec4 uLiquido[${MAX_LIQUIDO}];           // gota, cinta y esfera límite (escultura.ts)
uniform vec4 uCajas[MAX_CAJAS * VEC4_CAJA];    // piezas de la arquitectura (arquitectura.ts)
uniform int uNumCajas;
uniform vec4 uLuz;                             // luz principal: posición e intensidad
uniform vec4 uZonas[MAX_ZONAS];
uniform int uNumZonas;

out vec4 color;

const float PI = 3.14159265;
const float TAU = 6.28318531;

// Paleta (tokens.css). FONDO es exactamente --fondo: el lienzo y la página
// son el mismo espacio. FRIO es --frio, el único acento de color.
const vec3 FONDO = vec3(0.0275, 0.0314, 0.0392);
const vec3 FRIO = vec3(0.62, 0.77, 0.925);
// Arquitectura: grafito que absorbe la luz, su cara iluminada y el metal de sus aristas.
const vec3 GRAFITO = vec3(0.032, 0.034, 0.04);
const vec3 GRAFITO_LUZ = vec3(0.115, 0.12, 0.135);
const vec3 METAL = vec3(0.77, 0.79, 0.82);
// La luz de la arquitectura (tiras, interior de los marcos): plata.
const vec3 PLATA = vec3(0.84, 0.87, 0.92);
// Halo del fondo detrás del objetivo: FONDO + HALO es --halo-escena-rgb.
const vec3 HALO = vec3(0.022, 0.023, 0.026);

float T; // tiempo del movimiento interno
float PIXEL; // unidades del mundo por píxel a distancia 1

// ---------------------------------------------------------------- utilidades

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Unión suave: dos superficies se funden como gotas.
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// Distancia a una Bézier cuadrática (x) y su parámetro más cercano (y). Inigo Quilez.
vec2 sdBezier(vec3 pos, vec3 A, vec3 B, vec3 C) {
  vec3 a = B - A;
  vec3 b = A - 2.0 * B + C;
  vec3 c = a * 2.0;
  vec3 d = A - pos;
  float kk = 1.0 / dot(b, b);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float p = ky - kx * kx;
  float p3 = p * p * p;
  float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p3;
  vec2 res;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
    vec3 r = d + (c + b * t) * t;
    res = vec2(dot(r, r), t);
  } else {
    float z = sqrt(-p);
    float v = acos(q / (p * z * 2.0)) / 3.0;
    float m = cos(v);
    float n = sin(v) * 1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    vec3 rx = d + (c + b * t.x) * t.x;
    vec3 ry = d + (c + b * t.y) * t.y;
    float dx = dot(rx, rx);
    float dy = dot(ry, ry);
    res = dx < dy ? vec2(dx, t.x) : vec2(dy, t.y);
  }
  return vec2(sqrt(res.x), res.y);
}

// ---------------------------------------------------------------- el líquido

// La gota: una masa con otra gota que se separa y vuelve. Flota (su centro
// lo pone escultura.ts). Es la misma que pinta el póster.
float gota(vec3 p) {
  p -= ${L(LIQUIDO.gota)}.xyz;
  float d = length(p) - 1.05;
  d += 0.07 * sin(1.7 * p.x + T * 0.9) * sin(1.9 * p.y + T * 0.7) * sin(1.6 * p.z + T * 1.1);
  vec3 g = vec3(0.92 * cos(T * 0.35), 0.62 + 0.1 * sin(T * 0.5), 0.45 * sin(T * 0.35));
  return smin(d, length(p - g) - 0.36, 0.55);
}

// Grosor a lo largo de un tramo: Bézier cuadrática de los tres grosores.
float grosor(float a, float b, float c, float t) {
  return mix(mix(a, b, t), mix(b, c, t), t);
}

// La cinta: dos tramos de Bézier con grosor variable, unidos sin costura.
float cinta(vec3 p) {
  vec4 p0 = ${L(LIQUIDO.cinta)};
  vec4 p1 = ${L(LIQUIDO.cinta + 1)};
  vec4 p2 = ${L(LIQUIDO.cinta + 2)};
  vec4 p3 = ${L(LIQUIDO.cinta + 3)};
  vec4 p4 = ${L(LIQUIDO.cinta + 4)};
  vec2 a = sdBezier(p, p0.xyz, p1.xyz, p2.xyz);
  vec2 b = sdBezier(p, p2.xyz, p3.xyz, p4.xyz);
  float da = a.x - grosor(p0.w, p1.w, p2.w, a.y);
  float db = b.x - grosor(p2.w, p3.w, p4.w, b.y);
  float d = smin(da, db, 0.12);
  // Una ondulación finísima: el metal es líquido, no un tubo torneado.
  return d + 0.012 * sin(p.x * 5.0 + T * 1.1) * sin(p.y * 4.3 - T * 0.8) * sin(p.z * 4.7 + T * 0.6);
}

// La gota se estira en la cinta: adelgaza mientras la cinta crece desde ella.
float mapa(vec3 p) {
  float s = ${L(LIQUIDO.gota)}.w;
  if (s <= 0.001) return gota(p);
  if (s >= 0.999) return cinta(p);
  s = s * s * (3.0 - 2.0 * s);
  return smin(gota(p) + s * 0.9, cinta(p) + (1.0 - s) * 0.5, 0.45);
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

// Lo que ve un rayo reflejado. Casi todo es oscuridad; la luz está
// diseñada. "a" ensancha los bordes: la aspereza del metal.
vec3 estudio(vec3 d, float a) {
  float az = atan(d.x, d.z);
  float h = d.y;
  // Paredes de grafito que se aclaran hacia arriba: el metal necesita algo
  // que reflejar para leerse como metal y no como un agujero.
  vec3 c = mix(vec3(0.014, 0.015, 0.018), vec3(0.09, 0.095, 0.105), smoothstep(-0.05, 0.85, h));

  // Suelo y una línea de horizonte plateada: la banda que recorre todo el cromo.
  c = mix(c, vec3(0.025, 0.026, 0.03) * (1.0 + h), step(h, 0.0));
  c += vec3(0.6, 0.63, 0.68) * 0.18 * smoothstep(-0.3, -0.85, h);
  c += vec3(0.9, 0.93, 0.97) * 0.5 * exp(-abs(h) / (0.028 + a));

  // Relleno frontal, amplio y tenue: las caras que miran al espectador se leen.
  c += vec3(0.25, 0.26, 0.29) * exp(-pow(separacion(az, 0.4) / 0.7, 2.0)) * smoothstep(-0.15, 0.25, h) * (1.0 - smoothstep(0.4, 0.9, h));

  // Caja cenital blanca: la luz principal, la que hace que el cromo sea cromo.
  if (h > 0.05) {
    vec2 q = abs(d.xz / h);
    float borde = 0.06 + a * 4.0;
    float caja = (1.0 - smoothstep(1.0, 1.0 + borde, q.x)) * (1.0 - smoothstep(0.55, 0.55 + borde, q.y));
    float barras = smoothstep(0.06, 0.1 + a * 2.0, abs(fract(q.x * 1.5 + 0.5) - 0.5));
    c += vec3(0.96, 0.98, 1.0) * 1.9 * caja * mix(0.35, 1.0, barras) * (1.0 - 0.45 * q.x);
  }

  // Filo blanco a la izquierda; al otro lado, una tira estrecha de azul
  // frío: la única luz de color, y discreta.
  c += vec3(1.0) * 2.4 * tira(az, h, -1.95, 0.03, 0.015 + a);
  c += mix(vec3(1.0), FRIO, 0.6) * 1.2 * tira(az, h, 2.25, 0.018, 0.012 + a);
  // Luz blanca que barre despacio la superficie.
  c += vec3(1.0) * 1.6 * tira(az, h, mod(uTiempo * 0.16, TAU) - PI, 0.02, 0.014 + a);
  // Luz amplia y suave a la derecha, plateada.
  c += vec3(0.5, 0.53, 0.58) * 0.4 * exp(-pow(separacion(az, 1.2) / (0.42 + a), 2.0)) * smoothstep(-0.2, 0.3, h);
  // Contraluz plateado: dibuja el borde.
  c += vec3(0.85, 0.87, 0.9) * 0.7 * tira(az, h * 1.4, PI, 0.16, 0.08 + a);
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

// ---------------------------------------------------------------- arquitectura

struct Golpe {
  float t;
  int i;
  vec3 n;   // normal en el espacio de la pieza
  vec3 q;   // punto en el espacio de la pieza
};

// Del mundo al espacio de una pieza (deshace su giro alrededor del eje vertical).
vec3 alLocal(vec3 v, float giro) {
  float c = cos(giro), s = sin(giro);
  return vec3(c * v.x - s * v.z, v.y, s * v.x + c * v.z);
}

vec3 alMundo(vec3 v, float giro) {
  float c = cos(giro), s = sin(giro);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

// Rayo contra la pieza i (caja, o marco con un hueco que la atraviesa en z).
// Devuelve t > 0 si la toca. Las tiras de luz no se tocan: son halo.
float tocar(vec3 ro, vec3 rd, int i, out vec3 nl, out vec3 ql) {
  vec4 A = uCajas[i * VEC4_CAJA];
  vec4 B = uCajas[i * VEC4_CAJA + 1];
  nl = vec3(0.0);
  ql = vec3(0.0);
  if (B.w == EMISIVO) return -1.0;
  vec3 o = alLocal(ro - A.xyz, A.w);
  vec3 d = alLocal(rd, A.w);
  vec3 m = 1.0 / d;
  vec3 n = m * o;
  vec3 k = abs(m) * B.xyz;
  vec3 t1 = -n - k;
  vec3 t2 = -n + k;
  float tN = max(max(t1.x, t1.y), t1.z);
  float tF = min(min(t2.x, t2.y), t2.z);
  if (tN > tF || tN < 0.0) return -1.0;
  nl = -sign(d) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz);
  ql = o + d * tN;
  if (B.w == MARCO) {
    vec2 hueco = uCajas[i * VEC4_CAJA + 3].xy;
    if (abs(ql.x) < hueco.x && abs(ql.y) < hueco.y) {
      // Entra por el hueco: o choca con una pared del túnel o lo atraviesa.
      vec3 kh = abs(m) * vec3(hueco, B.z + 1.0);
      vec3 sal = -n + kh;
      float tS = min(sal.x, sal.y);
      vec3 qs = o + d * tS;
      if (abs(qs.z) >= B.z) return -1.0;
      nl = sal.x < sal.y ? vec3(-sign(d.x), 0.0, 0.0) : vec3(0.0, -sign(d.y), 0.0);
      ql = qs;
      return tS;
    }
  }
  return tN;
}

Golpe arquitecturaMasCercana(vec3 ro, vec3 rd, float tMax) {
  Golpe g;
  g.t = tMax;
  g.i = -1;
  g.n = vec3(0.0);
  g.q = vec3(0.0);
  for (int i = 0; i < MAX_CAJAS; i++) {
    if (i >= uNumCajas) break;
    vec3 nl, ql;
    float t = tocar(ro, rd, i, nl, ql);
    if (t > 0.0 && t < g.t) {
      g.t = t;
      g.i = i;
      g.n = nl;
      g.q = ql;
    }
  }
  return g;
}

// Distancia del punto a la arista más cercana de su cara (espacio de la pieza).
float distanciaAArista(vec3 q, vec3 n, vec3 h, vec2 hueco, bool marco) {
  vec3 a = h - abs(q);
  float e;
  if (abs(n.x) > 0.5) e = min(a.y, a.z);
  else if (abs(n.y) > 0.5) e = min(a.x, a.z);
  else e = min(a.x, a.y);
  if (marco) {
    // Cara frontal: el borde del hueco también es arista.
    if (abs(n.z) > 0.5) e = min(e, length(max(abs(q.xy) - hueco, 0.0)));
    // Paredes del túnel: aristas en la boca y en el fondo.
    else if (abs(q.x) <= hueco.x + 0.001 && abs(q.y) <= hueco.y + 0.001) e = min(e, h.z - abs(q.z));
  }
  return e;
}

// El grafito de la arquitectura: casi negro, modelado por la luz principal,
// satinado o cromo negro según "pulido", con aristas de metal fino.
vec3 sombrearPieza(Golpe g, vec3 ro, vec3 rd, float ancho, bool enReflejo) {
  int b = g.i * VEC4_CAJA;
  vec4 A = uCajas[b];
  vec4 B = uCajas[b + 1];
  vec4 C = uCajas[b + 2];
  vec4 D = uCajas[b + 3];
  vec2 hueco = D.xy;
  // Su luz: plata, o azul frío si es un estado activo (D.z).
  vec3 luzPropia = mix(PLATA, FRIO, D.z);
  bool marco = B.w == MARCO;
  vec3 p = ro + rd * g.t;
  vec3 n = alMundo(g.n, A.w);
  bool tunel = marco && abs(g.n.z) < 0.5 && abs(g.q.x) <= hueco.x + 0.001 && abs(g.q.y) <= hueco.y + 0.001;

  vec3 l = uLuz.xyz - p;
  float d2 = dot(l, l);
  l *= inversesqrt(d2);
  float caida = uLuz.w * 90.0 / (d2 + 40.0);
  float difusa = max(dot(n, l), 0.0);
  // La cara que mira a la luz se aclara hacia el grafito iluminado; la que
  // no, se queda casi negra. Un degradado cenital (más luz arriba, sombra
  // abajo) da peso a los volúmenes; las caras de arriba reciben el cielo.
  float cenital = smoothstep(-7.0, 8.0, p.y);
  float luz = clamp(difusa * caida * 1.35, 0.0, 1.0) * (0.45 + 0.55 * cenital);
  vec3 col = mix(GRAFITO * (0.45 + 0.55 * cenital), GRAFITO_LUZ, luz);
  col += GRAFITO_LUZ * 0.45 * max(n.y, 0.0);

  float pulido = C.w;
  vec3 v = -rd;
  vec3 hv = normalize(l + v);
  float brillo = pow(max(dot(n, hv), 0.0), mix(16.0, 120.0, pulido));
  col += vec3(0.7, 0.72, 0.76) * brillo * caida * mix(0.05, 0.5, pulido);
  if (!enReflejo && pulido > 0.01) {
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    col += estudio(reflect(rd, n), 0.08) * fres * pulido * 0.22;
  }

  // Aristas: una línea de metal de grosor constante en pantalla.
  float e = distanciaAArista(g.q, g.n, B.xyz, hueco, marco);
  float linea = 1.0 - smoothstep(ancho * 0.6, ancho * 1.9, e);
  float bisel = exp(-e / (ancho * 6.0 + 0.02)) * 0.18;
  float recoge = C.x * (0.35 + 0.9 * caida * (0.5 + 0.5 * dot(n, l)));
  col += mix(METAL, FRIO, 0.5 * D.z) * (linea + bisel) * recoge;

  // Marcos con luz interior: el túnel se baña de luz hacia el fondo.
  if (tunel && C.y > 0.0) {
    float fondo = smoothstep(-B.z, B.z, -g.q.z);
    col += luzPropia * C.y * (0.08 + 0.35 * fondo) * (0.6 + 0.4 * linea);
  }
  // Una pieza encendida (el módulo del servicio activo): sus aristas se
  // vuelven frías y su cara recoge un velo de luz que sube desde abajo.
  if (!marco && C.y > 0.0) {
    float velo = smoothstep(B.y, -B.y, g.q.y) * 0.06;
    col += luzPropia * C.y * ((linea + bisel) * 1.4 + velo);
  }
  return col;
}

// Distancia mínima entre el rayo y un segmento: (distancia, t sobre el rayo).
vec2 rayoSegmento(vec3 ro, vec3 rd, vec3 a, vec3 b) {
  vec3 ba = b - a;
  vec3 oa = ro - a;
  float bb = dot(ba, ba);
  float rb = dot(rd, ba);
  float ro2 = dot(oa, rd);
  float ob = dot(oa, ba);
  float den = bb - rb * rb;
  float s = den > 1e-5 ? clamp((ob - ro2 * rb) / den, 0.0, 1.0) : 0.0;
  vec3 punto = a + ba * s;
  float t = max(dot(punto - ro, rd), 0.0);
  return vec2(length(ro + rd * t - punto), t);
}

// Las tiras de luz: una línea emisiva nítida y un halo que ilumina el aire.
vec3 tirasDeLuz(vec3 ro, vec3 rd, float tMax, float escala) {
  vec3 luz = vec3(0.0);
  for (int i = 0; i < MAX_CAJAS; i++) {
    if (i >= uNumCajas) break;
    vec4 B = uCajas[i * VEC4_CAJA + 1];
    if (B.w != EMISIVO) continue;
    vec4 A = uCajas[i * VEC4_CAJA];
    vec4 C = uCajas[i * VEC4_CAJA + 2];
    // El eje largo de la tira.
    vec3 eje = B.x > B.y && B.x > B.z ? vec3(B.x, 0.0, 0.0) : (B.y > B.z ? vec3(0.0, B.y, 0.0) : vec3(0.0, 0.0, B.z));
    eje = alMundo(eje, A.w);
    vec2 r = rayoSegmento(ro, rd, A.xyz - eje, A.xyz + eje);
    if (r.y > tMax) continue;
    float ancho = PIXEL * r.y * escala;
    float nucleo = exp(-pow(r.x / (ancho * 1.1), 2.0));
    float halo = exp(-r.x / 0.16) * 0.18 + exp(-r.x / 0.9) * 0.05;
    luz += mix(PLATA * 0.8, vec3(1.0), 0.35 * nucleo) * (nucleo * 1.6 + halo) * C.y * C.z;
  }
  return luz;
}

// ---------------------------------------------------------------- materiales

vec3 cromo(vec3 p, vec3 n, vec3 rd, float ndv) {
  vec3 r = reflect(rd, n);
  // Reflectancia alta y casi neutra, apenas fría; más blanca en el borde (Fresnel).
  vec3 f0 = vec3(0.77, 0.8, 0.85);
  float borde = pow(1.0 - ndv, 5.0);
  vec3 fresnel = f0 + (1.0 - f0) * borde;
  float aspereza = 0.008 + 0.03 * (0.5 + 0.5 * sin(p.x * 3.1 + p.y * 2.3) * sin(p.z * 2.7 - p.y));
  vec3 reflejo = estudio(r, aspereza);
  // El cromo refleja la arquitectura que tiene alrededor: las piezas tapan
  // el estudio y sus aristas y tiras de luz se ven en la superficie.
  if (uNumCajas > 0) {
    vec3 ro = p + n * 0.02;
    Golpe g = arquitecturaMasCercana(ro, r, 60.0);
    if (g.i >= 0) {
      float presencia = uCajas[g.i * VEC4_CAJA + 2].z;
      vec3 pieza = sombrearPieza(g, ro, r, 0.02, true);
      reflejo = mix(reflejo, pieza, presencia);
    }
    reflejo += tirasDeLuz(ro, r, g.t, 3.0);
  }
  vec3 metal = reflejo * fresnel;
  return metal + vec3(0.018, 0.019, 0.022) * (0.5 + 0.5 * n.y);
}

// ---------------------------------------------------------------- composición

// Rayo de la cámara (igual que camara.ts): el objetivo cae en uDesplazamiento.
vec3 rayo(vec2 ndc) {
  vec3 f = normalize(uObjetivo - uCamara);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  float aspecto = uRes.x / uRes.y;
  return normalize(f * uFocal + (ndc.x - uDesplazamiento.x) * aspecto * r + (ndc.y - uDesplazamiento.y) * u);
}

// Fondo: negro con un halo de grafito muy contenido detrás del objetivo. Es
// el mismo color que la página (Lienzo.astro lo reproduce en CSS).
vec3 fondo(vec2 ndc) {
  vec2 alCentro = (ndc - uDesplazamiento) * vec2(uRes.x / uRes.y, 1.0);
  return FONDO + HALO * exp(-dot(alCentro, alCentro) * 0.9) * (1.0 - 0.5 * uAtenuacion);
}

void main() {
  T = uFase;
  vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  PIXEL = 2.0 / (uRes.y * uFocal);
  vec3 ro = uCamara;
  vec3 rd = rayo(ndc);
  vec3 cielo = fondo(ndc);
  vec3 col = cielo;
  float lectura = zonaDeLectura();

  // La arquitectura: la pieza más cercana, fundida en la niebla con la distancia.
  Golpe g = arquitecturaMasCercana(ro, rd, 1e4);
  if (g.i >= 0) {
    float ancho = PIXEL * g.t * 1.2;
    vec3 pieza = sombrearPieza(g, ro, rd, ancho, false);
    float presencia = uCajas[g.i * VEC4_CAJA + 2].z;
    // Perspectiva atmosférica: lo lejano se funde en el aire.
    float niebla = 1.0 - exp(-max(g.t - 7.0, 0.0) * 0.05);
    vec3 aire = cielo * 1.6 + vec3(0.008, 0.009, 0.011);
    // Detrás del texto, las aristas se apagan: manda la lectura.
    pieza = mix(pieza, GRAFITO * 0.35, lectura * 0.55);
    col = mix(cielo, mix(pieza, aire, niebla), presencia);
  }

  // El líquido: solo se marcha dentro de su esfera límite y antes de la arquitectura.
  vec4 esfera = ${L(LIQUIDO.esfera)};
  vec3 oc = ro - esfera.xyz;
  float b = dot(oc, rd);
  float disc = b * b - dot(oc, oc) + esfera.w * esfera.w;
  if (disc > 0.0) {
    float raiz = sqrt(disc);
    float t = max(-b - raiz, 0.0);
    float fin = min(-b + raiz, g.t);
    int pasos = uDetalle > 0.5 ? 110 : 70;
    bool toca = false;
    float d = 1.0;
    for (int i = 0; i < 110; i++) {
      if (i >= pasos || t > fin) break;
      d = mapa(ro + rd * t);
      if (d < 0.0008 * t) { toca = true; break; }
      // Pasos cortos: las uniones suaves y la cinta no son distancias exactas.
      t += d * 0.65;
    }
    // Los rayos que rozan la silueta pueden quedarse sin pasos justo antes
    // de tocarla: si acabaron pegados a la superficie, cuentan como impacto.
    if (!toca && d < 0.01 && t < fin) toca = true;
    if (toca) {
      t += d;
      vec3 p = ro + rd * t;
      vec3 n = normal(p, t);
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      vec3 metal = cromo(p, n, rd, ndv);
      // En la silueta misma el reflejo cambia de un píxel a otro: se apaga suavemente.
      metal *= 0.35 + 0.65 * smoothstep(0.0, 0.22, ndv);
      if (uDetalle > 0.5) metal *= oclusion(p, n);
      // Detrás del texto, la escultura baja sus brillos.
      metal *= 1.0 - 0.6 * lectura;
      // Curva suave: los brillos no se queman.
      metal = metal / (1.0 + metal * 0.55) * 1.2;
      // La atenuación apaga la escultura, no el fondo.
      col = mix(metal, mix(col, metal, 0.22), uAtenuacion);
      g.t = t;
    }
  }

  // Las tiras de luz y su halo, delante de lo que tapan.
  col += tirasDeLuz(ro, rd, g.t, 1.0) * (1.0 - 0.6 * lectura);

  // Grano finísimo: evita bandas en los degradados oscuros.
  col += (hash(gl_FragCoord.xy + fract(uTiempo)) - 0.5) * 0.008;
  color = vec4(col, 1.0);
}`;
