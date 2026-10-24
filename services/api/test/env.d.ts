import type { AppEnv } from "../src/env";

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      mainModule: typeof import("../worker");
    }
    interface Env extends AppEnv {
      DB: D1Database;
      TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
    }
  }
}
