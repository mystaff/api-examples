
import chalk from 'chalk';
import { DateTime, Duration } from 'luxon';

// convert seconds to duration
export function humanizeDuration(value) {
  const units = ['hour', 'minute'];
  const unitsStrings = ['h', 'm'];
  let dur = (value instanceof Duration ? value : Duration.fromMillis(value * 1000)).normalize();
  const parts = [];
  units.forEach((unit, index) => {
    const dd = Math.floor(dur.as(unit));
    dur = dur.minus({ [unit]: dd });
    if (dd > 0) {
      parts.push(`${dd}${unitsStrings[index]}`);
    }
    return false;
  });
  return parts.join(' ');
}

export function log(string, color = null) {
  console.log(color ? chalk.keyword(color)(string) : string);
}

export function dateRange(companyTimezone, range) {
  const selectedDate = DateTime.local().setZone(companyTimezone);
  const fromDate = selectedDate.startOf(range).toISO();
  const toDate = selectedDate.endOf(range).toISO();
  return { fromDate, toDate };
}
