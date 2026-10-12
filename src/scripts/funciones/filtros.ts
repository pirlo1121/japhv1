/**
 * filtros.ts
 * Filtro del índice de proyectos. Cada tarjeta declara sus categorías en
 * data-categorias; aquí solo se decide cuáles se muestran.
 */

export function iniciarFiltros(): void {
  const grupo = document.querySelector<HTMLElement>('[data-filtros]');
  const indice = document.querySelector<HTMLElement>('[data-indice-proyectos]');
  if (!grupo || !indice) return;

  const botones = Array.from(grupo.querySelectorAll<HTMLButtonElement>('[data-filtro]'));
  const proyectos = Array.from(indice.querySelectorAll<HTMLElement>('[data-categorias]'));
  const vacio = document.querySelector<HTMLElement>('[data-vacio]');
  const anuncio = document.querySelector<HTMLElement>('[data-anuncio-filtro]');

  grupo.addEventListener('click', (evento) => {
    const boton = (evento.target as Element).closest<HTMLButtonElement>('[data-filtro]');
    if (!boton) return;

    const clave = boton.dataset.filtro;
    botones.forEach((otro) => otro.setAttribute('aria-pressed', String(otro === boton)));

    let visibles = 0;
    for (const proyecto of proyectos) {
      const categorias = (proyecto.dataset.categorias ?? '').split(' ');
      const coincide = clave === 'todo' || categorias.includes(clave ?? '');
      proyecto.hidden = !coincide;
      if (coincide) visibles += 1;
    }

    if (vacio) vacio.hidden = visibles > 0;
    // Los lectores de pantalla escuchan cuántos proyectos quedaron.
    if (anuncio) {
      anuncio.textContent = `${visibles} ${visibles === 1 ? 'proyecto' : 'proyectos'}`;
    }
  });
}
