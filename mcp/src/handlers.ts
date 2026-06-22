import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export async function handleToolCall(
  name: string,
  _args: Record<string, unknown>,
): Promise<CallToolResult> {
  return {
    content: [
      {
        type: "text",
        text: `Tool "${name}" is not yet implemented. Coming in the next build.`,
      },
    ],
    isError: true,
  };
}
