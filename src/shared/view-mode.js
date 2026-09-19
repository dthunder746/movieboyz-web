// The cards/compact/detailed switch, and where the choice is remembered.
//
// A cookie rather than localStorage, carried over from the old site so a reader
// who has already picked a view keeps it across the cutover.
//
// Page-agnostic: the switch knows the three modes and the cookie, and nothing
// about what any one mode renders. The page passes what to do on a change
// (#160).

const COOKIE = 'mb_table_mode';
const MODES = ['cards', 'compact', 'detailed'];

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value, days = 365) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

// A narrow screen opens on cards and a wide one on compact. The detailed table
// is a deliberate choice rather than a default anywhere: it is far wider than a
// phone can show.
export function initialMode() {
  const saved = readCookie(COOKIE);
  if (saved && MODES.includes(saved)) return saved;
  return window.innerWidth >= 768 ? 'compact' : 'cards';
}

export function createModeSwitcher({ initial, onChange }) {
  // The `View mode` group is part of the markup contract both pages carry: a
  // page that wants this switch renders a `[role="group"]` labelled `View mode`
  // holding a `button[data-mode]` per mode.
  const container = document.querySelector('[role="group"][aria-label="View mode"]');
  if (!container) return null;

  let current = initial;

  function paintActive() {
    for (const button of container.querySelectorAll('button[data-mode]')) {
      button.classList.toggle('active', button.dataset.mode === current);
    }
  }

  container.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    const mode = button.dataset.mode;
    if (!MODES.includes(mode) || mode === current) return;
    current = mode;
    writeCookie(COOKIE, mode);
    paintActive();
    onChange(mode);
  });

  paintActive();
  return { getMode: () => current };
}
