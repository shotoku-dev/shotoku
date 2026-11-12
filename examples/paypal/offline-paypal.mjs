/**
 * A local stand-in for PayPal's MCP server, for `setup.mjs --offline`.
 *
 * It exists so the demo can be run without a PayPal sandbox app: same tool
 * names as @paypal/mcp (`get_order`, `create_refund`), answers shaped like
 * PayPal's, and no network. It holds the two orders setup wrote and refunds
 * them in memory. Nothing here is PayPal; the real demo wraps @paypal/mcp
 * against the sandbox. Shotoku treats both the same way, which is the point:
 * it gates whatever sits behind it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const sdk = (path) =>
  import(pathToFileURL(join(repo, "mcp/node_modules/@modelcontextprotocol/sdk/dist/esm", path)).href);
const { Server } = await sdk("server/index.js");
const { StdioServerTransport } = await sdk("server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = await sdk("types.js");

// eval.mjs runs several of these at once, each with its own orders file.
const ordersPath = process.env.SHOTOKU_DEMO_ORDERS ?? join(here, ".run", "orders.json");
const orders = Object.values(JSON.parse(readFileSync(ordersPath, "utf8"))).filter(
  (order) => typeof order === "object" && order !== null && "captureId" in order,
);
const refunded = new Map();

const money = {
  type: "object",
  properties: { currency_code: { type: "string" }, value: { type: "string" } },
  required: ["currency_code", "value"],
};

const server = new Server({ name: "paypal-offline", version: "0.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "get_order",
      description: "Retrieve the details of a PayPal order, including its captures.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "The PayPal order ID." } },
        required: ["id"],
      },
    },
    {
      name: "create_refund",
      description: "Refund a captured payment. State the amount to refund.",
      inputSchema: {
        type: "object",
        properties: {
          capture_id: { type: "string", description: "The capture to refund." },
          amount: money,
          note_to_payer: { type: "string" },
        },
        required: ["capture_id", "amount"],
      },
    },
  ],
}));

const answer = (body) => ({ content: [{ type: "text", text: JSON.stringify(body, null, 2) }] });
const refuse = (message) => ({ isError: true, content: [{ type: "text", text: message }] });

server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === "get_order") {
    const order = orders.find((o) => o.orderId === args.id);
    if (!order) return refuse(`RESOURCE_NOT_FOUND: no order ${args.id}`);
    return answer({
      id: order.orderId,
      status: "COMPLETED",
      purchase_units: [
        {
          description: order.description,
          amount: { currency_code: "USD", value: order.amount },
          payments: {
            captures: [
              {
                id: order.captureId,
                status: refunded.has(order.captureId) ? "REFUNDED" : "COMPLETED",
                amount: { currency_code: "USD", value: order.amount },
              },
            ],
          },
        },
      ],
    });
  }

  if (name === "create_refund") {
    const order = orders.find((o) => o.captureId === args.capture_id);
    if (!order) return refuse(`RESOURCE_NOT_FOUND: no capture ${args.capture_id}`);
    if (refunded.has(order.captureId)) return refuse("CAPTURE_FULLY_REFUNDED: this capture was already refunded.");
    const value = args.amount?.value ?? order.amount;
    if (Number(value) > Number(order.amount)) return refuse("REFUND_AMOUNT_EXCEEDED: more than the capture.");
    const id = `OFFLINE${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
    refunded.set(order.captureId, id);
    return answer({ id, status: "COMPLETED", amount: { currency_code: "USD", value } });
  }

  return refuse(`Unknown tool ${name}`);
});

await server.connect(new StdioServerTransport());
