/// <reference types="vite/client" />

interface XRSession {
  requestHitTestSource?(options: { space: XRReferenceSpace }): Promise<XRHitTestSource>;
}

interface XRHitTestResult {
  createAnchor?(): Promise<XRAnchor>;
}
