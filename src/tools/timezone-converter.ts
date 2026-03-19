import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Fiji",
];

function formatInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  }).format(date);
}

function getOffsetMinutes(date: Date, timezone: string): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function registerTimezoneTools(server: McpServer): void {
  server.tool(
    "convert_timezone",
    "Convert a date/time from one timezone to another",
    {
      datetime: z.string().describe("Date/time string (ISO 8601 or common formats, e.g. 2025-06-15T14:30:00)"),
      from_timezone: z.string().describe("Source timezone (e.g. America/New_York)"),
      to_timezone: z.string().describe("Target timezone (e.g. Asia/Tokyo)"),
    },
    async ({ datetime, from_timezone, to_timezone }) => {
      if (!isValidTimezone(from_timezone)) {
        return { content: [{ type: "text", text: `Invalid source timezone: ${from_timezone}` }] };
      }
      if (!isValidTimezone(to_timezone)) {
        return { content: [{ type: "text", text: `Invalid target timezone: ${to_timezone}` }] };
      }

      // Parse the datetime as if it were in the source timezone
      const inputDate = new Date(datetime);
      if (isNaN(inputDate.getTime())) {
        return { content: [{ type: "text", text: `Invalid datetime: ${datetime}` }] };
      }

      // Adjust: treat input as from_timezone local time
      const fromOffset = getOffsetMinutes(inputDate, from_timezone);
      const utcMs = inputDate.getTime() - fromOffset * 60000;
      // If the input string has no timezone info, adjust accordingly
      const hasTimezoneInfo = /[Zz]|[+-]\d{2}:\d{2}/.test(datetime);
      const referenceDate = hasTimezoneInfo ? inputDate : new Date(utcMs);

      const fromFormatted = formatInTimezone(referenceDate, from_timezone);
      const toFormatted = formatInTimezone(referenceDate, to_timezone);

      const fromOff = getOffsetMinutes(referenceDate, from_timezone);
      const toOff = getOffsetMinutes(referenceDate, to_timezone);
      const diffHours = (toOff - fromOff) / 60;

      const result = [
        `Source: ${fromFormatted} (${from_timezone})`,
        `Target: ${toFormatted} (${to_timezone})`,
        `Offset difference: ${diffHours >= 0 ? "+" : ""}${diffHours} hours`,
      ].join("\n");

      return { content: [{ type: "text", text: result }] };
    }
  );

  server.tool(
    "list_timezones",
    "List common timezones with their current UTC offsets",
    {
      filter: z.string().optional().describe("Optional filter string to match timezone names (case-insensitive)"),
    },
    async ({ filter }) => {
      const now = new Date();
      let zones = COMMON_TIMEZONES;
      if (filter) {
        const lowerFilter = filter.toLowerCase();
        zones = zones.filter((tz) => tz.toLowerCase().includes(lowerFilter));
      }

      const lines = zones.map((tz) => {
        const offset = getOffsetMinutes(now, tz);
        return `${tz.padEnd(35)} UTC${formatOffset(offset)}`;
      });

      if (lines.length === 0) {
        return { content: [{ type: "text", text: "No timezones matched the filter." }] };
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "current_time_multi",
    "Show current time in multiple timezones at once",
    {
      timezones: z.array(z.string()).describe("List of timezone identifiers (e.g. ['America/New_York', 'Asia/Tokyo'])"),
    },
    async ({ timezones }) => {
      const now = new Date();
      const lines: string[] = [];

      for (const tz of timezones) {
        if (!isValidTimezone(tz)) {
          lines.push(`${tz}: INVALID TIMEZONE`);
          continue;
        }
        lines.push(`${tz.padEnd(35)} ${formatInTimezone(now, tz)}`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "time_difference",
    "Calculate the time difference between two timezones",
    {
      timezone_a: z.string().describe("First timezone (e.g. America/New_York)"),
      timezone_b: z.string().describe("Second timezone (e.g. Asia/Tokyo)"),
    },
    async ({ timezone_a, timezone_b }) => {
      if (!isValidTimezone(timezone_a)) {
        return { content: [{ type: "text", text: `Invalid timezone: ${timezone_a}` }] };
      }
      if (!isValidTimezone(timezone_b)) {
        return { content: [{ type: "text", text: `Invalid timezone: ${timezone_b}` }] };
      }

      const now = new Date();
      const offsetA = getOffsetMinutes(now, timezone_a);
      const offsetB = getOffsetMinutes(now, timezone_b);
      const diffMinutes = offsetB - offsetA;
      const diffHours = diffMinutes / 60;

      const result = [
        `${timezone_a}: UTC${formatOffset(offsetA)}`,
        `${timezone_b}: UTC${formatOffset(offsetB)}`,
        ``,
        `Difference: ${diffHours >= 0 ? "+" : ""}${diffHours} hours (${diffMinutes >= 0 ? "+" : ""}${diffMinutes} minutes)`,
        ``,
        `When it's noon in ${timezone_a}, it's ${formatInTimezone(new Date("2025-01-15T12:00:00Z"), timezone_b)} in ${timezone_b}`,
      ].join("\n");

      return { content: [{ type: "text", text: result }] };
    }
  );
}
