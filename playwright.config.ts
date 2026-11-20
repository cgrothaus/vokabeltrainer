import { defineConfig, devices } from "@playwright/test";

// Eigener Port, damit ein laufendes `npm run preview` (4173) nicht stört.
const port = 4180;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  // Keine Wiederholungen, damit instabile Tests auffallen.
  // Zwei Worker auch in der CI: Der Runner hat vier Kerne, und je Browser läuft ein eigener Job.
  // Lokal ebenfalls zwei statt der Standardzahl (halbe Kernzahl): Mehrere Läufe paralleler
  // Sitzungen haben den Entwicklungsrechner überlastet.
  workers: 2,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL: `http://localhost:${port}/`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 15"] } },
  ],
  // Getestet wird immer das frisch gebaute Artefakt (TDD 15.4).
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
  },
});
