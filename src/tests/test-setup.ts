import { afterEach } from "vite-plus/test";

import { resetContext } from "../context";

afterEach(() => {
  resetContext();
});
