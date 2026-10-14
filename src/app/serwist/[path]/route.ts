import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

// Pages are static shells that render from on-device data, so they are precached with the build:
// a new build gets a new revision and therefore a new service worker.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  additionalPrecacheEntries: ["/", "/dishes", "/favorites"].map((url) => ({ url, revision })),
});
