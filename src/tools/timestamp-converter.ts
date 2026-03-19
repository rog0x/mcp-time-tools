import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function formatTimestamp(date: Date, timezone?: string): Record<string, string> {
  const tz = timezone || "UTC";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });

  return {
    iso8601: date.toISOString(),
    unix_seconds: String(Math.floor(date.getTime() / 1000)),
    unix_milliseconds: String(date.getTime()),
    human_readable: formatter.format(date),
    date_only: date.toISOString().split("T")[0]!,
    time_only: date.toISOString().split("T")[1]!.replace("Z", ""),
  };
}

export function registerTimestampConverterTools(server: McpServer): void {
  server.tool(
    "timestamp_to_date",
    "Convert a Unix timestamp (seconds or milliseconds) to human-readable date formats",
    {
      timestamp: z.number().describe("Unix timestamp (auto-detects seconds vs milliseconds)"),
      timezone: z.string().optional().describe("Target timezone for display (default: UTC)"),
    },
    async ({ timestamp, timezone }) => {
      // Auto-detect seconds vs milliseconds
      // Timestamps in seconds are typically 10 digits, milliseconds are 13 digits
      let ms: number;
      if (timestamp > 1e12) {
        ms = timestamp;
      } else {
        ms = timestamp * 1000;
      }

      const date = new Date(ms);
      if (isNaN(date.getTime())) {
        return { content: [{ type: "text", text: `Invalid timestamp: ${timestamp}` }] };
      }

      const formats = formatTimestamp(date, timezone);
      const detectedUnit = timestamp > 1e12 ? "milliseconds" : "seconds";

      const lines = [
        `Input: ${timestamp} (detected as ${detectedUnit})`,
        ``,
        `ISO 8601:          ${formats.iso8601}`,
        `Human readable:    ${formats.human_readable}`,
        `Date:              ${formats.date_only}`,
        `Time:              ${formats.time_only}`,
        `Unix (seconds):    ${formats.unix_seconds}`,
        `Unix (ms):         ${formats.unix_milliseconds}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "date_to_timestamp",
    "Convert a date/time string to Unix timestamps",
    {
      datetime: z.string().describe("Date/time string (ISO 8601 or common formats)"),
    },
    async ({ datetime }) => {
      const date = new Date(datetime);
      if (isNaN(date.getTime())) {
        return { content: [{ type: "text", text: `Invalid datetime: ${datetime}` }] };
      }

      const formats = formatTimestamp(date);

      const lines = [
        `Input: ${datetime}`,
        ``,
        `Unix timestamp (seconds):      ${formats.unix_seconds}`,
        `Unix timestamp (milliseconds): ${formats.unix_milliseconds}`,
        `ISO 8601:                      ${formats.iso8601}`,
        `Human readable:                ${formats.human_readable}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "current_timestamp",
    "Get the current Unix timestamp and formatted date/time",
    {
      timezone: z.string().optional().describe("Timezone for display (default: UTC)"),
    },
    async ({ timezone }) => {
      const now = new Date();
      const formats = formatTimestamp(now, timezone);

      const lines = [
        `Current time:`,
        ``,
        `ISO 8601:          ${formats.iso8601}`,
        `Human readable:    ${formats.human_readable}`,
        `Unix (seconds):    ${formats.unix_seconds}`,
        `Unix (ms):         ${formats.unix_milliseconds}`,
        `Date:              ${formats.date_only}`,
        `Time:              ${formats.time_only}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
