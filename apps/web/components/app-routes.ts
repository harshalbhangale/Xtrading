const within = (path: string, root: string) =>
  path === root || path.startsWith(`${root}/`);

// Routes rendered inside the workspace shell, which brings its own navigation.
export const isWorkspacePath = (path: string) =>
  ["/dashboard", "/creator", "/creators", "/integrations"].some((root) =>
    within(path, root),
  );

// Routes that render without the site header and footer.
export const isChromeless = (path: string) =>
  isWorkspacePath(path) ||
  within(path, "/start") ||
  within(path, "/trade/inline");
