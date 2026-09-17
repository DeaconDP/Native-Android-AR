import { registerPlugin } from "@capacitor/core";
import type { NativeArPlugin } from "./definitions";

const NativeAr = registerPlugin<NativeArPlugin>("NativeAr", {
  web: () => import("./web").then((module) => new module.NativeArWeb()),
});

export * from "./definitions";
export { NativeAr };
