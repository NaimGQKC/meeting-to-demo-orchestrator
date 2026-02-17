# Meeting-to-Demo Orchestrator

This is the MCP server that manages the pipeline.

## Running in Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Architecture

- `src/server.ts`: MCP Server entry point.
- `src/state-machine.ts`: Pipeline state logic.
- `src/clean-room.ts`: Data scrubber utility.
