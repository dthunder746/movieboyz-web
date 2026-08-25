// PROTOTYPE — throwaway. The floating variant switcher.
//
// Deliberately unlike anything else on the page, so nothing here is mistaken
// for the design being judged. It writes the variant into the URL so a chosen
// one is shareable and survives a reload.
//
// It never ships: this whole directory is a prototype route that is not a build
// entry in `vite.config.js`, so it exists in `npm run dev` and nowhere else.
//
// Mounted once. It asks for the current variant rather than closing over one,
// because the page re-renders in place and a remount would stack up keyboard
// listeners.

export function mountSwitcher({ keys, names, getCurrent, onChange }) {
  const bar = document.createElement('div');
  bar.className = 'proto-switcher';
  bar.innerHTML = `
    <button type="button" class="proto-switcher-arrow" data-step="-1" aria-label="Previous variant">‹</button>
    <span class="proto-switcher-label"></span>
    <button type="button" class="proto-switcher-arrow" data-step="1" aria-label="Next variant">›</button>`;
  document.body.append(bar);

  const label = bar.querySelector('.proto-switcher-label');

  const paint = () => {
    const key = getCurrent();
    label.textContent = `${key} — ${names[key]}`;
  };

  const step = (delta) => {
    const index = Math.max(0, keys.indexOf(getCurrent()));
    onChange(keys[(index + delta + keys.length) % keys.length]);
    paint();
  };

  for (const button of bar.querySelectorAll('.proto-switcher-arrow')) {
    button.addEventListener('click', () => step(Number(button.dataset.step)));
  }

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target?.matches?.('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  });

  paint();
}
