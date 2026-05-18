// Shared nav link helper. Active links use the foreground colour for the
// current theme; inactive sit at the muted scale. Both flip on hover.
export const linkClass = (active: boolean) =>
  `${active ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"} inline-flex h-8 items-center transition-colors hover:text-neutral-900 dark:hover:text-white`;
