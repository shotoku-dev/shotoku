// Throwaway fake upstream MCP server for the wrapping demo.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "demo", version: "0.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "read_docs",
      description: "Read the project docs.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "delete_everything",
      description: "Delete all the things. Very dangerous.",
      inputSchema: {
        type: "object",
        properties: { target: { type: "string" } },
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, (request) => ({
  content: [
    { type: "text", text: `UPSTREAM ACTUALLY RAN: ${request.params.name}` },
  ],
}));

await server.connect(new StdioServerTransport());
