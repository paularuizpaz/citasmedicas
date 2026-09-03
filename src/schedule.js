function pad(value) {
  return String(value).padStart(2, '0');
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${pad(hours)}:${pad(mins)}`;
}

function calculateEndTime(startTime, durationMinutes) {
  const total = toMinutes(startTime) + durationMinutes;
  return toTime(total);
}

function parseAvailability(availability = '') {
  const matches = [...String(availability).matchAll(/(\d{1,2})(?::(\d{2}))?\s*(?:a|-)\s*(\d{1,2})(?::(\d{2}))?/gi)];
  const range = matches[0];
  if (!range) {
    return { startHour: 9, endHour: 17, lunchStart: 13, lunchEnd: 14, weekdaysOnly: false };
  }

  const startHour = Number(range[1]);
  const endHour = Number(range[3]);
  if (startHour < 0 || startHour > 23 || endHour <= startHour || endHour > 24) {
    return { startHour: 9, endHour: 17, lunchStart: 13, lunchEnd: 14, weekdaysOnly: false };
  }

  return {
    startHour,
    endHour,
    lunchStart: 13,
    lunchEnd: 14,
    weekdaysOnly: /lunes\s+a\s+viernes/i.test(String(availability))
  };
}

function isAvailableDate(date, availability) {
  if (!availability.weekdaysOnly) return true;
  const day = new Date(`${date}T00:00:00`).getDay();
  return day >= 1 && day <= 5;
}

function generateDoctorSlots({ startHour, endHour, duration, lunchStart, lunchEnd, existing = [] }) {
  const slots = [];
  const existingSet = new Set(existing);
  const appointmentDuration = Number(duration);

  for (let minute = startHour * 60; minute < endHour * 60; minute += appointmentDuration) {
    const current = toTime(minute);
    const lunchStartMinutes = lunchStart * 60;
    const lunchEndMinutes = lunchEnd * 60;

    if (minute >= lunchStartMinutes && minute < lunchEndMinutes) {
      continue;
    }

    if (existingSet.has(current)) {
      continue;
    }

    slots.push(current);
  }

  return slots;
}

module.exports = {
  generateDoctorSlots,
  calculateEndTime,
  parseAvailability,
  isAvailableDate,
  toMinutes,
  toTime
};
