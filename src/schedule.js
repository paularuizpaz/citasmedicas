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
  toMinutes,
  toTime
};
