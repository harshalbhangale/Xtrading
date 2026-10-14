import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@call-my-bluff/domain", "@call-my-bluff/integrations"],
  poweredByHeader: false,
  // OAuth discovery documents for the MCP connector live under /.well-known.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/oauth/server-metadata",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/server-metadata",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/oauth/resource-metadata",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/resource-metadata",
      },
    ];
  },
};
export default config;
