import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface DurationParts {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function secondsToParts(totalSeconds: number): DurationParts {
  const abs = Math.abs(totalSeconds);
  const years = Math.floor(abs / 31536000);
  const days = Math.floor((abs % 31536000) / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = Math.floor(abs % 60);
  return { years, days, hours, minutes, seconds };
}

function formatDuration(totalSeconds: number, style: "short" | "long" = "short"): string {
  const negative = totalSeconds < 0;
  const parts = secondsToParts(totalSeconds);
  const segments: string[] = [];

  if (style === "short") {
    if (parts.years > 0) segments.push(`${parts.years}y`);
    if (parts.days > 0) segments.push(`${parts.days}d`);
    if (parts.hours > 0) segments.push(`${parts.hours}h`);
    if (parts.minutes > 0) segments.push(`${parts.minutes}m`);
    if (parts.seconds > 0 || segments.length === 0) segments.push(`${parts.seconds}s`);
  } else {
    if (parts.years > 0) segments.push(`${parts.years} year${parts.years !== 1 ? "s" : ""}`);
    if (parts.days > 0) segments.push(`${parts.days} day${parts.days !== 1 ? "s" : ""}`);
    if (parts.hours > 0) segments.push(`${parts.hours} hour${parts.hours !== 1 ? "s" : ""}`);
    if (parts.minutes > 0) segments.push(`${parts.minutes} minute${parts.minutes !== 1 ? "s" : ""}`);
    if (parts.seconds > 0 || segments.length === 0) segments.push(`${parts.seconds} second${parts.seconds !== 1 ? "s" : ""}`);
  }

  return (negative ? "-" : "") + segments.join(" ");
}

function parseHumanDuration(input: string): number | null {
  const normalized = input.toLowerCase().trim();
  let totalSeconds = 0;
  let matched = false;

  const patterns: [RegExp, number][] = [
    [/(\d+(?:\.\d+)?)\s*(?:years?|y)\b/g, 31536000],
    [/(\d+(?:\.\d+)?)\s*(?:weeks?|w)\b/g, 604800],
    [/(\d+(?:\.\d+)?)\s*(?:days?|d)\b/g, 86400],
    [/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/g, 3600],
    [/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/g, 60],
    [/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/g, 1],
  ];

  for (const [regex, multiplier] of patterns) {
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      totalSeconds += parseFloat(match[1]!) * multiplier;
      matched = true;
    }
  }

  return matched ? Math.round(totalSeconds) : null;
}

function timeAgo(date: Date, referenceDate?: Date): string {
  const now = referenceDate || new Date();
  const diffMs = now.getTime() - date.getTime();
  const future = diffMs < 0;
  const absDiff = Math.abs(diffMs) / 1000;

  if (absDiff < 5) return "just now";
  if (absDiff < 60) return future ? `in ${Math.floor(absDiff)} seconds` : `${Math.floor(absDiff)} seconds ago`;
  if (absDiff < 3600) {
    const mins = Math.floor(absDiff / 60);
    return future ? `in ${mins} minute${mins !== 1 ? "s" : ""}` : `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  }
  if (absDiff < 86400) {
    const hrs = Math.floor(absDiff / 3600);
    return future ? `in ${hrs} hour${hrs !== 1 ? "s" : ""}` : `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  }
  if (absDiff < 2592000) {
    const days = Math.floor(absDiff / 86400);
    return future ? `in ${days} day${days !== 1 ? "s" : ""}` : `${days} day${days !== 1 ? "s" : ""} ago`;
  }
  if (absDiff < 31536000) {
    const months = Math.floor(absDiff / 2592000);
    return future ? `in ${months} month${months !== 1 ? "s" : ""}` : `${months} month${months !== 1 ? "s" : ""} ago`;
  }

  const years = Math.floor(absDiff / 31536000);
  return future ? `in ${years} year${years !== 1 ? "s" : ""}` : `${years} year${years !== 1 ? "s" : ""} ago`;
}

export function registerDurationFormatterTools(server: McpServer): void {
  server.tool(
    "format_duration",
    "Convert seconds to human-readable duration (e.g. 2h 30m 15s)",
    {
      seconds: z.number().describe("Duration in seconds"),
      style: z.enum(["short", "long"]).default("short").describe("Output style: 'short' (2h 30m) or 'long' (2 hours 30 minutes)"),
    },
    async ({ seconds, style }) => {
      const parts = secondsToParts(seconds);

      const lines = [
        `Input: ${seconds} seconds`,
        ``,
        `Formatted (${style}): ${formatDuration(seconds, style)}`,
        ``,
        `Breakdown:`,
        `  Years:   ${parts.years}`,
        `  Days:    ${parts.days}`,
        `  Hours:   ${parts.hours}`,
        `  Minutes: ${parts.minutes}`,
        `  Seconds: ${parts.seconds}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "parse_duration",
    "Parse a human-readable duration string to seconds (e.g. '2h 30m', '1 day 3 hours')",
    {
      duration: z.string().describe("Human-readable duration (e.g. '2h 30m 15s', '1 day 3 hours', '90 minutes')"),
    },
    async ({ duration }) => {
      const totalSeconds = parseHumanDuration(duration);

      if (totalSeconds === null) {
        return {
          content: [{
            type: "text",
            text: [
              `Could not parse duration: "${duration}"`,
              ``,
              `Supported units: years/y, weeks/w, days/d, hours/h, minutes/m/min, seconds/s/sec`,
              `Examples: "2h 30m", "1 day 3 hours", "90 minutes", "1y 6d"`,
            ].join("\n"),
          }],
        };
      }

      const lines = [
        `Input: ${duration}`,
        ``,
        `Total seconds:      ${totalSeconds}`,
        `Total minutes:      ${(totalSeconds / 60).toFixed(2)}`,
        `Total hours:        ${(totalSeconds / 3600).toFixed(2)}`,
        `Total days:         ${(totalSeconds / 86400).toFixed(4)}`,
        ``,
        `Formatted (short):  ${formatDuration(totalSeconds, "short")}`,
        `Formatted (long):   ${formatDuration(totalSeconds, "long")}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "time_ago",
    "Calculate relative time description (e.g. '5 minutes ago', 'in 3 hours')",
    {
      datetime: z.string().describe("Target date/time (ISO 8601)"),
      reference: z.string().optional().describe("Reference date/time (ISO 8601). Defaults to now."),
    },
    async ({ datetime, reference }) => {
      const target = new Date(datetime);
      if (isNaN(target.getTime())) {
        return { content: [{ type: "text", text: `Invalid datetime: ${datetime}` }] };
      }

      const ref = reference ? new Date(reference) : new Date();
      if (reference && isNaN(ref.getTime())) {
        return { content: [{ type: "text", text: `Invalid reference datetime: ${reference}` }] };
      }

      const diffMs = ref.getTime() - target.getTime();
      const diffSeconds = Math.abs(Math.round(diffMs / 1000));

      const lines = [
        `Target:    ${target.toISOString()}`,
        `Reference: ${ref.toISOString()}`,
        ``,
        `Relative:  ${timeAgo(target, ref)}`,
        `Duration:  ${formatDuration(diffSeconds, "long")}`,
        `Seconds:   ${diffSeconds}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "countdown",
    "Calculate time remaining until a target date/time",
    {
      target: z.string().describe("Target date/time (ISO 8601)"),
      from: z.string().optional().describe("Starting date/time (ISO 8601). Defaults to now."),
    },
    async ({ target: targetStr, from }) => {
      const targetDate = new Date(targetStr);
      if (isNaN(targetDate.getTime())) {
        return { content: [{ type: "text", text: `Invalid target datetime: ${targetStr}` }] };
      }

      const fromDate = from ? new Date(from) : new Date();
      if (from && isNaN(fromDate.getTime())) {
        return { content: [{ type: "text", text: `Invalid from datetime: ${from}` }] };
      }

      const diffMs = targetDate.getTime() - fromDate.getTime();
      const diffSeconds = Math.round(diffMs / 1000);
      const isPast = diffSeconds < 0;

      const parts = secondsToParts(diffSeconds);

      const lines = [
        `From:   ${fromDate.toISOString()}`,
        `Target: ${targetDate.toISOString()}`,
        ``,
        isPast ? `Target was ${formatDuration(Math.abs(diffSeconds), "long")} ago` : `Time remaining: ${formatDuration(diffSeconds, "long")}`,
        ``,
        `Breakdown:`,
        `  Years:   ${parts.years}`,
        `  Days:    ${parts.days}`,
        `  Hours:   ${parts.hours}`,
        `  Minutes: ${parts.minutes}`,
        `  Seconds: ${parts.seconds}`,
        ``,
        `Total seconds: ${Math.abs(diffSeconds)}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
