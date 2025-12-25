"use strict";
"use server";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/lib/prisma.ts
var import_client = require("@prisma/client");
var prismaClientSingleton = () => {
  return new import_client.PrismaClient();
};
var prisma = globalThis.prisma ?? prismaClientSingleton();
var prisma_default = prisma;
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

// node_modules/date-fns/toDate.mjs
function toDate(argument) {
  const argStr = Object.prototype.toString.call(argument);
  if (argument instanceof Date || typeof argument === "object" && argStr === "[object Date]") {
    return new argument.constructor(+argument);
  } else if (typeof argument === "number" || argStr === "[object Number]" || typeof argument === "string" || argStr === "[object String]") {
    return new Date(argument);
  } else {
    return /* @__PURE__ */ new Date(NaN);
  }
}

// node_modules/date-fns/constructFrom.mjs
function constructFrom(date, value) {
  if (date instanceof Date) {
    return new date.constructor(value);
  } else {
    return new Date(value);
  }
}

// node_modules/date-fns/addDays.mjs
function addDays(date, amount) {
  const _date = toDate(date);
  if (isNaN(amount)) return constructFrom(date, NaN);
  if (!amount) {
    return _date;
  }
  _date.setDate(_date.getDate() + amount);
  return _date;
}

// node_modules/date-fns/constants.mjs
var daysInYear = 365.2425;
var maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
var minTime = -maxTime;
var millisecondsInWeek = 6048e5;
var millisecondsInDay = 864e5;
var secondsInHour = 3600;
var secondsInDay = secondsInHour * 24;
var secondsInWeek = secondsInDay * 7;
var secondsInYear = secondsInDay * daysInYear;
var secondsInMonth = secondsInYear / 12;
var secondsInQuarter = secondsInMonth * 3;

// node_modules/date-fns/_lib/defaultOptions.mjs
var defaultOptions = {};
function getDefaultOptions() {
  return defaultOptions;
}

// node_modules/date-fns/startOfWeek.mjs
function startOfWeek(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const _date = toDate(date);
  const day = _date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  _date.setDate(_date.getDate() - diff);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// node_modules/date-fns/startOfISOWeek.mjs
function startOfISOWeek(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

// node_modules/date-fns/getISOWeekYear.mjs
function getISOWeekYear(date) {
  const _date = toDate(date);
  const year = _date.getFullYear();
  const fourthOfJanuaryOfNextYear = constructFrom(date, 0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
  const fourthOfJanuaryOfThisYear = constructFrom(date, 0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}

// node_modules/date-fns/startOfDay.mjs
function startOfDay(date) {
  const _date = toDate(date);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.mjs
function getTimezoneOffsetInMilliseconds(date) {
  const _date = toDate(date);
  const utcDate = new Date(
    Date.UTC(
      _date.getFullYear(),
      _date.getMonth(),
      _date.getDate(),
      _date.getHours(),
      _date.getMinutes(),
      _date.getSeconds(),
      _date.getMilliseconds()
    )
  );
  utcDate.setUTCFullYear(_date.getFullYear());
  return +date - +utcDate;
}

// node_modules/date-fns/differenceInCalendarDays.mjs
function differenceInCalendarDays(dateLeft, dateRight) {
  const startOfDayLeft = startOfDay(dateLeft);
  const startOfDayRight = startOfDay(dateRight);
  const timestampLeft = +startOfDayLeft - getTimezoneOffsetInMilliseconds(startOfDayLeft);
  const timestampRight = +startOfDayRight - getTimezoneOffsetInMilliseconds(startOfDayRight);
  return Math.round((timestampLeft - timestampRight) / millisecondsInDay);
}

// node_modules/date-fns/startOfISOWeekYear.mjs
function startOfISOWeekYear(date) {
  const year = getISOWeekYear(date);
  const fourthOfJanuary = constructFrom(date, 0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  return startOfISOWeek(fourthOfJanuary);
}

// node_modules/date-fns/isDate.mjs
function isDate(value) {
  return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}

// node_modules/date-fns/isValid.mjs
function isValid(date) {
  if (!isDate(date) && typeof date !== "number") {
    return false;
  }
  const _date = toDate(date);
  return !isNaN(Number(_date));
}

// node_modules/date-fns/differenceInDays.mjs
function differenceInDays(dateLeft, dateRight) {
  const _dateLeft = toDate(dateLeft);
  const _dateRight = toDate(dateRight);
  const sign = compareLocalAsc(_dateLeft, _dateRight);
  const difference = Math.abs(differenceInCalendarDays(_dateLeft, _dateRight));
  _dateLeft.setDate(_dateLeft.getDate() - sign * difference);
  const isLastDayNotFull = Number(
    compareLocalAsc(_dateLeft, _dateRight) === -sign
  );
  const result = sign * (difference - isLastDayNotFull);
  return result === 0 ? 0 : result;
}
function compareLocalAsc(dateLeft, dateRight) {
  const diff = dateLeft.getFullYear() - dateRight.getFullYear() || dateLeft.getMonth() - dateRight.getMonth() || dateLeft.getDate() - dateRight.getDate() || dateLeft.getHours() - dateRight.getHours() || dateLeft.getMinutes() - dateRight.getMinutes() || dateLeft.getSeconds() - dateRight.getSeconds() || dateLeft.getMilliseconds() - dateRight.getMilliseconds();
  if (diff < 0) {
    return -1;
  } else if (diff > 0) {
    return 1;
  } else {
    return diff;
  }
}

// node_modules/date-fns/startOfYear.mjs
function startOfYear(date) {
  const cleanDate = toDate(date);
  const _date = constructFrom(date, 0);
  _date.setFullYear(cleanDate.getFullYear(), 0, 1);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// node_modules/date-fns/locale/en-US/_lib/formatDistance.mjs
var formatDistanceLocale = {
  lessThanXSeconds: {
    one: "less than a second",
    other: "less than {{count}} seconds"
  },
  xSeconds: {
    one: "1 second",
    other: "{{count}} seconds"
  },
  halfAMinute: "half a minute",
  lessThanXMinutes: {
    one: "less than a minute",
    other: "less than {{count}} minutes"
  },
  xMinutes: {
    one: "1 minute",
    other: "{{count}} minutes"
  },
  aboutXHours: {
    one: "about 1 hour",
    other: "about {{count}} hours"
  },
  xHours: {
    one: "1 hour",
    other: "{{count}} hours"
  },
  xDays: {
    one: "1 day",
    other: "{{count}} days"
  },
  aboutXWeeks: {
    one: "about 1 week",
    other: "about {{count}} weeks"
  },
  xWeeks: {
    one: "1 week",
    other: "{{count}} weeks"
  },
  aboutXMonths: {
    one: "about 1 month",
    other: "about {{count}} months"
  },
  xMonths: {
    one: "1 month",
    other: "{{count}} months"
  },
  aboutXYears: {
    one: "about 1 year",
    other: "about {{count}} years"
  },
  xYears: {
    one: "1 year",
    other: "{{count}} years"
  },
  overXYears: {
    one: "over 1 year",
    other: "over {{count}} years"
  },
  almostXYears: {
    one: "almost 1 year",
    other: "almost {{count}} years"
  }
};
var formatDistance = (token, count, options) => {
  let result;
  const tokenValue = formatDistanceLocale[token];
  if (typeof tokenValue === "string") {
    result = tokenValue;
  } else if (count === 1) {
    result = tokenValue.one;
  } else {
    result = tokenValue.other.replace("{{count}}", count.toString());
  }
  if (options?.addSuffix) {
    if (options.comparison && options.comparison > 0) {
      return "in " + result;
    } else {
      return result + " ago";
    }
  }
  return result;
};

// node_modules/date-fns/locale/_lib/buildFormatLongFn.mjs
function buildFormatLongFn(args) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : args.defaultWidth;
    const format2 = args.formats[width] || args.formats[args.defaultWidth];
    return format2;
  };
}

// node_modules/date-fns/locale/en-US/_lib/formatLong.mjs
var dateFormats = {
  full: "EEEE, MMMM do, y",
  long: "MMMM do, y",
  medium: "MMM d, y",
  short: "MM/dd/yyyy"
};
var timeFormats = {
  full: "h:mm:ss a zzzz",
  long: "h:mm:ss a z",
  medium: "h:mm:ss a",
  short: "h:mm a"
};
var dateTimeFormats = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};
var formatLong = {
  date: buildFormatLongFn({
    formats: dateFormats,
    defaultWidth: "full"
  }),
  time: buildFormatLongFn({
    formats: timeFormats,
    defaultWidth: "full"
  }),
  dateTime: buildFormatLongFn({
    formats: dateTimeFormats,
    defaultWidth: "full"
  })
};

// node_modules/date-fns/locale/en-US/_lib/formatRelative.mjs
var formatRelativeLocale = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: "P"
};
var formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];

// node_modules/date-fns/locale/_lib/buildLocalizeFn.mjs
function buildLocalizeFn(args) {
  return (value, options) => {
    const context = options?.context ? String(options.context) : "standalone";
    let valuesArray;
    if (context === "formatting" && args.formattingValues) {
      const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
      const width = options?.width ? String(options.width) : defaultWidth;
      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
    } else {
      const defaultWidth = args.defaultWidth;
      const width = options?.width ? String(options.width) : args.defaultWidth;
      valuesArray = args.values[width] || args.values[defaultWidth];
    }
    const index = args.argumentCallback ? args.argumentCallback(value) : value;
    return valuesArray[index];
  };
}

// node_modules/date-fns/locale/en-US/_lib/localize.mjs
var eraValues = {
  narrow: ["B", "A"],
  abbreviated: ["BC", "AD"],
  wide: ["Before Christ", "Anno Domini"]
};
var quarterValues = {
  narrow: ["1", "2", "3", "4"],
  abbreviated: ["Q1", "Q2", "Q3", "Q4"],
  wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
};
var monthValues = {
  narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
  abbreviated: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  wide: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
};
var dayValues = {
  narrow: ["S", "M", "T", "W", "T", "F", "S"],
  short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  wide: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ]
};
var dayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  }
};
var formattingDayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  }
};
var ordinalNumber = (dirtyNumber, _options) => {
  const number = Number(dirtyNumber);
  const rem100 = number % 100;
  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + "st";
      case 2:
        return number + "nd";
      case 3:
        return number + "rd";
    }
  }
  return number + "th";
};
var localize = {
  ordinalNumber,
  era: buildLocalizeFn({
    values: eraValues,
    defaultWidth: "wide"
  }),
  quarter: buildLocalizeFn({
    values: quarterValues,
    defaultWidth: "wide",
    argumentCallback: (quarter) => quarter - 1
  }),
  month: buildLocalizeFn({
    values: monthValues,
    defaultWidth: "wide"
  }),
  day: buildLocalizeFn({
    values: dayValues,
    defaultWidth: "wide"
  }),
  dayPeriod: buildLocalizeFn({
    values: dayPeriodValues,
    defaultWidth: "wide",
    formattingValues: formattingDayPeriodValues,
    defaultFormattingWidth: "wide"
  })
};

// node_modules/date-fns/locale/_lib/buildMatchFn.mjs
function buildMatchFn(args) {
  return (string, options = {}) => {
    const width = options.width;
    const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
    const matchResult = string.match(matchPattern);
    if (!matchResult) {
      return null;
    }
    const matchedString = matchResult[0];
    const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
    const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- I challange you to fix the type
      findKey(parsePatterns, (pattern) => pattern.test(matchedString))
    );
    let value;
    value = args.valueCallback ? args.valueCallback(key) : key;
    value = options.valueCallback ? (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- I challange you to fix the type
      options.valueCallback(value)
    ) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
function findKey(object, predicate) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
      return key;
    }
  }
  return void 0;
}
function findIndex(array, predicate) {
  for (let key = 0; key < array.length; key++) {
    if (predicate(array[key])) {
      return key;
    }
  }
  return void 0;
}

// node_modules/date-fns/locale/_lib/buildMatchPatternFn.mjs
function buildMatchPatternFn(args) {
  return (string, options = {}) => {
    const matchResult = string.match(args.matchPattern);
    if (!matchResult) return null;
    const matchedString = matchResult[0];
    const parseResult = string.match(args.parsePattern);
    if (!parseResult) return null;
    let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
    value = options.valueCallback ? options.valueCallback(value) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}

// node_modules/date-fns/locale/en-US/_lib/match.mjs
var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
var parseOrdinalNumberPattern = /\d+/i;
var matchEraPatterns = {
  narrow: /^(b|a)/i,
  abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
  wide: /^(before christ|before common era|anno domini|common era)/i
};
var parseEraPatterns = {
  any: [/^b/i, /^(a|c)/i]
};
var matchQuarterPatterns = {
  narrow: /^[1234]/i,
  abbreviated: /^q[1234]/i,
  wide: /^[1234](th|st|nd|rd)? quarter/i
};
var parseQuarterPatterns = {
  any: [/1/i, /2/i, /3/i, /4/i]
};
var matchMonthPatterns = {
  narrow: /^[jfmasond]/i,
  abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
};
var parseMonthPatterns = {
  narrow: [
    /^j/i,
    /^f/i,
    /^m/i,
    /^a/i,
    /^m/i,
    /^j/i,
    /^j/i,
    /^a/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ],
  any: [
    /^ja/i,
    /^f/i,
    /^mar/i,
    /^ap/i,
    /^may/i,
    /^jun/i,
    /^jul/i,
    /^au/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ]
};
var matchDayPatterns = {
  narrow: /^[smtwf]/i,
  short: /^(su|mo|tu|we|th|fr|sa)/i,
  abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
  wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
};
var parseDayPatterns = {
  narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
  any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
};
var matchDayPeriodPatterns = {
  narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
  any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
};
var parseDayPeriodPatterns = {
  any: {
    am: /^a/i,
    pm: /^p/i,
    midnight: /^mi/i,
    noon: /^no/i,
    morning: /morning/i,
    afternoon: /afternoon/i,
    evening: /evening/i,
    night: /night/i
  }
};
var match = {
  ordinalNumber: buildMatchPatternFn({
    matchPattern: matchOrdinalNumberPattern,
    parsePattern: parseOrdinalNumberPattern,
    valueCallback: (value) => parseInt(value, 10)
  }),
  era: buildMatchFn({
    matchPatterns: matchEraPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseEraPatterns,
    defaultParseWidth: "any"
  }),
  quarter: buildMatchFn({
    matchPatterns: matchQuarterPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseQuarterPatterns,
    defaultParseWidth: "any",
    valueCallback: (index) => index + 1
  }),
  month: buildMatchFn({
    matchPatterns: matchMonthPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseMonthPatterns,
    defaultParseWidth: "any"
  }),
  day: buildMatchFn({
    matchPatterns: matchDayPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseDayPatterns,
    defaultParseWidth: "any"
  }),
  dayPeriod: buildMatchFn({
    matchPatterns: matchDayPeriodPatterns,
    defaultMatchWidth: "any",
    parsePatterns: parseDayPeriodPatterns,
    defaultParseWidth: "any"
  })
};

// node_modules/date-fns/locale/en-US.mjs
var enUS = {
  code: "en-US",
  formatDistance,
  formatLong,
  formatRelative,
  localize,
  match,
  options: {
    weekStartsOn: 0,
    firstWeekContainsDate: 1
  }
};

// node_modules/date-fns/getDayOfYear.mjs
function getDayOfYear(date) {
  const _date = toDate(date);
  const diff = differenceInCalendarDays(_date, startOfYear(_date));
  const dayOfYear = diff + 1;
  return dayOfYear;
}

// node_modules/date-fns/getISOWeek.mjs
function getISOWeek(date) {
  const _date = toDate(date);
  const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
  return Math.round(diff / millisecondsInWeek) + 1;
}

// node_modules/date-fns/getWeekYear.mjs
function getWeekYear(date, options) {
  const _date = toDate(date);
  const year = _date.getFullYear();
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const firstWeekOfNextYear = constructFrom(date, 0);
  firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
  firstWeekOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
  const firstWeekOfThisYear = constructFrom(date, 0);
  firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
  firstWeekOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}

// node_modules/date-fns/startOfWeekYear.mjs
function startOfWeekYear(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const year = getWeekYear(date, options);
  const firstWeek = constructFrom(date, 0);
  firstWeek.setFullYear(year, 0, firstWeekContainsDate);
  firstWeek.setHours(0, 0, 0, 0);
  const _date = startOfWeek(firstWeek, options);
  return _date;
}

// node_modules/date-fns/getWeek.mjs
function getWeek(date, options) {
  const _date = toDate(date);
  const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
  return Math.round(diff / millisecondsInWeek) + 1;
}

// node_modules/date-fns/_lib/addLeadingZeros.mjs
function addLeadingZeros(number, targetLength) {
  const sign = number < 0 ? "-" : "";
  const output = Math.abs(number).toString().padStart(targetLength, "0");
  return sign + output;
}

// node_modules/date-fns/_lib/format/lightFormatters.mjs
var lightFormatters = {
  // Year
  y(date, token) {
    const signedYear = date.getFullYear();
    const year = signedYear > 0 ? signedYear : 1 - signedYear;
    return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
  },
  // Month
  M(date, token) {
    const month = date.getMonth();
    return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
  },
  // Day of the month
  d(date, token) {
    return addLeadingZeros(date.getDate(), token.length);
  },
  // AM or PM
  a(date, token) {
    const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return dayPeriodEnumValue.toUpperCase();
      case "aaa":
        return dayPeriodEnumValue;
      case "aaaaa":
        return dayPeriodEnumValue[0];
      case "aaaa":
      default:
        return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
    }
  },
  // Hour [1-12]
  h(date, token) {
    return addLeadingZeros(date.getHours() % 12 || 12, token.length);
  },
  // Hour [0-23]
  H(date, token) {
    return addLeadingZeros(date.getHours(), token.length);
  },
  // Minute
  m(date, token) {
    return addLeadingZeros(date.getMinutes(), token.length);
  },
  // Second
  s(date, token) {
    return addLeadingZeros(date.getSeconds(), token.length);
  },
  // Fraction of second
  S(date, token) {
    const numberOfDigits = token.length;
    const milliseconds = date.getMilliseconds();
    const fractionalSeconds = Math.trunc(
      milliseconds * Math.pow(10, numberOfDigits - 3)
    );
    return addLeadingZeros(fractionalSeconds, token.length);
  }
};

// node_modules/date-fns/_lib/format/formatters.mjs
var dayPeriodEnum = {
  am: "am",
  pm: "pm",
  midnight: "midnight",
  noon: "noon",
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  night: "night"
};
var formatters = {
  // Era
  G: function(date, token, localize2) {
    const era = date.getFullYear() > 0 ? 1 : 0;
    switch (token) {
      // AD, BC
      case "G":
      case "GG":
      case "GGG":
        return localize2.era(era, { width: "abbreviated" });
      // A, B
      case "GGGGG":
        return localize2.era(era, { width: "narrow" });
      // Anno Domini, Before Christ
      case "GGGG":
      default:
        return localize2.era(era, { width: "wide" });
    }
  },
  // Year
  y: function(date, token, localize2) {
    if (token === "yo") {
      const signedYear = date.getFullYear();
      const year = signedYear > 0 ? signedYear : 1 - signedYear;
      return localize2.ordinalNumber(year, { unit: "year" });
    }
    return lightFormatters.y(date, token);
  },
  // Local week-numbering year
  Y: function(date, token, localize2, options) {
    const signedWeekYear = getWeekYear(date, options);
    const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
    if (token === "YY") {
      const twoDigitYear = weekYear % 100;
      return addLeadingZeros(twoDigitYear, 2);
    }
    if (token === "Yo") {
      return localize2.ordinalNumber(weekYear, { unit: "year" });
    }
    return addLeadingZeros(weekYear, token.length);
  },
  // ISO week-numbering year
  R: function(date, token) {
    const isoWeekYear = getISOWeekYear(date);
    return addLeadingZeros(isoWeekYear, token.length);
  },
  // Extended year. This is a single number designating the year of this calendar system.
  // The main difference between `y` and `u` localizers are B.C. years:
  // | Year | `y` | `u` |
  // |------|-----|-----|
  // | AC 1 |   1 |   1 |
  // | BC 1 |   1 |   0 |
  // | BC 2 |   2 |  -1 |
  // Also `yy` always returns the last two digits of a year,
  // while `uu` pads single digit years to 2 characters and returns other years unchanged.
  u: function(date, token) {
    const year = date.getFullYear();
    return addLeadingZeros(year, token.length);
  },
  // Quarter
  Q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      // 1, 2, 3, 4
      case "Q":
        return String(quarter);
      // 01, 02, 03, 04
      case "QQ":
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th
      case "Qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      // Q1, Q2, Q3, Q4
      case "QQQ":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "formatting"
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)
      case "QQQQQ":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "formatting"
        });
      // 1st quarter, 2nd quarter, ...
      case "QQQQ":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone quarter
  q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      // 1, 2, 3, 4
      case "q":
        return String(quarter);
      // 01, 02, 03, 04
      case "qq":
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th
      case "qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      // Q1, Q2, Q3, Q4
      case "qqq":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "standalone"
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)
      case "qqqqq":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "standalone"
        });
      // 1st quarter, 2nd quarter, ...
      case "qqqq":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // Month
  M: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      case "M":
      case "MM":
        return lightFormatters.M(date, token);
      // 1st, 2nd, ..., 12th
      case "Mo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      // Jan, Feb, ..., Dec
      case "MMM":
        return localize2.month(month, {
          width: "abbreviated",
          context: "formatting"
        });
      // J, F, ..., D
      case "MMMMM":
        return localize2.month(month, {
          width: "narrow",
          context: "formatting"
        });
      // January, February, ..., December
      case "MMMM":
      default:
        return localize2.month(month, { width: "wide", context: "formatting" });
    }
  },
  // Stand-alone month
  L: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      // 1, 2, ..., 12
      case "L":
        return String(month + 1);
      // 01, 02, ..., 12
      case "LL":
        return addLeadingZeros(month + 1, 2);
      // 1st, 2nd, ..., 12th
      case "Lo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      // Jan, Feb, ..., Dec
      case "LLL":
        return localize2.month(month, {
          width: "abbreviated",
          context: "standalone"
        });
      // J, F, ..., D
      case "LLLLL":
        return localize2.month(month, {
          width: "narrow",
          context: "standalone"
        });
      // January, February, ..., December
      case "LLLL":
      default:
        return localize2.month(month, { width: "wide", context: "standalone" });
    }
  },
  // Local week of year
  w: function(date, token, localize2, options) {
    const week = getWeek(date, options);
    if (token === "wo") {
      return localize2.ordinalNumber(week, { unit: "week" });
    }
    return addLeadingZeros(week, token.length);
  },
  // ISO week of year
  I: function(date, token, localize2) {
    const isoWeek = getISOWeek(date);
    if (token === "Io") {
      return localize2.ordinalNumber(isoWeek, { unit: "week" });
    }
    return addLeadingZeros(isoWeek, token.length);
  },
  // Day of the month
  d: function(date, token, localize2) {
    if (token === "do") {
      return localize2.ordinalNumber(date.getDate(), { unit: "date" });
    }
    return lightFormatters.d(date, token);
  },
  // Day of year
  D: function(date, token, localize2) {
    const dayOfYear = getDayOfYear(date);
    if (token === "Do") {
      return localize2.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
    }
    return addLeadingZeros(dayOfYear, token.length);
  },
  // Day of week
  E: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    switch (token) {
      // Tue
      case "E":
      case "EE":
      case "EEE":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "EEEEE":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "EEEEEE":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "EEEE":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Local day of week
  e: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      // Numerical value (Nth day of week with current locale or weekStartsOn)
      case "e":
        return String(localDayOfWeek);
      // Padded numerical value
      case "ee":
        return addLeadingZeros(localDayOfWeek, 2);
      // 1st, 2nd, ..., 7th
      case "eo":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "eee":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "eeeee":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "eeeeee":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "eeee":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone local day of week
  c: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      // Numerical value (same as in `e`)
      case "c":
        return String(localDayOfWeek);
      // Padded numerical value
      case "cc":
        return addLeadingZeros(localDayOfWeek, token.length);
      // 1st, 2nd, ..., 7th
      case "co":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "ccc":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "standalone"
        });
      // T
      case "ccccc":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "standalone"
        });
      // Tu
      case "cccccc":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "standalone"
        });
      // Tuesday
      case "cccc":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // ISO day of week
  i: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    switch (token) {
      // 2
      case "i":
        return String(isoDayOfWeek);
      // 02
      case "ii":
        return addLeadingZeros(isoDayOfWeek, token.length);
      // 2nd
      case "io":
        return localize2.ordinalNumber(isoDayOfWeek, { unit: "day" });
      // Tue
      case "iii":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      // T
      case "iiiii":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      // Tu
      case "iiiiii":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      // Tuesday
      case "iiii":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM or PM
  a: function(date, token, localize2) {
    const hours = date.getHours();
    const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "aaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "aaaaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "aaaa":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM, PM, midnight, noon
  b: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours === 12) {
      dayPeriodEnumValue = dayPeriodEnum.noon;
    } else if (hours === 0) {
      dayPeriodEnumValue = dayPeriodEnum.midnight;
    } else {
      dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    }
    switch (token) {
      case "b":
      case "bb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "bbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "bbbbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "bbbb":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // in the morning, in the afternoon, in the evening, at night
  B: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours >= 17) {
      dayPeriodEnumValue = dayPeriodEnum.evening;
    } else if (hours >= 12) {
      dayPeriodEnumValue = dayPeriodEnum.afternoon;
    } else if (hours >= 4) {
      dayPeriodEnumValue = dayPeriodEnum.morning;
    } else {
      dayPeriodEnumValue = dayPeriodEnum.night;
    }
    switch (token) {
      case "B":
      case "BB":
      case "BBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "BBBBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "BBBB":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Hour [1-12]
  h: function(date, token, localize2) {
    if (token === "ho") {
      let hours = date.getHours() % 12;
      if (hours === 0) hours = 12;
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return lightFormatters.h(date, token);
  },
  // Hour [0-23]
  H: function(date, token, localize2) {
    if (token === "Ho") {
      return localize2.ordinalNumber(date.getHours(), { unit: "hour" });
    }
    return lightFormatters.H(date, token);
  },
  // Hour [0-11]
  K: function(date, token, localize2) {
    const hours = date.getHours() % 12;
    if (token === "Ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Hour [1-24]
  k: function(date, token, localize2) {
    let hours = date.getHours();
    if (hours === 0) hours = 24;
    if (token === "ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Minute
  m: function(date, token, localize2) {
    if (token === "mo") {
      return localize2.ordinalNumber(date.getMinutes(), { unit: "minute" });
    }
    return lightFormatters.m(date, token);
  },
  // Second
  s: function(date, token, localize2) {
    if (token === "so") {
      return localize2.ordinalNumber(date.getSeconds(), { unit: "second" });
    }
    return lightFormatters.s(date, token);
  },
  // Fraction of second
  S: function(date, token) {
    return lightFormatters.S(date, token);
  },
  // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
  X: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    if (timezoneOffset === 0) {
      return "Z";
    }
    switch (token) {
      // Hours and optional minutes
      case "X":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XX`
      case "XXXX":
      case "XX":
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XXX`
      case "XXXXX":
      case "XXX":
      // Hours and minutes with `:` delimiter
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
  x: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Hours and optional minutes
      case "x":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xx`
      case "xxxx":
      case "xx":
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xxx`
      case "xxxxx":
      case "xxx":
      // Hours and minutes with `:` delimiter
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (GMT)
  O: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Short
      case "O":
      case "OO":
      case "OOO":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      // Long
      case "OOOO":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (specific non-location)
  z: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      // Short
      case "z":
      case "zz":
      case "zzz":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      // Long
      case "zzzz":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Seconds timestamp
  t: function(date, token, _localize) {
    const timestamp = Math.trunc(date.getTime() / 1e3);
    return addLeadingZeros(timestamp, token.length);
  },
  // Milliseconds timestamp
  T: function(date, token, _localize) {
    const timestamp = date.getTime();
    return addLeadingZeros(timestamp, token.length);
  }
};
function formatTimezoneShort(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = Math.trunc(absOffset / 60);
  const minutes = absOffset % 60;
  if (minutes === 0) {
    return sign + String(hours);
  }
  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}
function formatTimezoneWithOptionalMinutes(offset, delimiter) {
  if (offset % 60 === 0) {
    const sign = offset > 0 ? "-" : "+";
    return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
  }
  return formatTimezone(offset, delimiter);
}
function formatTimezone(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
  const minutes = addLeadingZeros(absOffset % 60, 2);
  return sign + hours + delimiter + minutes;
}

// node_modules/date-fns/_lib/format/longFormatters.mjs
var dateLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "P":
      return formatLong2.date({ width: "short" });
    case "PP":
      return formatLong2.date({ width: "medium" });
    case "PPP":
      return formatLong2.date({ width: "long" });
    case "PPPP":
    default:
      return formatLong2.date({ width: "full" });
  }
};
var timeLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "p":
      return formatLong2.time({ width: "short" });
    case "pp":
      return formatLong2.time({ width: "medium" });
    case "ppp":
      return formatLong2.time({ width: "long" });
    case "pppp":
    default:
      return formatLong2.time({ width: "full" });
  }
};
var dateTimeLongFormatter = (pattern, formatLong2) => {
  const matchResult = pattern.match(/(P+)(p+)?/) || [];
  const datePattern = matchResult[1];
  const timePattern = matchResult[2];
  if (!timePattern) {
    return dateLongFormatter(pattern, formatLong2);
  }
  let dateTimeFormat;
  switch (datePattern) {
    case "P":
      dateTimeFormat = formatLong2.dateTime({ width: "short" });
      break;
    case "PP":
      dateTimeFormat = formatLong2.dateTime({ width: "medium" });
      break;
    case "PPP":
      dateTimeFormat = formatLong2.dateTime({ width: "long" });
      break;
    case "PPPP":
    default:
      dateTimeFormat = formatLong2.dateTime({ width: "full" });
      break;
  }
  return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong2)).replace("{{time}}", timeLongFormatter(timePattern, formatLong2));
};
var longFormatters = {
  p: timeLongFormatter,
  P: dateTimeLongFormatter
};

// node_modules/date-fns/_lib/protectedTokens.mjs
var dayOfYearTokenRE = /^D+$/;
var weekYearTokenRE = /^Y+$/;
var throwTokens = ["D", "DD", "YY", "YYYY"];
function isProtectedDayOfYearToken(token) {
  return dayOfYearTokenRE.test(token);
}
function isProtectedWeekYearToken(token) {
  return weekYearTokenRE.test(token);
}
function warnOrThrowProtectedError(token, format2, input) {
  const _message = message(token, format2, input);
  console.warn(_message);
  if (throwTokens.includes(token)) throw new RangeError(_message);
}
function message(token, format2, input) {
  const subject = token[0] === "Y" ? "years" : "days of the month";
  return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format2}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
}

// node_modules/date-fns/format.mjs
var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
var escapedStringRegExp = /^'([^]*?)'?$/;
var doubleQuoteRegExp = /''/g;
var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
function format(date, formatStr, options) {
  const defaultOptions2 = getDefaultOptions();
  const locale = options?.locale ?? defaultOptions2.locale ?? enUS;
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const originalDate = toDate(date);
  if (!isValid(originalDate)) {
    throw new RangeError("Invalid time value");
  }
  let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
    const firstCharacter = substring[0];
    if (firstCharacter === "p" || firstCharacter === "P") {
      const longFormatter = longFormatters[firstCharacter];
      return longFormatter(substring, locale.formatLong);
    }
    return substring;
  }).join("").match(formattingTokensRegExp).map((substring) => {
    if (substring === "''") {
      return { isToken: false, value: "'" };
    }
    const firstCharacter = substring[0];
    if (firstCharacter === "'") {
      return { isToken: false, value: cleanEscapedString(substring) };
    }
    if (formatters[firstCharacter]) {
      return { isToken: true, value: substring };
    }
    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
      throw new RangeError(
        "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
      );
    }
    return { isToken: false, value: substring };
  });
  if (locale.localize.preprocessor) {
    parts = locale.localize.preprocessor(originalDate, parts);
  }
  const formatterOptions = {
    firstWeekContainsDate,
    weekStartsOn,
    locale
  };
  return parts.map((part) => {
    if (!part.isToken) return part.value;
    const token = part.value;
    if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) {
      warnOrThrowProtectedError(token, formatStr, String(date));
    }
    const formatter = formatters[token[0]];
    return formatter(originalDate, token, locale.localize, formatterOptions);
  }).join("");
}
function cleanEscapedString(input) {
  const matched = input.match(escapedStringRegExp);
  if (!matched) {
    return input;
  }
  return matched[1].replace(doubleQuoteRegExp, "'");
}

// node_modules/date-fns/subDays.mjs
function subDays(date, amount) {
  return addDays(date, -amount);
}

// src/lib/loan-calculator.ts
var roundCurrency = (amount) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};
var calculateTotalRepayable = (loanDetails, loanProduct, taxConfigs, asOfDate = /* @__PURE__ */ new Date()) => {
  const loanStartDate = startOfDay(new Date(loanDetails.disbursedDate));
  const finalDate = startOfDay(asOfDate);
  const dueDate = startOfDay(new Date(loanDetails.dueDate));
  const principal = loanDetails.loanAmount;
  let serviceFee = 0;
  let interestComponent = 0;
  let penaltyComponent = 0;
  let taxComponent = 0;
  const safeParse = (field, defaultValue) => {
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch (e) {
        return defaultValue;
      }
    }
    return field ?? defaultValue;
  };
  const serviceFeeRule = safeParse(loanProduct.serviceFee, void 0);
  const dailyFeeRule = safeParse(loanProduct.dailyFee, void 0);
  const penaltyRules = safeParse(loanProduct.penaltyRules, []);
  if (loanProduct.serviceFeeEnabled && serviceFeeRule && serviceFeeRule.value > 0) {
    const feeValue = typeof serviceFeeRule.value === "string" ? parseFloat(serviceFeeRule.value) : serviceFeeRule.value;
    if (serviceFeeRule.type === "fixed") {
      serviceFee = feeValue;
    } else if (serviceFeeRule.type === "percentage") {
      serviceFee = principal * (feeValue / 100);
    }
  }
  serviceFee = roundCurrency(serviceFee);
  if (loanProduct.dailyFeeEnabled && dailyFeeRule && dailyFeeRule.value > 0) {
    const feeValue = typeof dailyFeeRule.value === "string" ? parseFloat(dailyFeeRule.value) : dailyFeeRule.value;
    const interestEndDate = finalDate > dueDate ? dueDate : finalDate;
    const daysForInterest = differenceInDays(interestEndDate, loanStartDate);
    if (daysForInterest > 0) {
      if (dailyFeeRule.type === "fixed") {
        interestComponent = feeValue * daysForInterest;
      } else if (dailyFeeRule.type === "percentage") {
        if (dailyFeeRule.calculationBase === "compound") {
          let compoundInterestBase = principal;
          for (let i = 0; i < daysForInterest; i++) {
            const dailyInterest = roundCurrency(compoundInterestBase * (feeValue / 100));
            interestComponent += dailyInterest;
            compoundInterestBase += dailyInterest;
          }
        } else {
          interestComponent = principal * (feeValue / 100) * daysForInterest;
        }
      }
    }
  }
  interestComponent = roundCurrency(interestComponent);
  const runningBalanceForPenalty = principal + interestComponent + serviceFee;
  if (loanProduct.penaltyRulesEnabled && penaltyRules && penaltyRules.length > 0 && finalDate > dueDate) {
    const penaltyStartDate = loanProduct.duration === 0 ? startOfDay(new Date(loanDetails.disbursedDate.getTime() + 864e5)) : dueDate;
    const daysOverdueTotal = differenceInDays(finalDate, penaltyStartDate);
    penaltyRules.forEach((rule) => {
      const fromDay = rule.fromDay === "" ? 1 : Number(rule.fromDay);
      const toDayRaw = rule.toDay === "" || rule.toDay === null ? Infinity : Number(rule.toDay);
      const toDay = isNaN(toDayRaw) ? Infinity : toDayRaw;
      const value = rule.value === "" ? 0 : Number(rule.value);
      if (daysOverdueTotal >= fromDay) {
        const applicableDaysInTier = Math.min(daysOverdueTotal, toDay) - fromDay + 1;
        const isOneTime = rule.frequency === "one-time";
        if (applicableDaysInTier > 0) {
          let penaltyForThisRule = 0;
          const daysToCalculate = isOneTime ? 1 : applicableDaysInTier;
          if (rule.type === "fixed") {
            penaltyForThisRule = value * daysToCalculate;
          } else if (rule.type === "percentageOfPrincipal") {
            penaltyForThisRule = principal * (value / 100) * daysToCalculate;
          } else if (rule.type === "percentageOfCompound") {
            let compoundPenaltyBase = runningBalanceForPenalty + penaltyComponent;
            for (let i = 0; i < daysToCalculate; i++) {
              const dailyPenalty = roundCurrency(compoundPenaltyBase * (value / 100));
              penaltyForThisRule += dailyPenalty;
              if (!isOneTime) {
                compoundPenaltyBase += dailyPenalty;
              }
            }
          }
          penaltyComponent += penaltyForThisRule;
        }
      }
    });
  }
  penaltyComponent = roundCurrency(penaltyComponent);
  taxConfigs.forEach((taxConfig) => {
    const taxRate = taxConfig.rate;
    const taxAppliedTo = JSON.parse(taxConfig.appliedTo);
    if (taxRate > 0) {
      let taxableAmount = 0;
      if (taxAppliedTo.includes("serviceFee")) {
        taxableAmount += serviceFee;
      }
      if (taxAppliedTo.includes("interest")) {
        taxableAmount += interestComponent;
      }
      if (taxAppliedTo.includes("penalty")) {
        taxableAmount += penaltyComponent;
      }
      taxComponent += taxableAmount * (taxRate / 100);
    }
  });
  taxComponent = roundCurrency(taxComponent);
  const totalDebt = roundCurrency(principal + serviceFee + interestComponent + penaltyComponent + taxComponent);
  return {
    total: totalDebt,
    principal,
    serviceFee,
    interest: interestComponent,
    penalty: penaltyComponent,
    tax: taxComponent
  };
};

// src/lib/audit-log.ts
async function createAuditLog(data) {
  try {
    await prisma_default.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        details: data.details ? JSON.stringify(data.details) : null
      }
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// src/lib/sms.ts
async function sendSms(to, text) {
  const smsUrl = process.env.SMS_URL;
  try {
    const params = new URLSearchParams();
    params.append("to", to);
    params.append("text", text);
    const res = await fetch(smsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    const body = await res.text().catch(() => null);
    if (!res.ok) {
      console.error("[sms] send failed", { to, smsUrl, status: res.status, body });
      return { ok: false, status: res.status, body };
    }
    console.info("[sms] sent", { to, smsUrl, status: res.status, body });
    return { ok: true, status: res.status, body };
  } catch (err) {
    console.error("[sms] exception sending", { to, smsUrl, error: String(err?.message ?? err) });
    return { ok: false, error: String(err?.message ?? err) };
  }
}
var sms_default = sendSms;

// src/actions/repayment.ts
async function getBorrowerBalance(borrowerId) {
  const provisionedData = await prisma_default.provisionedData.findFirst({
    where: { borrowerId },
    orderBy: { createdAt: "desc" }
  });
  if (provisionedData) {
    try {
      const data = JSON.parse(provisionedData.data);
      const balanceKey = Object.keys(data).find((k) => k.toLowerCase() === "accountbalance");
      if (balanceKey) {
        return parseFloat(data[balanceKey]) || 0;
      }
    } catch (e) {
      console.error(`Could not parse provisioned data for borrower ${borrowerId}`, e);
      return 0;
    }
  }
  return 0;
}
async function processAutomatedRepayments() {
  console.log("Starting automated repayment process...");
  const today = startOfDay(/* @__PURE__ */ new Date());
  const overdueLoans = await prisma_default.loan.findMany({
    where: {
      repaymentStatus: "Unpaid",
      dueDate: {
        lt: today
      }
    },
    include: {
      product: {
        include: {
          provider: {
            include: {
              ledgerAccounts: true
            }
          }
        }
      }
    }
  });
  if (overdueLoans.length === 0) {
    console.log("No overdue loans found.");
    return { success: true, message: "No overdue loans to process.", processedCount: 0 };
  }
  let processedCount = 0;
  for (const loan of overdueLoans) {
    const { total, principal, interest, penalty, serviceFee } = calculateTotalRepayable(loan, loan.product, today);
    const alreadyRepaid = loan.repaidAmount || 0;
    const totalDue = total - alreadyRepaid;
    if (totalDue <= 0) {
      continue;
    }
    const borrowerBalance = await getBorrowerBalance(loan.borrowerId);
    if (borrowerBalance >= totalDue) {
      try {
        await prisma_default.$transaction(async (tx) => {
          const provider = loan.product.provider;
          const principalReceivable = provider.ledgerAccounts.find((a) => a.category === "Principal" && a.type === "Receivable");
          const interestReceivable = provider.ledgerAccounts.find((a) => a.category === "Interest" && a.type === "Receivable");
          const penaltyReceivable = provider.ledgerAccounts.find((a) => a.category === "Penalty" && a.type === "Receivable");
          const serviceFeeReceivable = provider.ledgerAccounts.find((a) => a.category === "ServiceFee" && a.type === "Receivable");
          const principalReceived = provider.ledgerAccounts.find((a) => a.category === "Principal" && a.type === "Received");
          const interestReceived = provider.ledgerAccounts.find((a) => a.category === "Interest" && a.type === "Received");
          const penaltyReceived = provider.ledgerAccounts.find((a) => a.category === "Penalty" && a.type === "Received");
          const serviceFeeReceived = provider.ledgerAccounts.find((a) => a.category === "ServiceFee" && a.type === "Received");
          if (!principalReceivable || !interestReceivable || !penaltyReceivable || !serviceFeeReceivable || !principalReceived || !interestReceived || !penaltyReceived || !serviceFeeReceived) {
            throw new Error(`One or more ledger accounts not found for provider ${provider.id}`);
          }
          const journalEntry = await tx.journalEntry.create({
            data: {
              providerId: provider.id,
              loanId: loan.id,
              date: today,
              description: `Automated repayment for loan ${loan.id}`
            }
          });
          let paymentAmount = totalDue;
          const penaltyDue = Math.max(0, penalty - (loan.repaidAmount || 0));
          const serviceFeeDue = Math.max(0, serviceFee - Math.max(0, (loan.repaidAmount || 0) - penalty));
          const interestDue = Math.max(0, interest - Math.max(0, (loan.repaidAmount || 0) - penalty - serviceFee));
          const penaltyToPay = Math.min(paymentAmount, penaltyDue);
          if (penaltyToPay > 0) {
            await tx.ledgerAccount.update({ where: { id: penaltyReceivable.id }, data: { balance: { decrement: penaltyToPay } } });
            await tx.ledgerAccount.update({ where: { id: penaltyReceived.id }, data: { balance: { increment: penaltyToPay } } });
            await tx.ledgerEntry.createMany({ data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceivable.id, type: "Credit", amount: penaltyToPay },
              { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceived.id, type: "Debit", amount: penaltyToPay }
            ] });
            paymentAmount -= penaltyToPay;
          }
          const serviceFeeToPay = Math.min(paymentAmount, serviceFeeDue);
          if (serviceFeeToPay > 0) {
            await tx.ledgerAccount.update({ where: { id: serviceFeeReceivable.id }, data: { balance: { decrement: serviceFeeToPay } } });
            await tx.ledgerAccount.update({ where: { id: serviceFeeReceived.id }, data: { balance: { increment: serviceFeeToPay } } });
            await tx.ledgerEntry.createMany({ data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceivable.id, type: "Credit", amount: serviceFeeToPay },
              { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceived.id, type: "Debit", amount: serviceFeeToPay }
            ] });
            paymentAmount -= serviceFeeToPay;
          }
          const interestToPay = Math.min(paymentAmount, interestDue);
          if (interestToPay > 0) {
            await tx.ledgerAccount.update({ where: { id: interestReceivable.id }, data: { balance: { decrement: interestToPay } } });
            await tx.ledgerAccount.update({ where: { id: interestReceived.id }, data: { balance: { increment: interestToPay } } });
            await tx.ledgerEntry.createMany({ data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: interestReceivable.id, type: "Credit", amount: interestToPay },
              { journalEntryId: journalEntry.id, ledgerAccountId: interestReceived.id, type: "Debit", amount: interestToPay }
            ] });
            paymentAmount -= interestToPay;
          }
          const principalToPay = paymentAmount;
          if (principalToPay > 0) {
            await tx.ledgerAccount.update({ where: { id: principalReceivable.id }, data: { balance: { decrement: principalToPay } } });
            await tx.ledgerAccount.update({ where: { id: principalReceived.id }, data: { balance: { increment: principalToPay } } });
            await tx.ledgerEntry.createMany({ data: [
              { journalEntryId: journalEntry.id, ledgerAccountId: principalReceivable.id, type: "Credit", amount: principalToPay },
              { journalEntryId: journalEntry.id, ledgerAccountId: principalReceived.id, type: "Debit", amount: principalToPay }
            ] });
          }
          await tx.payment.create({
            data: {
              loanId: loan.id,
              amount: totalDue,
              date: today,
              outstandingBalanceBeforePayment: totalDue,
              journalEntryId: journalEntry.id
            }
          });
          await tx.loan.update({
            where: { id: loan.id },
            data: {
              repaidAmount: (loan.repaidAmount || 0) + totalDue,
              repaymentStatus: "Paid"
            }
          });
        });
        processedCount++;
        const logDetails = {
          loanId: loan.id,
          borrowerId: loan.borrowerId,
          amount: totalDue
        };
        await createAuditLog({ actorId: "system", action: "AUTOMATED_REPAYMENT_SUCCESS", entity: "LOAN", entityId: loan.id, details: logDetails });
        console.log(JSON.stringify({
          action: "AUTOMATED_REPAYMENT_SUCCESS",
          actorId: "system",
          details: logDetails
        }));
      } catch (error) {
        const failureDetails = {
          loanId: loan.id,
          borrowerId: loan.borrowerId,
          error: error.message
        };
        await createAuditLog({ actorId: "system", action: "AUTOMATED_REPAYMENT_FAILURE", entity: "LOAN", entityId: loan.id, details: failureDetails });
        console.error(JSON.stringify({
          action: "AUTOMATED_REPAYMENT_FAILURE",
          actorId: "system",
          details: failureDetails
        }));
      }
    } else {
      const skipDetails = {
        loanId: loan.id,
        borrowerId: loan.borrowerId,
        balance: borrowerBalance,
        amountDue: totalDue
      };
      await createAuditLog({ actorId: "system", action: "AUTOMATED_REPAYMENT_SKIPPED", entity: "LOAN", entityId: loan.id, details: { reason: "Insufficient funds", ...skipDetails } });
      console.log(JSON.stringify({
        action: "AUTOMATED_REPAYMENT_SKIPPED",
        actorId: "system",
        reason: "Insufficient funds",
        details: skipDetails
      }));
    }
  }
  console.log(`Automated repayment process finished. Processed ${processedCount} loans.`);
  return { success: true, message: `Processed ${overdueLoans.length} overdue loans, successfully repaid ${processedCount}.`, processedCount };
}
async function sendDueDateReminders() {
  const today = startOfDay(/* @__PURE__ */ new Date());
  const dueLoans = await prisma_default.loan.findMany({
    where: {
      repaymentStatus: "Unpaid",
      dueDate: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1e3)
      }
    }
  });
  let sent = 0;
  for (const loan of dueLoans) {
    try {
      const phone = loan.borrowerId;
      const msg = `Reminder: Loan ${loan.id} of amount ${loan.loanAmount} is due today (${loan.dueDate.toISOString().split("T")[0]}). Please repay to avoid penalties.`;
      const res = await sms_default(String(phone), msg);
      if (res.ok) sent++;
    } catch (e) {
      console.error("[repayment][dueReminder] failed to send sms", { loanId: loan.id, error: e });
    }
  }
  return { sent };
}

// src/actions/npl.ts
async function updateNplStatus() {
  const providers = await prisma_default.loanProvider.findMany({
    select: {
      id: true,
      nplThresholdDays: true,
      products: {
        select: {
          id: true
        }
      }
    }
  });
  if (providers.length === 0) {
    return { success: true, message: "No providers to process.", updatedCount: 0 };
  }
  let totalUpdatedCount = 0;
  for (const provider of providers) {
    const nplThresholdDate = subDays(/* @__PURE__ */ new Date(), provider.nplThresholdDays);
    const productIds = provider.products.map((p) => p.id);
    if (productIds.length === 0) continue;
    const overdueLoans = await prisma_default.loan.findMany({
      where: {
        productId: { in: productIds },
        repaymentStatus: "Unpaid",
        disbursedDate: {
          lt: nplThresholdDate
        }
      },
      select: {
        borrowerId: true
      }
    });
    if (overdueLoans.length === 0) {
      continue;
    }
    const borrowerIdsToFlag = [...new Set(overdueLoans.map((loan) => loan.borrowerId))];
    try {
      const borrowersToFlag = await prisma_default.borrower.findMany({ where: { id: { in: borrowerIdsToFlag }, status: { not: "NPL" } }, select: { id: true } });
      if (borrowersToFlag.length === 0) continue;
      const idsToUpdate = borrowersToFlag.map((b) => b.id);
      const { count } = await prisma_default.borrower.updateMany({ where: { id: { in: idsToUpdate } }, data: { status: "NPL" } });
      totalUpdatedCount += count;
      for (const b of borrowersToFlag) {
        (async () => {
          try {
            const phone = b.id;
            const msg = `Your loan account has been flagged as Non-Performing Loan (NPL). Please contact support to regularize your account.`;
            const smsRes = await sms_default(String(phone), msg);
            if (!smsRes.ok) console.warn("[npl] sms send failed", smsRes);
          } catch (e) {
            console.error("[npl] sms notify error", e);
          }
        })();
      }
    } catch (error) {
      console.error(`Failed to update NPL statuses for provider ${provider.id}:`, error);
    }
  }
  return { success: true, message: `Successfully updated a total of ${totalUpdatedCount} borrowers to NPL status.`, updatedCount: totalUpdatedCount };
}

// src/lib/logger.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var LOG_DIR = process.env.LOG_DIR || import_path.default.resolve(process.cwd(), "logs");
async function writeLog(level, message2) {
  try {
    import_fs.default.mkdirSync(LOG_DIR, { recursive: true });
    const fileName = import_path.default.join(LOG_DIR, `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.log`);
    const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] [pid:${process.pid}] [${level}] ${message2}
`;
    import_fs.default.appendFileSync(fileName, line, { encoding: "utf8" });
  } catch (err) {
    console.error("Logger failed to write:", err);
  }
}
var logger = {
  info: (msg) => writeLog("INFO", msg),
  warn: (msg) => writeLog("WARN", msg),
  error: (msg) => writeLog("ERROR", msg),
  debug: (msg) => writeLog("DEBUG", msg)
};

// src/actions/provider-distribution.ts
function roundCurrency2(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
function isUpstreamSuccess(payload) {
  const status = String(payload?.status ?? "").toUpperCase();
  return status === "SUCCESS" || status === "SUCCESSFUL" || status === "OK";
}
function getUpstreamConfig() {
  const url = process.env.EXTERNAL_DISTRIBUTION_URL ?? "http://192.168.100.56:8280/nibtera-loan/distribution";
  const user = process.env.EXTERNAL_API_USERNAME ?? "nibLoan";
  const pass = process.env.EXTERNAL_API_PASSWORD ?? "123456";
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  return { url, auth };
}
async function runProviderDistributionOnce(input) {
  const distributionDate = startOfDay(input?.distributionDate ?? subDays(/* @__PURE__ */ new Date(), 1));
  const distributionDateStr = format(distributionDate, "yyyy-MM-dd");
  logger.info(`Provider distribution run started for date=${distributionDateStr}`);
  const providers = await prisma_default.loanProvider.findMany({
    include: { ledgerAccounts: true }
  });
  logger.info(`Found ${providers.length} providers for distribution run`);
  const upstream = getUpstreamConfig();
  let processedProviders = 0;
  let skippedProviders = 0;
  let alreadyDistributed = 0;
  let errors = 0;
  for (const provider of providers) {
    try {
      logger.info(`Processing provider ${provider.id} (${provider.name})`);
      const interestReceived = provider.ledgerAccounts.find((a) => a.category === "Interest" && a.type === "Received");
      const serviceFeeReceived = provider.ledgerAccounts.find((a) => a.category === "ServiceFee" && a.type === "Received");
      const penaltyReceived = provider.ledgerAccounts.find((a) => a.category === "Penalty" && a.type === "Received");
      const taxReceived = provider.ledgerAccounts.find((a) => a.category === "Tax" && a.type === "Received");
      const breakdown = {
        interestAmount: roundCurrency2(interestReceived?.balance ?? 0),
        serviceFeeAmount: roundCurrency2(serviceFeeReceived?.balance ?? 0),
        penaltyAmount: roundCurrency2(penaltyReceived?.balance ?? 0),
        taxAmount: roundCurrency2(taxReceived?.balance ?? 0)
      };
      const total = roundCurrency2(
        breakdown.interestAmount + breakdown.serviceFeeAmount + breakdown.penaltyAmount + breakdown.taxAmount
      );
      logger.info(
        `Provider ${provider.id} received balances: interest=${breakdown.interestAmount} serviceFee=${breakdown.serviceFeeAmount} penalty=${breakdown.penaltyAmount} tax=${breakdown.taxAmount} total=${total}`
      );
      if (total <= 0) {
        skippedProviders++;
        logger.info(`Skipping provider ${provider.id}: nothing to distribute (total=0)`);
        continue;
      }
      const existing = await prisma_default.providerDistribution.findUnique({
        where: {
          providerId_distributionDate: {
            providerId: provider.id,
            distributionDate
          }
        },
        select: { id: true }
      });
      if (existing) {
        alreadyDistributed++;
        logger.warn(`Provider ${provider.id} already has a distribution for ${distributionDateStr}, skipping`);
        continue;
      }
      const externalProviderId = provider.accountNumber ?? provider.id;
      const payload = {
        providerId: externalProviderId,
        distributionDate: distributionDateStr,
        breakdown
      };
      logger.info(`Posting distribution to upstream for provider ${provider.id} -> externalId=${externalProviderId}`);
      const res = await fetch(upstream.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: upstream.auth
        },
        body: JSON.stringify(payload)
      });
      const responseJson = await res.json().catch(() => null);
      if (!res.ok || !isUpstreamSuccess(responseJson)) {
        const details = {
          providerId: provider.id,
          externalProviderId,
          distributionDate: distributionDateStr,
          upstreamStatus: res.status,
          upstreamBody: responseJson
        };
        logger.error(`Upstream failed for provider ${provider.id}: status=${res.status} body=${JSON.stringify(responseJson)}`);
        await createAuditLog({
          actorId: "system",
          action: "PROVIDER_DISTRIBUTION_FAILED",
          entity: "LoanProvider",
          entityId: provider.id,
          details
        });
        errors++;
        continue;
      }
      const distributionReference = String(responseJson?.distributionReference ?? "");
      await prisma_default.$transaction(async (tx) => {
        await tx.providerDistribution.create({
          data: {
            providerId: provider.id,
            externalProviderId,
            distributionDate,
            interestAmount: breakdown.interestAmount,
            serviceFeeAmount: breakdown.serviceFeeAmount,
            penaltyAmount: breakdown.penaltyAmount,
            taxAmount: breakdown.taxAmount,
            totalDistributedAmount: total,
            distributionReference: distributionReference || null
          }
        });
        const updates = [];
        if (interestReceived) updates.push(tx.ledgerAccount.update({ where: { id: interestReceived.id }, data: { balance: 0 } }));
        if (serviceFeeReceived) updates.push(tx.ledgerAccount.update({ where: { id: serviceFeeReceived.id }, data: { balance: 0 } }));
        if (penaltyReceived) updates.push(tx.ledgerAccount.update({ where: { id: penaltyReceived.id }, data: { balance: 0 } }));
        if (taxReceived) updates.push(tx.ledgerAccount.update({ where: { id: taxReceived.id }, data: { balance: 0 } }));
        await Promise.all(updates);
      });
      await createAuditLog({
        actorId: "system",
        action: "PROVIDER_DISTRIBUTION_SUCCESS",
        entity: "LoanProvider",
        entityId: provider.id,
        details: {
          providerId: provider.id,
          externalProviderId,
          distributionDate: distributionDateStr,
          breakdown,
          totalDistributedAmount: total,
          distributionReference: distributionReference || null
        }
      });
      logger.info(`Provider ${provider.id} distribution succeeded total=${total} ref=${distributionReference || "n/a"}`);
      processedProviders++;
    } catch (e) {
      errors++;
      logger.error(`Provider ${provider.id} distribution error: ${String(e?.message ?? e)}`);
      await createAuditLog({
        actorId: "system",
        action: "PROVIDER_DISTRIBUTION_ERROR",
        entity: "LoanProvider",
        entityId: provider.id,
        details: {
          providerId: provider.id,
          distributionDate: distributionDateStr,
          error: String(e?.message ?? e)
        }
      });
    }
  }
  const result = {
    distributionDate: distributionDateStr,
    processedProviders,
    skippedProviders,
    alreadyDistributed,
    errors
  };
  logger.info(`Provider distribution run finished: ${JSON.stringify(result)}`);
  return result;
}

// src/worker.ts
var REPAYMENT_INTERVAL_MS = 60 * 60 * 1e3;
var PROVIDER_DISTRIBUTION_INTERVAL_MS = 24 * 60 * 60 * 1e3;
async function runRepaymentServiceLoop() {
  while (true) {
    try {
      try {
        await sendDueDateReminders();
        logger.info("Due date reminders completed");
      } catch (e) {
        console.error(`[${(/* @__PURE__ */ new Date()).toISOString()}] Error sending due-date reminders:`, e);
        logger.error(`Error sending due-date reminders: ${String(e)}`);
      }
      await processAutomatedRepayments();
      logger.info("Automated repayments cycle completed");
    } catch (error) {
      console.error(`[${(/* @__PURE__ */ new Date()).toISOString()}] An error occurred during the repayment cycle:`, error);
      logger.error(`Error during repayment cycle: ${String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, REPAYMENT_INTERVAL_MS));
  }
}
async function runProviderDistributionServiceLoop() {
  while (true) {
    try {
      logger.info("Starting provider distribution scheduled run");
      await runProviderDistributionOnce();
      logger.info("Provider distribution scheduled run finished");
    } catch (error) {
      console.error(`[${(/* @__PURE__ */ new Date()).toISOString()}] Error during provider distribution cycle:`, error);
      logger.error(`Error during provider distribution cycle: ${String(error)}`);
    }
    logger.info(`Provider distribution service sleeping for ${Math.round(PROVIDER_DISTRIBUTION_INTERVAL_MS / (60 * 60 * 1e3))}h`);
    await new Promise((resolve) => setTimeout(resolve, PROVIDER_DISTRIBUTION_INTERVAL_MS));
  }
}
async function main() {
  const task = process.argv[2];
  if (!task) {
    console.error("Error: No task specified.");
    process.exit(1);
  }
  logger.info(`Worker started task=${task}`);
  try {
    switch (task) {
      case "repayment-service":
        await runRepaymentServiceLoop();
        break;
      case "provider-distribution-service":
        logger.info("Starting provider-distribution-service long-running loop");
        await runProviderDistributionServiceLoop();
        break;
      case "provider-distribution":
        logger.info("Running one-off provider-distribution");
        await runProviderDistributionOnce();
        logger.info("One-off provider-distribution finished");
        process.exit(0);
        break;
      case "npl":
        await updateNplStatus();
        process.exit(0);
        break;
      default:
        console.error(`Error: Unknown task "${task}".`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[${(/* @__PURE__ */ new Date()).toISOString()}] Error executing task "${task}":`, error);
    process.exit(1);
  }
}
main();
