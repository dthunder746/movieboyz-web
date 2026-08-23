// One Movie's box office: the cumulative curve as a line and the week's takings
// as bars underneath it. Wiring, untested by the site's convention;
// `series.js` decides what is plotted and is tested next door.
//
// Two axes because the two series are different sizes by an order of magnitude:
// a run's total climbs past its biggest week within a fortnight, and sharing an
// axis would flatten the bars into the baseline. The left axis is the curve and
// the right is the week, each labelled so neither is read off the wrong one.
//
// The x axis is real dates rather than the lookup page's days-since-release
// count, which is what the page needs the `chartjs-adapter-date-fns` CDN tag
// for. There is one Movie here, so there is nothing to overlay and the
// calendar the reader lived through is the more useful axis.
//
// Chart, its date adapter, Hammer and the zoom plugin are CDN globals.

import { fmt } from '../../shared/format.js';
import { chartColors, currentTheme } from '../../shared/theme.js';

const MILLION = 1e6;
const MS_PER_DAY = 86400000;

const CURVE_COLOR = '#1982c4';
const WEEK_COLOR = '#ff924c';

function toMillis(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).getTime();
}

// The bars come first so the line draws over them rather than under.
function datasets(built) {
  return [
    {
      type: 'bar',
      label: 'Weekly takings',
      data: built.weekly.map((bar) => ({ x: toMillis(bar.x), y: bar.y, week: bar.label })),
      backgroundColor: `${WEEK_COLOR}66`,
      borderColor: WEEK_COLOR,
      borderWidth: 1,
      yAxisID: 'y1',
      order: 2,
    },
    {
      type: 'line',
      label: 'Cumulative gross',
      data: built.cumulative.map((point) => ({ x: toMillis(point.x), y: point.y })),
      borderColor: CURVE_COLOR,
      backgroundColor: `${CURVE_COLOR}22`,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
      yAxisID: 'y',
      order: 1,
    },
  ];
}

// Where the plot opens and how far it pans: the whole run, end to end. Unlike
// the Campaign chart there is no flat lead-in to skip, because `series.js` has
// already cut the pre-release padding off both series.
function bounds(built) {
  const dates = [
    ...built.cumulative.map((point) => point.x),
    ...built.weekly.map((bar) => bar.x),
  ].sort();

  return dates.length
    ? { min: toMillis(dates[0]), max: toMillis(dates[dates.length - 1]) }
    : { min: undefined, max: undefined };
}

// `built` is what `buildMovieSeries` returned. A blank one never gets here: the
// page shows its own sentence rather than an empty canvas with three axes on
// it.
export function buildMovieChart(built) {
  const { grid, tick } = chartColors(currentTheme());
  const zoomReset = bounds(built);

  const chart = new Chart(document.getElementById('movieChart'), {
    // Bars are the base and the curve declares itself a line over them, which
    // is how Chart.js mixes two types in one instance.
    type: 'bar',
    data: { datasets: datasets(built) },
    options: {
      maintainAspectRatio: false,
      // By x position rather than by index: the two series are on different
      // days and of different lengths, so pairing them by index would line a
      // day of the curve up against an unrelated week's bar.
      interaction: { mode: 'x', intersect: false },
      plugins: {
        legend: { labels: { color: tick, boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            // A bar is one week's takings and sits on that week's Thursday, so
            // the tooltip names the span rather than the day it is drawn at.
            label: (context) => {
              const week = context.raw?.week;
              const value = fmt(context.parsed.y * MILLION);
              return week
                ? ` ${context.dataset.label} (${week}): ${value}`
                : ` ${context.dataset.label}: ${value}`;
            },
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
          position: 'left',
          title: { display: true, text: 'Cumulative', color: tick },
          ticks: { color: tick, callback: (value) => fmt(value * MILLION) },
          grid: { color: grid },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Weekly', color: tick },
          ticks: { color: tick, callback: (value) => fmt(value * MILLION) },
          // One grid is enough. A second set of lines at different heights
          // reads as noise rather than as a second axis.
          grid: { drawOnChartArea: false },
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
  chart.options.scales.y.title.color = tick;
  chart.options.scales.y1.ticks.color = tick;
  chart.options.scales.y1.title.color = tick;
  chart.options.plugins.legend.labels.color = tick;
  chart.update();
}
