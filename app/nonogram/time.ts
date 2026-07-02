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

/** Returns the UTC Date corresponding to midnight Mountain Time on the given MST date string. */
export function getMSTMidnight(dateStr: string): Date {
  // Feed noon UTC into Intl to detect the MST hour (avoids DST edge cases at midnight itself)
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const mstNoonHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', hour12: false }).format(noon)
  );
  // noon UTC = mstNoonHour local  →  offset = mstNoonHour - 12  →  MST midnight in UTC = (12 - mstNoonHour)h
  const utcOffsetHours = 12 - mstNoonHour;
  return new Date(`${dateStr}T${String(utcOffsetHours).padStart(2, '0')}:00:00.000Z`);
}
