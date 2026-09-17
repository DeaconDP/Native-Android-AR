import { WebPlugin } from "@capacitor/core";
import type {
  NativeArPlugin,
  NativeArPointOptions,
  NativeArStartOptions,
  NativeArSupportResult,
} from "./definitions";

export class NativeArWeb extends WebPlugin implements NativeArPlugin {
  async isSupported(): Promise<NativeArSupportResult> {
    return { supported: false, backend: "none" };
  }

  async startSession(_options: NativeArStartOptions): Promise<void> {
    throw this.unavailable(
      "Native AR plugin is only available inside Capacitor shells.",
    );
  }

  async stopSession(): Promise<void> {}

  async onScreenTap(
    _options: NativeArPointOptions,
  ): Promise<{ placed: boolean }> {
    return { placed: false };
  }

  async moveScreen(_options: NativeArPointOptions): Promise<{ moved: boolean }> {
    return { moved: false };
  }

  async reposition(): Promise<void> {}

  async recenter(): Promise<void> {}

  async rotate(_options: { dx: number; dy: number }): Promise<void> {}

  async setScale(_options: { factor: number }): Promise<void> {}

  async debugPlaceFront(_options?: {
    withCube?: boolean;
    demetalize?: boolean;
  }): Promise<{ placed: boolean; error?: string }> {
    return { placed: false, error: "web" };
  }

  async isAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }

  async start(options: NativeArStartOptions): Promise<void> {
    return this.startSession(options);
  }

  async stop(): Promise<void> {
    return this.stopSession();
  }

  async tap(options: NativeArPointOptions): Promise<{ placed: boolean }> {
    return this.onScreenTap(options);
  }

  async move(options: NativeArPointOptions): Promise<{ moved: boolean }> {
    return this.moveScreen(options);
  }
}
