const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDoctorSlots, calculateEndTime } = require('../src/schedule');

test('generateDoctorSlots produce times between morning and afternoon windows', () => {
  const slots = generateDoctorSlots({
    startHour: 9,
    endHour: 17,
    duration: 30,
    lunchStart: 13,
    lunchEnd: 14,
    existing: ['09:30', '10:00', '15:00']
  });

  assert.ok(slots.includes('09:00'));
  assert.ok(slots.includes('09:30') === false);
  assert.ok(slots.includes('13:00') === false);
  assert.ok(slots.includes('16:30'));
});

test('calculateEndTime adds duration correctly', () => {
  assert.equal(calculateEndTime('09:30', 30), '10:00');
  assert.equal(calculateEndTime('16:30', 60), '17:30');
});
