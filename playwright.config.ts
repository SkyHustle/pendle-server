import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./src/e2e",
    outputDir: "test-results",
    timeout: 60000,
    reporter: "list",
    use: {
        headless: false,
        viewport: { width: 1280, height: 720 },
        screenshot: "only-on-failure",
        geolocation: {
            latitude: 19.4326,
            longitude: -99.1332,
        },
        permissions: ["geolocation"],
        locale: "es-MX",
        timezoneId: "America/Mexico_City",
        trace: "retain-on-failure",
        video: "retain-on-failure",
    },
    preserveOutput: "failures-only",
});
