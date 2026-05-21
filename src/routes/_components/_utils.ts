// Shared nav link helper. Active links go white, inactive stay neutral.
export const linkClass = (active: boolean) =>
  `${active ? "text-white" : "text-neutral-400"} inline-flex h-8 items-center transition-colors hover:text-white`;
