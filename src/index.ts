import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTimezoneTools } from "./tools/timezone-converter.js";
import { registerDateCalculatorTools } from "./tools/date-calculator.js";
import { registerCronParserTools } from "./tools/cron-parser.js";
import { registerTimestampConverterTools } from "./tools/timestamp-converter.js";
import { registerDurationFormatterTools } from "./tools/duration-formatter.js";

const server = new McpServer({
  name: "mcp-time-tools",
  version: "1.0.0",
});

// Register all tool groups
registerTimezoneTools(server);
registerDateCalculatorTools(server);
registerCronParserTools(server);
registerTimestampConverterTools(server);
registerDurationFormatterTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
