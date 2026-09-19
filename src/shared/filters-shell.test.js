import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  chipsMarkup, createFilterShell, foldClose, foldOpen, wireFold,
} from './filters-shell.js';

// The suite runs without a DOM, so these stand up only what the shell touches:
// a class list, an inline style bag, a measured box and a listener map.

function element({ height = 40, width = 0, classes: initial = ['d-none'] } = {}) {
  const classes = new Set(initial);
  const listeners = new Map();
  return {
    innerHTML: '',
    offsetWidth: 0,
    style: {},
    attributes: {},
    classes,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
    },
    getBoundingClientRect: () => ({ height, width }),
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    fire(type, event) {
      listeners.get(type)?.(event);
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    querySelectorAll: () => [],
    querySelector: () => null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('folding', () => {
  it('opens from zero to the measured height', () => {
    const panel = element({ height: 120 });
    foldOpen(panel);

    expect(panel.classes.has('d-none')).toBe(false);
    expect(panel.classes.has('fold-opening')).toBe(true);
    expect(panel.style.height).toBe('120px');
  });

  it('closes from the measured height to zero', () => {
    const panel = element({ height: 120 });
    foldClose(panel);

    expect(panel.classes.has('fold-closing')).toBe(true);
    expect(panel.style.height).toBe('0px');
    expect(panel.style.opacity).toBe('0');
  });

  it('hides the element once the closing height transition ends', () => {
    const panel = element({ height: 120, classes: [] });
    wireFold(panel);
    foldClose(panel);

    panel.fire('transitionend', { propertyName: 'opacity' });
    expect(panel.classes.has('d-none')).toBe(false);

    panel.fire('transitionend', { propertyName: 'height' });
    expect(panel.classes.has('d-none')).toBe(true);
    expect(panel.classes.has('fold-closing')).toBe(false);
    expect(panel.style.height).toBe('');
  });
});

describe('chipsMarkup', () => {
  it('renders one chip per dimension, each with its own clear button', () => {
    const html = chipsMarkup([
      { key: 'search', label: 'Search: "dune"' },
      { key: 'users', label: 'Owners: 3' },
    ]);

    expect(html.match(/class="filter-chip"/g)).toHaveLength(2);
    expect(html).toContain('data-dim="search"');
    expect(html).toContain('data-dim="users"');
    expect(html).toContain('aria-label="Clear users"');
  });

  it('escapes a label the reader typed', () => {
    expect(chipsMarkup([{ key: 'search', label: 'Search: "<b>"' }]))
      .not.toContain('<b>');
  });
});

describe('createFilterShell', () => {
  function shellWith(snapshot, chips = []) {
    const parts = {
      'filters-panel': element(),
      'filters-toggle': element(),
      'filters-badge': element(),
      'filter-chips': element(),
    };
    const filters = {
      snapshot: () => snapshot,
      clearDimension: vi.fn(),
    };
    vi.stubGlobal('document', { getElementById: (id) => parts[id] ?? null });

    const shell = createFilterShell({
      filters,
      sections: [() => '<div id="a"></div>', (given) => `<div id="${given.search}"></div>`],
      chipsFor: () => chips,
      bindPanel: vi.fn(),
      syncPanel: vi.fn(),
    });

    return { shell, parts, filters };
  }

  it('renders every section into the panel and flags the button expanded', () => {
    const { shell, parts } = shellWith({ search: 'dune', activeCount: 1 });
    expect(shell.refresh).toBeTypeOf('function');

    parts['filters-toggle'].fire('click');

    expect(parts['filters-panel'].innerHTML).toBe('<div id="a"></div><div id="dune"></div>');
    expect(parts['filters-toggle'].getAttribute('aria-expanded')).toBe('true');
    expect(parts['filters-panel'].classes.has('d-none')).toBe(false);

    parts['filters-toggle'].fire('click');
    expect(parts['filters-toggle'].getAttribute('aria-expanded')).toBe('false');
    expect(parts['filters-panel'].classes.has('fold-closing')).toBe(true);
  });

  it('folds the chips row open with a chip per narrowed dimension', () => {
    const { shell, parts } = shellWith(
      { search: 'dune', activeCount: 2 },
      [{ key: 'search', label: 'Search: "dune"' }, { key: 'users', label: 'Owners: 3' }],
    );

    shell.refresh();

    expect(parts['filter-chips'].innerHTML.match(/class="filter-chip"/g)).toHaveLength(2);
    expect(parts['filter-chips'].classes.has('d-none')).toBe(false);
  });

  it('shows the active count on the badge and collapses it at zero', () => {
    const active = shellWith({ search: '', activeCount: 3 });
    active.shell.refresh();
    expect(active.parts['filters-badge'].textContent).toBe('3');
    expect(active.parts['filters-badge'].classes.has('is-collapsed')).toBe(false);

    const idle = shellWith({ search: '', activeCount: 0 });
    idle.shell.refresh();
    expect(idle.parts['filters-badge'].classes.has('is-collapsed')).toBe(true);
  });

  it('clears the dimension a chip close button names', () => {
    const { parts, filters } = shellWith({ search: '', activeCount: 0 });
    const chip = { dataset: { dim: 'users' } };

    parts['filter-chips'].fire('click', {
      target: { closest: () => ({ closest: () => chip }) },
    });

    expect(filters.clearDimension).toHaveBeenCalledWith('users');
  });

  it('is inert when the page carries none of the filter markup', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    const shell = createFilterShell({
      filters: { snapshot: () => ({}) },
      sections: [],
      chipsFor: () => [],
      bindPanel: () => {},
      syncPanel: () => {},
    });
    expect(() => shell.refresh()).not.toThrow();
  });
});
