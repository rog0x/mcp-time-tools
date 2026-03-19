import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

function parseCronExpression(expr: string): CronFields | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return {
    minute: parts[0]!,
    hour: parts[1]!,
    dayOfMonth: parts[2]!,
    month: parts[3]!,
    dayOfWeek: parts[4]!,
  };
}

function expandField(field: string, min: number, max: number): number[] | null {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    let range: string;
    let step = 1;

    if (stepMatch) {
      range = stepMatch[1]!;
      step = parseInt(stepMatch[2]!, 10);
      if (isNaN(step) || step < 1) return null;
    } else {
      range = part;
    }

    if (range === "*") {
      for (let i = min; i <= max; i += step) values.add(i);
    } else {
      const rangeMatch = range.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]!, 10);
        const end = parseInt(rangeMatch[2]!, 10);
        if (isNaN(start) || isNaN(end) || start < min || end > max) return null;
        for (let i = start; i <= end; i += step) values.add(i);
      } else {
        const val = parseInt(range, 10);
        if (isNaN(val) || val < min || val > max) return null;
        if (stepMatch) {
          for (let i = val; i <= max; i += step) values.add(i);
        } else {
          values.add(val);
        }
      }
    }
  }

  return [...values].sort((a, b) => a - b);
}

function validateCron(expr: string): { valid: boolean; error?: string; fields?: CronFields } {
  const fields = parseCronExpression(expr);
  if (!fields) return { valid: false, error: "Expected 5 space-separated fields: minute hour day-of-month month day-of-week" };

  if (!expandField(fields.minute, 0, 59)) return { valid: false, error: `Invalid minute field: ${fields.minute}` };
  if (!expandField(fields.hour, 0, 23)) return { valid: false, error: `Invalid hour field: ${fields.hour}` };
  if (!expandField(fields.dayOfMonth, 1, 31)) return { valid: false, error: `Invalid day-of-month field: ${fields.dayOfMonth}` };
  if (!expandField(fields.month, 1, 12)) return { valid: false, error: `Invalid month field: ${fields.month}` };
  if (!expandField(fields.dayOfWeek, 0, 6)) return { valid: false, error: `Invalid day-of-week field: ${fields.dayOfWeek}` };

  return { valid: true, fields };
}

function describeField(field: string, min: number, max: number, names?: string[]): string {
  if (field === "*") return "every";

  const parts: string[] = [];
  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    if (stepMatch) {
      const base = stepMatch[1]!;
      const step = stepMatch[2]!;
      if (base === "*") {
        parts.push(`every ${step}`);
      } else {
        parts.push(`every ${step} starting at ${names ? names[parseInt(base, 10)] ?? base : base}`);
      }
    } else {
      const rangeMatch = part.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const s = names ? names[parseInt(rangeMatch[1]!, 10)] ?? rangeMatch[1]! : rangeMatch[1]!;
        const e = names ? names[parseInt(rangeMatch[2]!, 10)] ?? rangeMatch[2]! : rangeMatch[2]!;
        parts.push(`${s} through ${e}`);
      } else {
        const val = parseInt(part, 10);
        parts.push(names ? names[val] ?? part : part);
      }
    }
  }
  return parts.join(", ");
}

function cronToHumanReadable(expr: string): string {
  const fields = parseCronExpression(expr);
  if (!fields) return "Invalid cron expression";

  const parts: string[] = [];

  // Minute
  if (fields.minute === "*") {
    parts.push("Every minute");
  } else if (fields.minute.includes("/")) {
    const step = fields.minute.split("/")[1];
    parts.push(`Every ${step} minutes`);
  } else {
    parts.push(`At minute ${fields.minute}`);
  }

  // Hour
  if (fields.hour !== "*") {
    if (fields.hour.includes("/")) {
      const step = fields.hour.split("/")[1];
      parts.push(`every ${step} hours`);
    } else {
      const hours = fields.hour.split(",").map((h) => {
        const n = parseInt(h, 10);
        return `${String(n).padStart(2, "0")}:00`;
      });
      parts.push(`past hour ${hours.join(", ")}`);
    }
  }

  // Day of month
  if (fields.dayOfMonth !== "*") {
    parts.push(`on day ${fields.dayOfMonth} of the month`);
  }

  // Month
  if (fields.month !== "*") {
    const desc = describeField(fields.month, 1, 12, MONTH_NAMES);
    parts.push(`in ${desc}`);
  }

  // Day of week
  if (fields.dayOfWeek !== "*") {
    const desc = describeField(fields.dayOfWeek, 0, 6, DAY_NAMES);
    parts.push(`on ${desc}`);
  }

  return parts.join(", ");
}

function getNextExecutions(expr: string, count: number, fromDate?: Date): Date[] {
  const fields = parseCronExpression(expr);
  if (!fields) return [];

  const minutes = expandField(fields.minute, 0, 59);
  const hours = expandField(fields.hour, 0, 23);
  const daysOfMonth = expandField(fields.dayOfMonth, 1, 31);
  const months = expandField(fields.month, 1, 12);
  const daysOfWeek = expandField(fields.dayOfWeek, 0, 6);

  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) return [];

  const results: Date[] = [];
  const current = fromDate ? new Date(fromDate) : new Date();
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  const maxIterations = 525960; // ~1 year of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;
    const m = current.getMonth() + 1;
    const dom = current.getDate();
    const dow = current.getDay();
    const h = current.getHours();
    const min = current.getMinutes();

    if (
      months.includes(m) &&
      daysOfMonth.includes(dom) &&
      daysOfWeek.includes(dow) &&
      hours.includes(h) &&
      minutes.includes(min)
    ) {
      results.push(new Date(current));
    }

    current.setMinutes(current.getMinutes() + 1);
  }

  return results;
}

export function registerCronParserTools(server: McpServer): void {
  server.tool(
    "parse_cron",
    "Parse a cron expression into a human-readable description",
    {
      expression: z.string().describe("Cron expression (5 fields: minute hour day-of-month month day-of-week)"),
    },
    async ({ expression }) => {
      const validation = validateCron(expression);
      if (!validation.valid) {
        return { content: [{ type: "text", text: `Invalid cron expression: ${validation.error}` }] };
      }

      const description = cronToHumanReadable(expression);
      const text = [
        `Expression: ${expression}`,
        `Description: ${description}`,
        ``,
        `Fields:`,
        `  Minute:       ${validation.fields!.minute}`,
        `  Hour:         ${validation.fields!.hour}`,
        `  Day of month: ${validation.fields!.dayOfMonth}`,
        `  Month:        ${validation.fields!.month}`,
        `  Day of week:  ${validation.fields!.dayOfWeek}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "cron_next_runs",
    "Calculate the next N execution times for a cron expression",
    {
      expression: z.string().describe("Cron expression (5 fields)"),
      count: z.number().min(1).max(50).default(5).describe("Number of next executions to show (max 50)"),
      from: z.string().optional().describe("Starting datetime (ISO 8601). Defaults to now."),
    },
    async ({ expression, count, from }) => {
      const validation = validateCron(expression);
      if (!validation.valid) {
        return { content: [{ type: "text", text: `Invalid cron expression: ${validation.error}` }] };
      }

      const fromDate = from ? new Date(from) : undefined;
      if (from && fromDate && isNaN(fromDate.getTime())) {
        return { content: [{ type: "text", text: `Invalid from date: ${from}` }] };
      }

      const executions = getNextExecutions(expression, count, fromDate);

      if (executions.length === 0) {
        return { content: [{ type: "text", text: "No executions found within the search window." }] };
      }

      const lines = [
        `Cron: ${expression}`,
        `Description: ${cronToHumanReadable(expression)}`,
        ``,
        `Next ${executions.length} execution(s):`,
        ...executions.map((d, i) => `  ${i + 1}. ${d.toISOString()}`),
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "validate_cron",
    "Validate a cron expression and explain any errors",
    {
      expression: z.string().describe("Cron expression to validate"),
    },
    async ({ expression }) => {
      const validation = validateCron(expression);

      if (validation.valid) {
        const text = [
          `Expression: ${expression}`,
          `Status: VALID`,
          `Description: ${cronToHumanReadable(expression)}`,
        ].join("\n");
        return { content: [{ type: "text", text }] };
      } else {
        const text = [
          `Expression: ${expression}`,
          `Status: INVALID`,
          `Error: ${validation.error}`,
          ``,
          `Expected format: * * * * *`,
          `Fields: minute(0-59) hour(0-23) day-of-month(1-31) month(1-12) day-of-week(0-6, 0=Sunday)`,
          `Operators: * (any), , (list), - (range), / (step)`,
        ].join("\n");
        return { content: [{ type: "text", text }] };
      }
    }
  );

  server.tool(
    "generate_cron",
    "Generate a cron expression from a human-readable description",
    {
      description: z.string().describe("Human-readable schedule description (e.g. 'every weekday at 9am', 'every 5 minutes', 'first day of month at midnight')"),
    },
    async ({ description }) => {
      const desc = description.toLowerCase().trim();
      let expression = "";
      let explanation = "";

      if (/every\s+(\d+)\s+minutes?/.test(desc)) {
        const m = desc.match(/every\s+(\d+)\s+minutes?/)!;
        expression = `*/${m[1]} * * * *`;
        explanation = `Runs every ${m[1]} minutes`;
      } else if (/every\s+(\d+)\s+hours?/.test(desc)) {
        const m = desc.match(/every\s+(\d+)\s+hours?/)!;
        expression = `0 */${m[1]} * * *`;
        explanation = `Runs every ${m[1]} hours at minute 0`;
      } else if (/every\s+minute/.test(desc)) {
        expression = "* * * * *";
        explanation = "Runs every minute";
      } else if (/every\s+hour/.test(desc)) {
        expression = "0 * * * *";
        explanation = "Runs at the start of every hour";
      } else if (/every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/.test(desc)) {
        const m = desc.match(/every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/)!;
        let hour = parseInt(m[1]!, 10);
        const minute = m[2] ? parseInt(m[2], 10) : 0;
        if (m[3] === "pm" && hour < 12) hour += 12;
        if (m[3] === "am" && hour === 12) hour = 0;
        expression = `${minute} ${hour} * * *`;
        explanation = `Runs daily at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      } else if (/weekday|mon.*fri/i.test(desc)) {
        const timeMatch = desc.match(/at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/);
        let hour = 9, minute = 0;
        if (timeMatch) {
          hour = parseInt(timeMatch[1]!, 10);
          minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          if (timeMatch[3] === "pm" && hour < 12) hour += 12;
          if (timeMatch[3] === "am" && hour === 12) hour = 0;
        }
        expression = `${minute} ${hour} * * 1-5`;
        explanation = `Runs Monday through Friday at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      } else if (/midnight/.test(desc)) {
        if (/first\s+day\s+of\s+(the\s+)?month/.test(desc)) {
          expression = "0 0 1 * *";
          explanation = "Runs at midnight on the 1st of every month";
        } else {
          expression = "0 0 * * *";
          explanation = "Runs at midnight every day";
        }
      } else if (/noon/.test(desc)) {
        expression = "0 12 * * *";
        explanation = "Runs at noon every day";
      } else if (/first\s+day\s+of\s+(the\s+)?month/.test(desc)) {
        const timeMatch = desc.match(/at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/);
        let hour = 0, minute = 0;
        if (timeMatch) {
          hour = parseInt(timeMatch[1]!, 10);
          minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          if (timeMatch[3] === "pm" && hour < 12) hour += 12;
          if (timeMatch[3] === "am" && hour === 12) hour = 0;
        }
        expression = `${minute} ${hour} 1 * *`;
        explanation = `Runs on the 1st of every month at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      } else if (/sunday|monday|tuesday|wednesday|thursday|friday|saturday/.test(desc)) {
        const dayMap: Record<string, number> = {
          sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
          thursday: 4, friday: 5, saturday: 6,
        };
        let dow = 0;
        for (const [name, num] of Object.entries(dayMap)) {
          if (desc.includes(name)) { dow = num; break; }
        }
        const timeMatch = desc.match(/at\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/);
        let hour = 0, minute = 0;
        if (timeMatch) {
          hour = parseInt(timeMatch[1]!, 10);
          minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          if (timeMatch[3] === "pm" && hour < 12) hour += 12;
          if (timeMatch[3] === "am" && hour === 12) hour = 0;
        }
        expression = `${minute} ${hour} * * ${dow}`;
        explanation = `Runs every ${DAY_NAMES[dow]} at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      } else {
        return {
          content: [{
            type: "text",
            text: [
              `Could not parse the description: "${description}"`,
              ``,
              `Supported patterns:`,
              `  - "every N minutes" / "every N hours"`,
              `  - "every minute" / "every hour"`,
              `  - "every day at HH:MM [am/pm]"`,
              `  - "every weekday at HH:MM"`,
              `  - "at midnight" / "at noon"`,
              `  - "first day of month at HH:MM"`,
              `  - "every [dayname] at HH:MM"`,
            ].join("\n"),
          }],
        };
      }

      const text = [
        `Description: ${description}`,
        `Generated cron: ${expression}`,
        `Explanation: ${explanation}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );
}
