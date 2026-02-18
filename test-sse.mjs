import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import * as EventSourceLib from 'eventsource';

const EventSource = EventSourceLib.default || EventSourceLib.EventSource || EventSourceLib;
global.EventSource = EventSource;

console.log("Connecting to http://localhost:3000/sse...");
const transport = new SSEClientTransport(new URL("http://localhost:3000/sse"));
const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
);

try {
    await client.connect(transport);
    console.log("✅ Connected!");

    const tools = await client.listTools();
    console.log("✅ Listed tools:", tools.tools.map(t => t.name).join(", "));

    await client.close();
    console.log("✅ All good!");
    process.exit(0);
} catch (error) {
    console.error("❌ FAILED:", error.message);
    process.exit(1);
}
