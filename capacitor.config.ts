import type { CapacitorConfig } from "@capacitor/cli";

const liveReload = process.env.NATIVE_AR_LIVE_RELOAD === "1";

const config: CapacitorConfig = {
  appId: "io.worldbuild.nativear",
  appName: "Deez-Native AR",
  webDir: "web/dist",
  server: {
    androidScheme: "https",
    ...(liveReload
      ? { url: "http://localhost:5187", cleartext: true }
      : {}),
  },
  android: {
    webContentsDebuggingEnabled:
      process.env.NATIVE_AR_LIVE_RELOAD === "1" ||
      process.env.NATIVE_AR_WEBVIEW_DEBUG === "1",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b1220",
    },
  },
};

export default config;
