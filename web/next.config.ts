import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents + partialPrefetching stay OFF for now: every route is a
  // client component (Zustand auth + mock layer), so Next 16's instant-nav
  // validation DROPS the segments and sidebar Link clicks bounce back to the
  // current page (error: instant-unrendered-segment). Re-enable once routes
  // are server components with "use cache" / Suspense shells.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
