/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_AR_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface XRHitTestOptionsInit {
  space: XRSpace;
  offsetRay?: XRRay;
  entityTypes?: XRHitTestTrackableType[];
}

interface XRSession {
  requestHitTestSource?(
    options: XRHitTestOptionsInit,
  ): Promise<XRHitTestSource | null>;
  enabledFeatures?: string[];
}

interface XRHitTestResult {
  createAnchor?(): Promise<XRAnchor>;
}
