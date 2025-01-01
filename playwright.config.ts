import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./src/e2e",
    timeout: 30000,
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
    },
});
