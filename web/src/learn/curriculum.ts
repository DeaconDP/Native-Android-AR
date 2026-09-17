export type LearnTopicId =
  | "looking-at"
  | "mode-ladder"
  | "android-native"
  | "ios-native"
  | "hit-cascade"
  | "gestures"
  | "fallbacks"
  | "why-not-webxr-only";

export type LearnSection = {
  heading: string;
  paragraphs: string[];
};

export type LearnTopic = {
  id: LearnTopicId;
  title: string;
  summary: string;
  sections: LearnSection[];
};

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: "looking-at",
    title: "What you're looking at",
    summary: "A Capacitor shell, transparent WebView chrome, and a native camera under the glass.",
    sections: [
      {
        heading: "Two layers, one screen",
        paragraphs: [
          "This app is not a pure website pretending to be AR. On phone installs it is a Capacitor shell: a native Android or iOS container that hosts a WebView for buttons, hints, and this Learn hub.",
          "When native AR starts, that WebView goes visually transparent. The live camera and 3D model draw underneath in a native SceneView (Android) or ARKit view (iOS). Your taps on empty areas pass through the chrome to the gesture stage; only buttons and sheets capture touches.",
        ],
      },
      {
        heading: "Why that design",
        paragraphs: [
          "UI stays familiar web code (Vite + TypeScript). Tracking, plane finding, Instant Placement, and Filament/ARKit model loading stay in the engines that know the camera best.",
          "You pick a model from a small CC0 kit (Kenney furniture/nature, Khronos Duck, and a teaching cube). Native paths load a Filament-friendly copy under models/ar/; browser paths use Three.js. Same educational demo, different renderers behind the mode ladder.",
        ],
      },
    ],
  },
  {
    id: "mode-ladder",
    title: "Mode ladder",
    summary: "native -> WebXR -> Quick Look -> Chrome handoff -> orbit  -  picked automatically.",
    sections: [
      {
        heading: "Rungs, top to bottom",
        paragraphs: [
          "1. native  -  Capacitor + ARCore (Android) or ARKit (iOS) under the transparent WebView. Best tracking when the plugin reports support.",
          "2. webxr  -  Chrome / PWA immersive-ar with WebXR hit-test. Used when you are already in a browser that can run immersive AR.",
          "3. quicklook  -  iOS Safari opens the system AR Quick Look viewer via a special link.",
          "4. chrome  -  On Cap Android, if native is unavailable but an HTTPS origin is configured, the app opens Chrome Custom Tabs for WebXR.",
          "5. orbit  -  Desktop or unsupported devices get a plain 3D orbit viewer (no camera world).",
        ],
      },
      {
        heading: "Why Cap WebView skips WebXR",
        paragraphs: [
          "Android System WebView inside Capacitor cannot start an immersive-ar session the way Chrome can. So the ladder prefers real native AR in the installed app, and only hands off to Chrome when that is the workable path.",
          "You do not pick the rung yourself. At launch the app probes support and shows which mode you landed on. Open Learn anytime to see how that rung works.",
        ],
      },
    ],
  },
  {
    id: "android-native",
    title: "Native Android path",
    summary: "SceneView ARSceneView, ARCore, Instant Placement, plane grid, optional depth.",
    sections: [
      {
        heading: "SceneView + ARCore",
        paragraphs: [
          "On Android the native-ar plugin inserts an ARSceneView under the WebView. ARCore owns camera tracking and world understanding. Google Play Services for AR must be installed on the device.",
          "Session config enables horizontal plane finding and Instant Placement in LOCAL_Y_UP mode so you can place before a full plane mesh is mature.",
        ],
      },
      {
        heading: "What you see while scanning",
        paragraphs: [
          "When a real plane arrives, an orange grid texture can reveal with a soft spotlight and a gentle breath pulse  -  cues that the world lock is improving. After you place, plane visuals hide so the model stays the focus.",
          "Where the device supports it, ARCore automatic depth helps occlusion-quality tracking. Light estimation is kept simple here with a fixed Filament directional light so the educational demo stays predictable.",
        ],
      },
    ],
  },
  {
    id: "ios-native",
    title: "Native iOS path",
    summary: "ARKit horizontal planes and a soft-to-strict raycast ladder.",
    sections: [
      {
        heading: "ARKit under Capacitor",
        paragraphs: [
          "On iOS Cap, the same NativeAr plugin API talks to ARKit. Horizontal plane detection runs while the WebView chrome stays on top for controls and coaching.",
          "Models load through the native GLTF stack (GLTFKit2). Materials and scale clamps stay aligned with the Android educational gestures so both platforms feel like one lesson.",
        ],
      },
      {
        heading: "Soft -> strict raycast",
        paragraphs: [
          "Placement tries estimated planes first (fast, approximate), then infinite plane fallbacks, then geometry hits when ARKit has denser surface data. That soft-to-strict cascade is why early taps can still succeed while tracking improves.",
          "Ready state can unlock as soon as tracking is normal with an estimated plane  -  similar educational idea to Android Instant Placement: do not make visitors wait forever for a perfect mesh.",
        ],
      },
    ],
  },
  {
    id: "hit-cascade",
    title: "Hit cascade & anchors",
    summary: "Tap screen -> plane or Instant Placement -> AnchorNode; reposition vs recenter.",
    sections: [
      {
        heading: "From finger to world pose",
        paragraphs: [
          "A screen tap becomes a ray into the AR world. On Android the cascade prefers a horizontal plane hit, then any plane, then an Instant Placement point roughly a metre out if planes are thin.",
          "A successful hit creates (or updates) an anchor. The model rides that AnchorNode so it stays glued as you walk  -  that is world tracking, not a sticker on the video feed.",
        ],
      },
      {
        heading: "Reposition vs recenter",
        paragraphs: [
          "Reposition clears the placed object so you can tap a new surface  -  useful when Instant Placement was temporary and you want a better plane.",
          "Recentre keeps the object but recentres orientation / framing relative to you. Clear / Reposition on the footer follows the same educational idea: start the placement lesson again without exiting AR.",
        ],
      },
    ],
  },
  {
    id: "gestures",
    title: "Gestures & emerge",
    summary: "Tap place, drag rotate, pinch scale, two-finger move; emerge respects reduced motion.",
    sections: [
      {
        heading: "Shared gesture surface",
        paragraphs: [
          "One gesture layer drives native, WebXR, and orbit so the lesson stays consistent. Tap places when the surface is ready. One-finger drag rotates. Pinch scales (clamped). Two fingers slide to move on supported camera modes.",
          "Chrome buttons (Reposition, Recentre, Exit) sit in a frosted footer with pass-through empty regions so you do not accidentally block the stage.",
        ],
      },
      {
        heading: "Emerge motion",
        paragraphs: [
          "On place, the model can rise and scale in with a short emerge animation and contact ripples on native  -  a readable 'it landed' moment for teaching anchors.",
          "If the OS prefers reduced motion, emerge short-circuits to a quick settle. The physics of tracking does not change; only the theatrical intro does.",
        ],
      },
    ],
  },
  {
    id: "fallbacks",
    title: "Fallbacks outside native",
    summary: "WebXR hit-test, Quick Look USDZ, Chrome Custom Tabs, orbit viewer.",
    sections: [
      {
        heading: "WebXR in Chrome",
        paragraphs: [
          "WebXR requests immersive-ar, often with hit-test and a DOM overlay for UI. Placement uses screen-space rays (offsetRay) so a finger tap maps into the XR view  -  the browser cousin of native hit testing.",
          "A reticle and emerge timing stay close to the native lesson so switching rungs does not rewrite the whole interaction vocabulary.",
        ],
      },
      {
        heading: "Quick Look, Chrome handoff, orbit",
        paragraphs: [
          "Quick Look converts / presents a USDZ-style experience in Apple's system viewer  -  great for iOS Safari when in-app ARKit Cap is not the active path.",
          "Chrome handoff opens Custom Tabs to an HTTPS origin configured for WebXR when Cap Android cannot use native. Orbit is the honest non-AR fallback: inspect the model with drag/pinch, no world anchors.",
        ],
      },
    ],
  },
  {
    id: "why-not-webxr-only",
    title: "Why not only WebXR?",
    summary: "Browser limits vs native tracking quality inside the Capacitor app.",
    sections: [
      {
        heading: "Educational contrast",
        paragraphs: [
          "WebXR is excellent for reach: one HTTPS site, many phones, no store binary. It is weaker inside Cap's System WebView, which cannot host immersive-ar the way Chrome can.",
          "Native ARCore / ARKit usually give earlier Instant Placement / estimated planes, tighter anchors, and Filament/ARKit rendering tuned for continuous camera sessions. That is why this educational app teaches the native path first.",
        ],
      },
      {
        heading: "What to take away",
        paragraphs: [
          "Cross-platform products often keep a PWA WebXR ladder for browsers and a Capacitor native plugin for the installable app  -  exactly the mode ladder you are standing on.",
          "When you leave this Learn sheet and Start AR, watch Instant Placement or plane cues, then place and gesture. The captions during the session name the same ideas in shorter form.",
        ],
      },
    ],
  },
];

export function getLearnTopic(id: string | null): LearnTopic | null {
  if (!id) return null;
  return LEARN_TOPICS.find((topic) => topic.id === id) ?? null;
}

export const MODE_LABELS: Record<string, string> = {
  native: "native (ARCore / ARKit)",
  webxr: "WebXR",
  quicklook: "Quick Look",
  chrome: "Chrome handoff",
  orbit: "orbit viewer",
};
