import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Flat config, replacing the removed `next lint` command (deprecated in Next 15,
 * gone in Next 16). `next/core-web-vitals` plus the TypeScript rules, and the
 * standard build-output ignores. `.next-build` is this project's `distDir`.
 */
const config = [
  {
    ignores: [".next/**", ".next-build/**", "node_modules/**", "out/**", "build/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
