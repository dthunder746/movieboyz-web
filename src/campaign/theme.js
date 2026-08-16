// The light/dark switch. Bootstrap reads `data-bs-theme` off the root element,
// so most of the page follows it for free. The chart and the table do not:
// Chart.js bakes its colours into the instance and Tabulator into rendered
// cells, so both need telling.

const STORAGE_KEY = 'mbTheme';

export function savedTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'dark';
}

export function chartColors(theme) {
  return {
    grid: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    tick: theme === 'dark' ? '#aaa' : '#555',
  };
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-bs-theme') || 'dark';
}

export function createThemeSwitch(onChange) {
  const input = document.getElementById('themeSwitch');
  if (!input) return;

  input.checked = savedTheme() === 'light';

  input.addEventListener('change', () => {
    const theme = input.checked ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    onChange(theme);
  });
}
