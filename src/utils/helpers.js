export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createTeamTemplate(roles) {
  return Object.fromEntries(roles.map((role) => [role, null]));
}

export function isGameComplete(p1Team, p2Team, roles) {
  return roles.every((r) => p1Team[r] !== null && p2Team[r] !== null);
}