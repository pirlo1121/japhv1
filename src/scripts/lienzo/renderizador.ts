/**
 * renderizador.ts
 * Contexto WebGL2, programa y uniforms. No decide cuándo dibujar (eso es
 * del bucle) ni qué se ve (eso es de la escultura y la cámara).
 * Funciona igual en la página o dentro de un worker con OffscreenCanvas
 * (ver pintor.ts): no toca el DOM.
 */
import type { Camara } from './camara';
import { FRAGMENTO, MAX_ZONAS_DE_LECTURA, VERTICE } from './sombreador';

export interface EstadoDeEscena {
  tiempo: number;
  /** 1 = detalle completo; 0 = versión ligera para equipos modestos. */
  detalle: number;
  camara: Camara;
  /** Tiempo del movimiento interno: se integra con el flujo para que cambiar de velocidad no dé saltos. */
  fase: number;
  atenuacion: number;
  red: number;
  grietas: number;
  /** Piezas del robot ya colocadas (x, y, z, radio), su pose, viaje y estela (escultura.ts). */
  piezas: Float32Array;
  /** Rectángulos en coordenadas uv (x0, y0, x1, y1; y hacia arriba). */
  zonas: Float32Array;
  numZonas: number;
}

const UNIFORMS = [
  'uRes',
  'uTiempo',
  'uDetalle',
  'uCamara',
  'uObjetivo',
  'uDesplazamiento',
  'uFase',
  'uAtenuacion',
  'uRed',
  'uGrietas',
  'uPiezas',
  'uZonas',
  'uNumZonas'
] as const;

type Uniform = (typeof UNIFORMS)[number];

/** Solo crea y manda a compilar: preguntar si terminó bloquearía el hilo principal. */
function compilar(gl: WebGL2RenderingContext, tipo: number, fuente: string): WebGLShader {
  const shader = gl.createShader(tipo);
  if (!shader) throw new Error('No se pudo crear el shader');
  gl.shaderSource(shader, fuente);
  gl.compileShader(shader);
  return shader;
}

export class Renderizador {
  private readonly gl: WebGL2RenderingContext;
  private readonly programa: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly u = {} as Record<Uniform, WebGLUniformLocation | null>;
  private readonly shaders: WebGLShader[];
  /** Extensión que permite saber, sin esperar, si el programa ya está listo. */
  private readonly paralela: unknown;
  enlazado = false;

  constructor(readonly lienzo: HTMLCanvasElement | OffscreenCanvas) {
    const gl = lienzo.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;

    // La compilación y el enlace siguen en segundo plano; ver compilado() y enlazar().
    this.paralela = gl.getExtension('KHR_parallel_shader_compile');
    const programa = gl.createProgram();
    this.shaders = [
      compilar(gl, gl.VERTEX_SHADER, VERTICE),
      compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTO)
    ];
    for (const shader of this.shaders) gl.attachShader(programa, shader);
    gl.linkProgram(programa);
    this.programa = programa;
    this.vao = gl.createVertexArray();
  }

  /** ¿Terminó de compilar? Sin la extensión no hay forma de saberlo sin esperar: true. */
  compilado(): boolean {
    if (!this.paralela) return true;
    const COMPLETION_STATUS_KHR = 0x91b1;
    return this.gl.getProgramParameter(this.programa, COMPLETION_STATUS_KHR) === true;
  }

  /** Comprueba el resultado (ya sin esperas) y localiza los uniforms. */
  enlazar(): void {
    const { gl } = this;
    if (!gl.getProgramParameter(this.programa, gl.LINK_STATUS)) {
      const registro = this.shaders.map((s) => gl.getShaderInfoLog(s)).join('\n');
      throw new Error(`${gl.getProgramInfoLog(this.programa) ?? ''}\n${registro}`.trim());
    }
    for (const nombre of UNIFORMS) this.u[nombre] = gl.getUniformLocation(this.programa, nombre);
    this.enlazado = true;
  }

  /** Espera a que la GPU termine: solo se usa dentro del worker, donde no bloquea la página. */
  terminar(): void {
    this.gl.finish();
  }

  /** Solo cambia con el tamaño. */
  redimensionar(anchoPx: number, altoPx: number): void {
    const { gl, u } = this;
    this.lienzo.width = anchoPx;
    this.lienzo.height = altoPx;
    if (!this.enlazado) return;
    gl.useProgram(this.programa);
    gl.viewport(0, 0, anchoPx, altoPx);
    gl.uniform2f(u.uRes, anchoPx, altoPx);
  }

  dibujar(estado: EstadoDeEscena): void {
    const { gl, u } = this;
    const { camara } = estado;
    gl.useProgram(this.programa);
    gl.viewport(0, 0, this.lienzo.width, this.lienzo.height);
    gl.uniform2f(u.uRes, this.lienzo.width, this.lienzo.height);
    gl.uniform1f(u.uTiempo, estado.tiempo);
    gl.uniform1f(u.uDetalle, estado.detalle);
    gl.uniform3f(u.uCamara, ...camara.posicion);
    gl.uniform3f(u.uObjetivo, ...camara.objetivo);
    gl.uniform2f(u.uDesplazamiento, ...camara.desplazamiento);
    gl.uniform1f(u.uFase, estado.fase);
    gl.uniform1f(u.uAtenuacion, estado.atenuacion);
    gl.uniform1f(u.uRed, estado.red);
    gl.uniform1f(u.uGrietas, estado.grietas);
    gl.uniform4fv(u.uPiezas, estado.piezas);
    gl.uniform4fv(u.uZonas, estado.zonas);
    gl.uniform1i(u.uNumZonas, Math.min(estado.numZonas, MAX_ZONAS_DE_LECTURA));
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  liberar(): void {
    this.gl.deleteProgram(this.programa);
    this.gl.deleteVertexArray(this.vao);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
