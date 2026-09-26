/** @type {import('next').NextConfig} */

// `next build` and `next start` run with NODE_ENV=production, `next dev` with
// NODE_ENV=development. Next uses one distDir for every mode, so a production
// build sharing `.next` with a running dev server overwrites the dev server's
// chunks and every API route starts failing with MODULE_NOT_FOUND. Keeping dev
// on the default `.next` and moving the build to its own directory removes the
// collision, so you can build while `npm run dev` is running.
const distDir = process.env.NODE_ENV === "development" ? ".next" : ".next-build";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  // node:sqlite is a Node builtin, but Turbopack/webpack still need to be
  // told not to try to bundle it for the browser.
  serverExternalPackages: ["node:sqlite"],
  experimental: {
    // Resumes and webcam clips are uploaded as multipart FormData from the
    // browser; the default 1MB body cap is too small for either.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
