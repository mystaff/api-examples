
import { DateTime, Duration } from 'luxon';
import util from 'util';

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
  if (value === 0) {
    return '0m';
  }
  if (value < 60) {
    return '<1m';
  }
  return parts.join(' ');
}

export function log(string, error) {
  util.inspect.defaultOptions.depth = null;
  console.log(string);
  // console.dir(string, { depth: null });
  if (error) {
    process.exit(1);
  }
}

export function dateRange(companyTimezone, range) {
  let type;
  switch (range) {
    case 'today':
    case 'this-day':
      type = 'day';
      break;
    case 'this-week':
      type = 'week';
      break;
    case 'this-month':
      type = 'month';
      break;
    default:
      type = range;
      break;
  }
  const selectedDate = DateTime.local().setZone(companyTimezone);
  const fromDate = selectedDate.startOf(type).toISO();
  const toDate = selectedDate.endOf(type).toISO();
  return { fromDate, toDate };
}
