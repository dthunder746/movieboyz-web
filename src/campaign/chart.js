// The profit chart. `profit-series.js` decides what to plot; this module turns
// those lines into a Chart.js instance and owns the zoom, the pan and the
// release-marker tooltip.
//
// Chart, its date adapter, Hammer and the zoom plugin are CDN globals loaded
// before the module entry, as on the old site.

import { fmt } from '../shared/format.js';
import { buildMoviePalette } from '../shared/palettes.js';
import { chartColors, currentTheme } from '../shared/theme.js';

import { buildProfitSeries } from './profit-series.js';

const MILLION = 1e6;
const MS_PER_DAY = 86400000;
const RELEASE_POINT_RADIUS = 5;
const RELEASE_POINT_HOVER = 7;

function toMillis(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).getTime();
}

// The User modes colour by User, so the same person keeps their colour whatever
// is selected. The Movie modes hand colours out by position instead: there is no
// stable per-Movie colour, and the point is to tell this handful of lines apart.
function lineColors(built, colorMap) {
  if (built.mode === 'users') return built.series.map((line) => colorMap[line.id] || '#888');
  return buildMoviePalette(built.series.length);
}

function toDataset(line, color) {
  const hasMarkers = Object.keys(line.releaseMarkers).length > 0;

  return {
    label: line.label,
    data: line.points,
    borderColor: color,
    backgroundColor: `${color}22`,
    borderWidth: 2,
    // A dot only where a Pick opened, so the line stays clean everywhere else.
    pointRadius: hasMarkers
      ? line.points.map((_, index) => (line.releaseMarkers[index] ? RELEASE_POINT_RADIUS : 0))
      : 0,
    pointHoverRadius: hasMarkers
      ? line.points.map((_, index) => (line.releaseMarkers[index] ? RELEASE_POINT_HOVER : 4))
      : 4,
    tension: 0.3,
    fill: false,
    spanGaps: false,
    _releaseMarkers: line.releaseMarkers,
  };
}

// The label on a release dot. A transient element rather than a Chart.js
// tooltip because it has to survive the pointer moving away: on a phone the
// finger is over the dot it just tapped.
function showReleaseTip(event, title) {
  const wrapper = document.getElementById('chart-wrapper');
  if (!wrapper) return;

  let tip = document.getElementById('chart-release-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chart-release-tip';
    tip.className = 'chart-release-tip';
    wrapper.appendChild(tip);
  }

  const rect = wrapper.getBoundingClientRect();
  tip.textContent = title;
  tip.style.left = `${event.clientX - rect.left}px`;
  tip.style.top = `${event.clientY - rect.top - 38}px`;
  tip.style.display = 'block';
  clearTimeout(tip._timer);
  tip._timer = setTimeout(() => { tip.style.display = 'none'; }, 3000);
}

export function buildChart(campaign, activeUserIds, activeMovieIds, colorMap) {
  document.getElementById('chart-release-tip')?.remove();

  const built = buildProfitSeries(campaign, activeUserIds, activeMovieIds);
  const colors = lineColors(built, colorMap);
  const datasets = built.series.map((line, index) => toDataset(line, colors[index]));

  const { grid, tick } = chartColors(currentTheme());
  const { initialMin, limitMin, limitMax } = built.trim;
  const zoomReset = {
    min: limitMin ? toMillis(limitMin) : undefined,
    max: limitMax ? toMillis(limitMax) : undefined,
  };

  const chart = new Chart(document.getElementById('profitChart'), {
    type: 'line',
    data: { datasets },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick(event, _elements, instance) {
        const points = instance.getElementsAtEventForMode(
          event.native, 'point', { intersect: true }, false,
        );
        if (!points.length) return;
        const [point] = points;
        const title = instance.data.datasets[point.datasetIndex]._releaseMarkers?.[point.index];
        if (title) showReleaseTip(event.native, title);
      },
      plugins: {
        legend: { labels: { color: tick, boxWidth: 12, padding: 16 } },
        tooltip: {
          // A null is a day before the line started, not a zero.
          filter: (item) => item.parsed.y !== null,
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${fmt(context.parsed.y * MILLION)}`,
          },
        },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
          pan: { enabled: true, mode: 'x' },
          limits: { x: { min: zoomReset.min, max: zoomReset.max, minRange: 7 * MS_PER_DAY } },
        },
      },
      scales: {
        x: {
          type: 'time',
          // Opens past the flat run of zeros before the first scored Pick;
          // panning back to them is still allowed by the limit above.
          min: initialMin ?? undefined,
          time: {
            tooltipFormat: 'MMM d, yyyy',
            displayFormats: { day: 'MMM d', week: 'MMM d', month: 'MMM', year: 'yyyy' },
          },
          ticks: {
            color: tick,
            maxRotation: 0,
            major: { enabled: true },
            font: (context) => (context.tick?.major ? { weight: 'bold' } : {}),
          },
          grid: { color: grid },
        },
        y: {
          ticks: { color: tick, callback: (value) => fmt(value * MILLION) },
          grid: { color: grid },
        },
      },
    },
  });

  chart._zoomReset = zoomReset;
  return chart;
}

export function applyChartTheme(chart, theme) {
  const { grid, tick } = chartColors(theme);
  chart.options.scales.x.grid.color = grid;
  chart.options.scales.x.ticks.color = tick;
  chart.options.scales.y.grid.color = grid;
  chart.options.scales.y.ticks.color = tick;
  chart.options.plugins.legend.labels.color = tick;
  chart.update();
}
