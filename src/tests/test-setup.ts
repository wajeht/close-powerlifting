// Vitest setup file. Loaded once per worker before tests run. Currently
// only resets the module-level AppContext singleton so test files can
// safely import createContext() in isolation.

import { afterEach } from "vite-plus/test";

import { resetContext } from "../context";

afterEach(() => {
  resetContext();
});
