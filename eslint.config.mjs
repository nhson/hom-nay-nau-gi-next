import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The domain core is the primary test seam: it must stay framework-, DB- and browser-free
  // so it runs unchanged on the client and in unit tests.
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "next",
                "next/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "@neondatabase/*",
                "@vercel/*",
                "zod",
                "@/*",
                "../*",
              ],
              message:
                "The domain core must not import frameworks, the DB, schemas or anything outside src/domain.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "navigator",
        "fetch",
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
