import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

function siteUrl(): string {
  return (process.env.VITE_SITE_URL || "").replace(/\/$/, "");
}

function seoPlugin(): Plugin {
  return {
    name: "seo",
    transformIndexHtml(html) {
      const url = siteUrl();
      if (!url) {
        return html
          .replace(/\s*<link rel="canonical" href="__SITE_URL__\/" \/>\n?/g, "")
          .replace(/__SITE_URL__/g, "");
      }
      return html.replaceAll("__SITE_URL__", url);
    },
    closeBundle() {
      const url = siteUrl();
      if (!url) return;
      const dist = join(root, "dist");
      const lastmod = new Date().toISOString().slice(0, 10);
      writeFileSync(
        join(dist, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      );
      writeFileSync(
        join(dist, "robots.txt"),
        `User-agent: *
Allow: /

Sitemap: ${url}/sitemap.xml
`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), seoPlugin()],
  resolve: {
    alias: {
      "@compute": resolve(root, "../compute"),
    },
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["@compute"],
  },
});
