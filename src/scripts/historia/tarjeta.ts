/**
 * tarjeta.ts
 * Tarjetas líquidas ([data-tarjeta-liquida]): su piel (.piel) se estira un
 * poco hacia el cursor, como metal líquido que lo siente, la esquina más
 * cercana se redondea y un reflejo recorre la superficie. Un muelle
 * subamortiguado le da el temblor del líquido al soltarla.
 *
 * Coste mínimo: el bucle solo corre mientras el puntero está cerca o el
 * muelle no se ha asentado, y solo con la tarjeta en pantalla. La caja se
 * lee en el evento (una vez por scroll o cambio de tamaño); en el fotograma
 * solo se escribe. Se deforma la piel, no la tarjeta: la tarjeta es
 * [data-liquido] y su caja debe coincidir con su líquido.
 */

/**
 * Cuánto se deforma: desplazamiento y estiramiento máximos hacia el
 * cursor, radio extra de la esquina más cercana (px) y a cuántos px fuera
 * de la caja aún lo siente.
 */
const DEFORMACION = { desplazamiento: 4, estiramiento: 0.016, esquina: 12, alcance: 70 };
/** Muelle de la deformación: rigidez (1/s²) y amortiguación relativa (<1: tiembla al soltar). */
const MUELLE = { rigidez: 140, amortiguacion: 0.42 };

interface Muelle {
  valor: number;
  velocidad: number;
}

function iniciarTarjeta(tarjeta: HTMLElement, piel: HTMLElement): () => void {
  const limpieza = new AbortController();
  const { signal } = limpieza;
  const radio = parseFloat(getComputedStyle(tarjeta).borderTopLeftRadius) || 16;
  const ejes: [Muelle, Muelle, Muelle] = [
    { valor: 0, velocidad: 0 },
    { valor: 0, velocidad: 0 },
    { valor: 0, velocidad: 0 }
  ];
  // Hacia dónde tira el cursor (x, y en -1..1 desde el centro) y con qué fuerza (0..1).
  const meta = [0, 0, 0];
  let caja: DOMRect | null = null;
  let visible = false;
  let cuadro = 0;
  let anterior = 0;

  const escribir = () => {
    const [x, y, fuerza] = ejes.map((e) => e.valor) as [number, number, number];
    const { desplazamiento, estiramiento, esquina } = DEFORMACION;
    // Cada esquina (izq-arriba, der-arriba, der-abajo, izq-abajo) se redondea si el cursor está de su lado.
    const radios = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ].map(([cx, cy]) => radio + esquina * Math.max(0, (cx! * x + cy! * y) / 2) * fuerza);
    piel.style.transform =
      `translate(${(x * desplazamiento * fuerza).toFixed(2)}px, ${(y * desplazamiento * fuerza).toFixed(2)}px) ` +
      `scale(${(1 + Math.abs(x) * estiramiento * fuerza).toFixed(4)}, ${(1 + Math.abs(y) * estiramiento * fuerza).toFixed(4)})`;
    piel.style.borderRadius = radios.map((r) => `${r.toFixed(1)}px`).join(' ');
    piel.style.setProperty('--mx', `${(50 + x * 50).toFixed(1)}%`);
    piel.style.setProperty('--my', `${(50 + y * 50).toFixed(1)}%`);
    piel.style.setProperty('--brillo', fuerza.toFixed(3));
  };

  const paso = (t: number) => {
    const dt = Math.min((t - anterior) / 1000, 1 / 30);
    anterior = t;
    const { rigidez, amortiguacion } = MUELLE;
    const friccion = 2 * Math.sqrt(rigidez) * amortiguacion;
    let quieto = true;
    ejes.forEach((e, i) => {
      const a = rigidez * ((meta[i] ?? 0) - e.valor) - friccion * e.velocidad;
      e.velocidad += a * dt;
      e.valor += e.velocidad * dt;
      if (Math.abs(e.velocidad) > 1e-3 || Math.abs((meta[i] ?? 0) - e.valor) > 1e-3) quieto = false;
    });
    escribir();
    cuadro = quieto ? 0 : requestAnimationFrame(paso);
  };

  const animar = () => {
    if (cuadro) return;
    anterior = performance.now();
    cuadro = requestAnimationFrame(paso);
  };

  const soltar = () => {
    if (meta[2] === 0) return;
    meta[2] = 0;
    animar();
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (!visible) return;
      caja ??= tarjeta.getBoundingClientRect();
      const { alcance } = DEFORMACION;
      const fuera = Math.max(
        caja.left - e.clientX,
        e.clientX - caja.right,
        caja.top - e.clientY,
        e.clientY - caja.bottom,
        0
      );
      if (fuera >= alcance) return soltar();
      const acotar = (v: number) => Math.min(Math.max(v, -1.2), 1.2);
      meta[0] = acotar(((e.clientX - caja.left) / caja.width) * 2 - 1);
      meta[1] = acotar(((e.clientY - caja.top) / caja.height) * 2 - 1);
      meta[2] = 1 - fuera / alcance;
      animar();
    },
    { passive: true, signal }
  );
  // La caja cambia al desplazarse o al cambiar el tamaño: se vuelve a leer en el siguiente evento.
  const olvidar = () => (caja = null);
  window.addEventListener('scroll', olvidar, { passive: true, signal });
  window.addEventListener('resize', olvidar, { passive: true, signal });
  document.addEventListener('pointerleave', soltar, { signal });

  const vigia = new IntersectionObserver(([entrada]) => {
    visible = entrada?.isIntersecting ?? false;
    if (!visible) soltar();
  });
  vigia.observe(tarjeta);

  return () => {
    limpieza.abort();
    vigia.disconnect();
    cancelAnimationFrame(cuadro);
    for (const propiedad of ['transform', 'border-radius', '--mx', '--my', '--brillo']) {
      piel.style.removeProperty(propiedad);
    }
  };
}

/** Arranca todas las tarjetas líquidas de la página. Solo con puntero fino y movimiento. */
export function iniciarTarjetas(): () => void {
  const detener = [...document.querySelectorAll<HTMLElement>('[data-tarjeta-liquida]')].flatMap(
    (tarjeta) => {
      const piel = tarjeta.querySelector<HTMLElement>('.piel');
      return piel ? [iniciarTarjeta(tarjeta, piel)] : [];
    }
  );
  return () => detener.forEach((d) => d());
}
