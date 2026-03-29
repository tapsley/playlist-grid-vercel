export function getMSTDateString(d?: Date) {
  try {
    const date = d ?? new Date();
    // Use America/Denver so the puzzle flips at midnight Mountain Time (accounts for DST)
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(date);
  } catch {
    // Fallback to UTC date if Intl fails
    return (d ?? new Date()).toISOString().slice(0, 10);
  }
}
