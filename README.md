
# mcp-time-tools

Date, time, and timezone tools for AI agents via the Model Context Protocol (MCP).

Built entirely with native JavaScript `Date` and `Intl` APIs -- no external date libraries required.

## Tools

### Timezone Converter
- **convert_timezone** -- Convert a date/time from one timezone to another
- **list_timezones** -- List common timezones with current UTC offsets
- **current_time_multi** -- Show current time in multiple timezones at once
- **time_difference** -- Calculate the time difference between two timezones

### Date Calculator
- **date_add_subtract** -- Add or subtract days, weeks, months, or years from a date
- **date_difference** -- Calculate the difference between two dates in various units
- **business_days** -- Count business days between dates or add business days to a date

### Cron Parser
- **parse_cron** -- Parse a cron expression into a human-readable description
- **cron_next_runs** -- Calculate the next N execution times for a cron expression
- **validate_cron** -- Validate a cron expression and explain any errors
- **generate_cron** -- Generate a cron expression from a human-readable description

### Timestamp Converter
- **timestamp_to_date** -- Convert Unix timestamp (seconds or milliseconds) to readable formats
- **date_to_timestamp** -- Convert a date/time string to Unix timestamps
- **current_timestamp** -- Get the current Unix timestamp and formatted date/time

### Duration Formatter
- **format_duration** -- Convert seconds to human-readable duration (e.g. 2h 30m 15s)
- **parse_duration** -- Parse a human-readable duration string to seconds
- **time_ago** -- Calculate relative time description (e.g. "5 minutes ago")
- **countdown** -- Calculate time remaining until a target date/time

## Setup

```bash
npm install
npm run build
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "time-tools": {
      "command": "node",
      "args": ["D:/products/mcp-servers/mcp-time-tools/dist/index.js"]
    }
  }
}
```

## Development

```bash
npm install
npm run build
npm start
```
