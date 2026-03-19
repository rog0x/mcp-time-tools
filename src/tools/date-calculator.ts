import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function parseDate(input: string): Date | null {
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function addToDate(date: Date, amount: number, unit: string): Date {
  const result = new Date(date);
  switch (unit) {
    case "days":
      result.setDate(result.getDate() + amount);
      break;
    case "weeks":
      result.setDate(result.getDate() + amount * 7);
      break;
    case "months":
      result.setMonth(result.getMonth() + amount);
      break;
    case "years":
      result.setFullYear(result.getFullYear() + amount);
      break;
  }
  return result;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  const forward = start <= end;

  if (!forward) {
    return -countBusinessDays(end, start);
  }

  current.setDate(current.getDate() + 1); // exclude start date
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;

  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (!isWeekend(result)) {
      remaining--;
    }
  }
  return result;
}

export function registerDateCalculatorTools(server: McpServer): void {
  server.tool(
    "date_add_subtract",
    "Add or subtract days, weeks, months, or years from a date",
    {
      date: z.string().describe("Starting date (ISO 8601, e.g. 2025-06-15)"),
      amount: z.number().describe("Amount to add (positive) or subtract (negative)"),
      unit: z.enum(["days", "weeks", "months", "years"]).describe("Unit of time"),
    },
    async ({ date, amount, unit }) => {
      const d = parseDate(date);
      if (!d) {
        return { content: [{ type: "text", text: `Invalid date: ${date}` }] };
      }

      const result = addToDate(d, amount, unit);
      const dayName = result.toLocaleDateString("en-US", { weekday: "long" });

      const text = [
        `Start date:  ${formatDate(d)}`,
        `Operation:   ${amount >= 0 ? "+" : ""}${amount} ${unit}`,
        `Result date: ${formatDate(result)} (${dayName})`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "date_difference",
    "Calculate the difference between two dates in various units",
    {
      date_a: z.string().describe("First date (ISO 8601, e.g. 2025-01-01)"),
      date_b: z.string().describe("Second date (ISO 8601, e.g. 2025-12-31)"),
    },
    async ({ date_a, date_b }) => {
      const a = parseDate(date_a);
      const b = parseDate(date_b);
      if (!a) return { content: [{ type: "text", text: `Invalid date: ${date_a}` }] };
      if (!b) return { content: [{ type: "text", text: `Invalid date: ${date_b}` }] };

      const diffMs = b.getTime() - a.getTime();
      const totalDays = Math.round(diffMs / 86400000);
      const totalWeeks = totalDays / 7;
      const businessDays = countBusinessDays(a, b);

      // Calculate months and years difference
      let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
      if (b.getDate() < a.getDate()) months--;
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;

      const text = [
        `From: ${formatDate(a)}`,
        `To:   ${formatDate(b)}`,
        ``,
        `Total days:     ${totalDays}`,
        `Total weeks:    ${totalWeeks.toFixed(1)}`,
        `Business days:  ${businessDays}`,
        `Months:         ${months}`,
        `Years + months: ${years} year(s), ${remainingMonths} month(s)`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "business_days",
    "Calculate business days between dates or add business days to a date",
    {
      mode: z.enum(["count", "add"]).describe("'count' to count business days between two dates, 'add' to add business days to a date"),
      start_date: z.string().describe("Start date (ISO 8601)"),
      end_date: z.string().optional().describe("End date (required for 'count' mode)"),
      days: z.number().optional().describe("Number of business days to add (required for 'add' mode, can be negative)"),
    },
    async ({ mode, start_date, end_date, days }) => {
      const start = parseDate(start_date);
      if (!start) return { content: [{ type: "text", text: `Invalid start date: ${start_date}` }] };

      if (mode === "count") {
        if (!end_date) {
          return { content: [{ type: "text", text: "end_date is required for 'count' mode" }] };
        }
        const end = parseDate(end_date);
        if (!end) return { content: [{ type: "text", text: `Invalid end date: ${end_date}` }] };

        const bdays = countBusinessDays(start, end);
        const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000);
        const weekendDays = Math.abs(totalDays) - Math.abs(bdays);

        const text = [
          `From: ${formatDate(start)}`,
          `To:   ${formatDate(end)}`,
          ``,
          `Business days: ${bdays}`,
          `Weekend days:  ${weekendDays}`,
          `Calendar days: ${totalDays}`,
        ].join("\n");

        return { content: [{ type: "text", text }] };
      } else {
        if (days === undefined) {
          return { content: [{ type: "text", text: "days is required for 'add' mode" }] };
        }

        const result = addBusinessDays(start, days);
        const dayName = result.toLocaleDateString("en-US", { weekday: "long" });

        const text = [
          `Start date:     ${formatDate(start)}`,
          `Business days:  ${days >= 0 ? "+" : ""}${days}`,
          `Result date:    ${formatDate(result)} (${dayName})`,
        ].join("\n");

        return { content: [{ type: "text", text }] };
      }
    }
  );
}
