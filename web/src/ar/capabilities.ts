export type WebXrCapability =
  | { ok: true }
  | { ok: false; title: string; body: string };

export async function assessWebXrCapability(): Promise<WebXrCapability> {
  if (!window.isSecureContext) {
    return {
      ok: false,
      title: 'HTTPS required',
      body: 'WebXR needs a secure context. Open this app over HTTPS (dev: https://localhost:5187 or your LAN HTTPS URL).',
    };
  }

  if (!navigator.xr) {
    return {
      ok: false,
      title: 'WebXR not available',
      body: 'This browser has no WebXR API. Use Chrome on an ARCore-capable Android phone.',
    };
  }

  let supported = false;
  try {
    supported = await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    supported = false;
  }

  if (!supported) {
    return {
      ok: false,
      title: 'Immersive AR not supported',
      body: 'Install Google Play Services for AR and open this page in Chrome on an ARCore device.',
    };
  }

  return { ok: true };
}

export function formatSessionStartError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error starting WebXR session.';
  }

  const name = error.name;
  const message = error.message.toLowerCase();

  if (
    name === 'NotAllowedError' ||
    message.includes('permission') ||
    message.includes('denied') ||
    message.includes('not allowed')
  ) {
    return 'Camera or AR permission was denied. Allow camera access in Chrome Settings, then try again.';
  }

  if (
    name === 'NotSupportedError' ||
    message.includes('not supported') ||
    message.includes('arcore') ||
    message.includes('immersive-ar')
  ) {
    return 'AR could not start on this device. Install Google Play Services for AR and use Chrome on an ARCore phone.';
  }

  if (name === 'AbortError' || message.includes('abort')) {
    return 'AR session was cancelled. Tap Try again when ready.';
  }

  if (message.includes('secure') || message.includes('https')) {
    return 'WebXR requires HTTPS. Reload over a secure URL and try again.';
  }

  return error.message || 'Could not start WebXR AR session.';
}
