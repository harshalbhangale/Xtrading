import {
  handleSignedInMcp,
  signedInMethodNotAllowed,
} from "../../lib/mcp-http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Connector endpoint for claude.ai and other OAuth MCP clients: sign-in required.
export {
  handleSignedInMcp as POST,
  signedInMethodNotAllowed as GET,
  signedInMethodNotAllowed as DELETE,
};
