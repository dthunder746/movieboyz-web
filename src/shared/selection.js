// The set of Movies plotted on a chart. Several surfaces can change it (a
// table, the Campaign page's cards, a clear button), so it is held here and
// they all read back from it rather than each keeping a copy that can drift.
//
// Shared rather than the Campaign's own, because plotting a handful of Movies
// is what both page groups' charts do and neither the Movies lookup nor the
// Campaign owns the idea (#59, decision 24).
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
