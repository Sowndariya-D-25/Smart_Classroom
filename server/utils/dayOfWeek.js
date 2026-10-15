const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// The Timetable schema only stores Monday–Saturday (see models/Timetable.js),
// so "today" on a Sunday simply matches no timetable rows — which is
// correct (no seeded classes run on Sunday) rather than an error case.
export const currentDayOfWeek = (date = new Date()) => DAYS[date.getDay()]

export default currentDayOfWeek
