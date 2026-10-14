import { handleMcp, mcpMethodNotAllowed } from "../../../lib/mcp-http";

export const dynamic = "force-dynamic";

// Open endpoint: public tools without a token, signed-in tools with one.
export {
  handleMcp as POST,
  mcpMethodNotAllowed as GET,
  mcpMethodNotAllowed as DELETE,
};
