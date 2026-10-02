// Fullscreen image viewer for project pages. Keyboard: arrows and Escape.
(() => {
  const dlg = document.querySelector('.viewer');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const figs = [...document.querySelectorAll('.work-fig')];
  const img = dlg.querySelector('img');
  const cap = dlg.querySelector('.viewer-cap');
  let i = 0;
  const show = n => {
    i = (n + figs.length) % figs.length;
    const src = figs[i].querySelector('img');
    img.src = src.dataset.full || src.currentSrc;
    img.alt = src.alt;
    cap.textContent = figs[i].querySelector('figcaption')?.textContent || '';
  };
  figs.forEach((f, n) => f.querySelector('.zoom').addEventListener('click', () => { show(n); dlg.showModal(); }));
  dlg.querySelector('.v-close').addEventListener('click', () => dlg.close());
  dlg.querySelector('.v-prev').addEventListener('click', () => show(i - 1));
  dlg.querySelector('.v-next').addEventListener('click', () => show(i + 1));
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
  let x0 = null;
  dlg.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
