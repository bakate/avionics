import { afterAll, afterEach, beforeAll } from "vitest";
import { mswServer } from "./msw-server.js";

beforeAll(() =>
  mswServer.listen({
    onUnhandledRequest(req, print) {
      const url = new URL(req.url);
      // Suppress warnings for local requests to the test server
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return;
      }
      print.warning();
    },
  }),
);

afterEach(() => {
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});
