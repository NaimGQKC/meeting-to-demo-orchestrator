import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function discoverCircleback() {
    const url = "https://app.circleback.ai/api/mcp";
    console.log(`Connecting to Circleback MCP at ${url}...`);

    const transport = new SSEClientTransport(new URL(url));
    const client = new Client(
        { name: "discovery-tool", version: "1.0.0" },
        { capabilities: {} }
    );

    try {
        await client.connect(transport);
        console.log("Connected! Fetching tools...");

        const tools = await client.listTools();
        console.log("Available Tools:");
        console.log(JSON.stringify(tools, null, 2));
    } catch (error) {
        console.error("Failed to connect or fetch tools:");
        console.error(error);
        console.log("\nNote: This might be failing because authentication (OAuth) is required.");
    } finally {
        await client.close();
    }
}

discoverCircleback();
