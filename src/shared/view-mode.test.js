import { afterEach, describe, expect, it, vi } from 'vitest';

import { createModeSwitcher, initialMode } from './view-mode.js';

// The suite runs without a DOM, so each test stands up only the handful of
// members this module touches: `document.cookie`, `document.querySelector`, and
// `window.innerWidth`.

function stubDocument({ cookie = '', container = null } = {}) {
  const jar = { value: cookie };
  const doc = {
    get cookie() { return jar.value; },
    set cookie(written) { jar.written = written; jar.value = written.split(';')[0]; },
    querySelector: () => container,
  };
  vi.stubGlobal('document', doc);
  return jar;
}

function fakeButton(mode) {
  return {
    dataset: { mode },
    classes: new Set(),
    classList: {
      toggle(name, on) {
        if (on) this.owner.classes.add(name);
        else this.owner.classes.delete(name);
      },
    },
  };
}

function fakeGroup(modes) {
  const buttons = modes.map((mode) => {
    const button = fakeButton(mode);
    button.classList.owner = button;
    return button;
  });
  const group = {
    buttons,
    querySelectorAll: () => buttons,
    addEventListener(type, handler) { group.handler = handler; },
    click(mode) {
      const button = buttons.find((candidate) => candidate.dataset.mode === mode);
      group.handler({ target: { closest: () => button ?? null } });
    },
  };
  return group;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initialMode', () => {
  it('takes a remembered mode from the cookie', () => {
    stubDocument({ cookie: 'mb_table_mode=detailed' });
    vi.stubGlobal('window', { innerWidth: 320 });
    expect(initialMode()).toBe('detailed');
  });

  it('ignores a cookie naming no mode', () => {
    stubDocument({ cookie: 'mb_table_mode=sideways' });
    vi.stubGlobal('window', { innerWidth: 1200 });
    expect(initialMode()).toBe('compact');
  });

  it('opens on compact at 768px and wider, cards below it', () => {
    stubDocument();
    vi.stubGlobal('window', { innerWidth: 768 });
    expect(initialMode()).toBe('compact');

    vi.stubGlobal('window', { innerWidth: 767 });
    expect(initialMode()).toBe('cards');
  });
});

describe('createModeSwitcher', () => {
  it('remembers the pick under the mb_table_mode cookie and reports it', () => {
    const group = fakeGroup(['cards', 'compact', 'detailed']);
    const jar = stubDocument({ container: group });
    const onChange = vi.fn();

    const switcher = createModeSwitcher({ initial: 'compact', onChange });
    group.click('cards');

    expect(jar.written).toContain('mb_table_mode=cards');
    expect(jar.written).toContain('path=/');
    expect(onChange).toHaveBeenCalledWith('cards');
    expect(switcher.getMode()).toBe('cards');
  });

  it('paints the active button and leaves the others alone', () => {
    const group = fakeGroup(['cards', 'compact', 'detailed']);
    stubDocument({ container: group });

    createModeSwitcher({ initial: 'compact', onChange: () => {} });

    expect(group.buttons.map((button) => button.classes.has('active')))
      .toEqual([false, true, false]);
  });

  it('does nothing when the mode clicked is the one already shown', () => {
    const group = fakeGroup(['cards', 'compact', 'detailed']);
    const jar = stubDocument({ container: group });
    const onChange = vi.fn();

    createModeSwitcher({ initial: 'compact', onChange });
    group.click('compact');

    expect(onChange).not.toHaveBeenCalled();
    expect(jar.written).toBeUndefined();
  });

  it('returns null when the page carries no View mode group', () => {
    stubDocument({ container: null });
    expect(createModeSwitcher({ initial: 'cards', onChange: () => {} })).toBeNull();
  });
});
