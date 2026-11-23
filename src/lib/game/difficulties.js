export const DIFFICULTIES = Object.freeze([
  { id: 'medium', label: 'Moyen', simulations: 3 },
  { id: 'challenging', label: 'Coriace', simulations: 10 },
  { id: 'hard', label: 'Difficile', simulations: 100 },
]);

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
