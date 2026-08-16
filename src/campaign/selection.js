// The set of Movies plotted on the chart. Three surfaces can change it (the
// table, the cards and the toolbar's clear button), so it is held here and they
// all read back from it rather than each keeping a copy that can drift.
//
// Every notification tears down and rebuilds the chart, so an operation that
// changes nothing stays silent.

export function createSelection(onChange) {
  let ids = new Set();

  const announce = () => onChange([...ids]);

  return {
    has: (id) => ids.has(id),
    toArray: () => [...ids],
    size: () => ids.size,

    add(id) {
      if (ids.has(id)) return;
      ids.add(id);
      announce();
    },

    remove(id) {
      if (!ids.has(id)) return;
      ids.delete(id);
      announce();
    },

    toggle(id) {
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      announce();
    },

    clear() {
      if (ids.size === 0) return;
      ids.clear();
      announce();
    },

    set(next) {
      ids = new Set(next);
      announce();
    },
  };
}
