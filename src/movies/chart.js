// The Movies chart: cumulative gross against days since release, so films from
// different years overlay on one axis (#62). Wiring, untested by the site's
// convention: `gross-series.js` decides what to plot and is tested next door.
//
// `campaign/chart.js` is the model for the theming and the teardown. What
// differs is the axis: a Campaign plots real dates, and this plots an elapsed
// count, so the scale is linear rather than time and the date adapter is not
// involved. Chart, Hammer and the zoom plugin are CDN globals.

import { fmt } from '../shared/format.js';
import { buildMoviePalette } from '../shared/palettes.js';
import { chartColors, currentTheme } from '../shared/theme.js';

const MILLION = 1e6;
const MIN_ZOOM_DAYS = 7;

function toDataset(line, color) {
  return {
    label: line.label,
    data: line.points,
    borderColor: color,
    backgroundColor: `${color}22`,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.3,
    fill: false,
    spanGaps: false,
  };
}

// `built` is what `buildGrossSeries` returned. A blank one never gets here: the
// page shows its own message rather than an empty canvas with two axes on it.
export function buildMoviesChart(built) {
  const colors = buildMoviePalette(built.series.length);
  const datasets = built.series.map((line, index) => toDataset(line, colors[index]));
  const { grid, tick } = chartColors(currentTheme());

  const chart = new Chart(document.getElementById('grossChart'), {
    type: 'line',
    data: { datasets },
    options: {
      maintainAspectRatio: false,
      // Every line is on the same integer-day axis, so hovering a day lines the
      // whole comparison up rather than answering about one film.
      interaction: { mode: 'x', intersect: false },
      plugins: {
        legend: { labels: { color: tick, boxWidth: 12, padding: 16 } },
        tooltip: {
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          callbacks: {
            title: (items) => `Day ${items[0].parsed.x}`,
            label: (context) => ` ${context.dataset.label}: ${fmt(context.parsed.y * MILLION)}`,
          },
        },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
          pan: { enabled: true, mode: 'x' },
          limits: { x: { min: 0, max: built.maxDay, minRange: MIN_ZOOM_DAYS } },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: built.maxDay,
          title: { display: true, text: 'Days since release', color: tick },
          ticks: { color: tick, maxRotation: 0, precision: 0 },
          grid: { color: grid },
        },
        y: {
          ticks: { color: tick, callback: (value) => fmt(value * MILLION) },
          grid: { color: grid },
        },
      },
    },
  });

  chart._zoomReset = { min: 0, max: built.maxDay };
  return chart;
}

export function applyChartTheme(chart, theme) {
  const { grid, tick } = chartColors(theme);
  chart.options.scales.x.grid.color = grid;
  chart.options.scales.x.ticks.color = tick;
  chart.options.scales.x.title.color = tick;
  chart.options.scales.y.grid.color = grid;
  chart.options.scales.y.ticks.color = tick;
  chart.options.plugins.legend.labels.color = tick;
  chart.update();
}
