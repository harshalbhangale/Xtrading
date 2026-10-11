import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@call-my-bluff/domain", "@call-my-bluff/integrations"],
  poweredByHeader: false,
};
export default config;
