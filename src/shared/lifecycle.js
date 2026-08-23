// What a Campaign's Lifecycle state is called, and how it is toned, wherever a
// badge shows one. The navigation badges every year it lists and the Movie page
// badges every Campaign holding the Movie, so the labels live in one place.
//
// A state this build has not heard of is shown as the artifact wrote it. The
// Manifest is read tolerantly and a Campaign is not worth hiding over a word
// this deploy predates.

const STATE_LABELS = {
  drafting: 'Drafting',
  active: 'Active',
  final: 'Final',
};

// Bootstrap classes rather than facts, which is why the renderers read them
// here rather than off a view model.
const STATE_TONES = {
  drafting: 'text-bg-secondary',
  active: 'text-bg-success',
  final: 'text-bg-primary',
};

export function stateLabel(state) {
  return STATE_LABELS[state] ?? state;
}

export function stateTone(state) {
  return STATE_TONES[state] ?? 'text-bg-secondary';
}
