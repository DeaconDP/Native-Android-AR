export type LearnTopicId =
  | "cross-platform"
  | "looking-at"
  | "mode-ladder"
  | "android-native"
  | "ios-native"
  | "hit-cascade"
  | "instant-placement"
  | "webxr-hit-test"
  | "gestures"
  | "orbit-control"
  | "fallbacks"
  | "why-not-webxr-only"
  | "kind-marker"
  | "kind-slam"
  | "kind-instant"
  | "kind-face"
  | "kind-geo"
  | "kind-occlusion"
  | "kind-light"
  | "kind-cloud"
  | "kind-delivery"
  | "stack-arcore-arkit"
  | "stack-webxr-three"
  | "stack-quicklook"
  | "stack-shells"
  | "stack-commercial";

export type LearnStatus = "live" | "explained" | "roadmap";

export type LearnSectionId =
  | "this-app"
  | "placement"
  | "platforms"
  | "kinds"
  | "stacks";

export type LearnSectionMeta = {
  id: LearnSectionId;
  title: string;
  blurb: string;
};

export type LearnContentSection = {
  heading: string;
  paragraphs: string[];
};

export type LearnTopic = {
  id: LearnTopicId;
  section: LearnSectionId;
  title: string;
  summary: string;
  status: LearnStatus;
  sections: LearnContentSection[];
};

export const LEARN_SECTIONS: LearnSectionMeta[] = [
  {
    id: "this-app",
    title: "This app",
    blurb: "What you are running and how the mode ladder picks a path.",
  },
  {
    id: "placement",
    title: "How placement works",
    blurb: "From finger tap to world anchor — live techniques in this build.",
  },
  {
    id: "platforms",
    title: "Platform paths",
    blurb: "Android, iOS, browser, and honest fallbacks.",
  },
  {
    id: "kinds",
    title: "Kinds of AR",
    blurb: "The wider taxonomy — what this demo ships vs explains vs roadmaps.",
  },
  {
    id: "stacks",
    title: "Software stacks",
    blurb: "Engines and shells used in industry, mapped to this product.",
  },
];

export const STATUS_LABELS: Record<LearnStatus, string> = {
  live: "Live demo",
  explained: "Explained",
  roadmap: "Roadmap",
};

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: "cross-platform",
    section: "this-app",
    title: "Cross-platform & native AR",
    summary:
      "One UI, several AR engines — native-first on Cap phones, graceful elsewhere.",
    status: "live",
    sections: [
      {
        heading: "Cross-platform in practice",
        paragraphs: [
          "One Vite + TypeScript UI ships as a Capacitor app on Android and iOS, and as a PWA / browser page. It is not the same AR engine everywhere — it is one product that picks the best workable path for your device.",
          "The mode ladder runs native → WebXR → Quick Look → Chrome handoff → orbit. At launch the app probes support and lands you on a rung. Your current mode is shown on this Learn sheet and on the home gate.",
        ],
      },
      {
        heading: "Native-friendly by design",
        paragraphs: [
          "Phone installs prefer real native AR: Capacitor hosts a transparent WebView for buttons and coaching, while ARCore (SceneView / Filament on Android) or ARKit (on iOS) own the camera, planes, Instant Placement / hit cascade, and the 3D model under the glass.",
          "That split is intentional. UI stays familiar web code; tracking and world anchors stay in the engines that know the camera best. Shared gestures (place, rotate, pinch, move) keep the lesson consistent across rungs.",
        ],
      },
      {
        heading: "Honest limits",
        paragraphs: [
          "This is a hybrid Capacitor app — not a pure Jetpack Compose or SwiftUI AR client. Android's System WebView inside Cap cannot run WebXR immersive-ar the way Chrome can, so the installable app uses native AR (or a Chrome Custom Tabs handoff when configured).",
          "Browser WebXR is aimed at Chrome on ARCore phones. iOS Safari uses Quick Look when in-app ARKit is not the active path. Desktop and unsupported devices get an honest orbit viewer (no world anchors). Headset / immersive-vr is out of scope for this phone AR lesson.",
        ],
      },
    ],
  },
  {
    id: "looking-at",
    section: "this-app",
    title: "Transparent WebView chrome",
    summary:
      "Capacitor shell, transparent WebView chrome, native camera under the glass.",
    status: "live",
    sections: [
      {
        heading: "Two layers, one screen",
        paragraphs: [
          "On phone installs this is a Capacitor shell: a native Android or iOS container that hosts a WebView for buttons, hints, and this Learn hub.",
          "When native AR starts, that WebView goes visually transparent. The live camera and 3D model draw underneath in a native SceneView (Android) or ARKit view (iOS). Taps on empty areas pass through the chrome to the gesture stage; only buttons and sheets capture touches.",
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
    section: "this-app",
    title: "Mode ladder",
    summary:
      "native → WebXR → Quick Look → Chrome handoff → orbit — picked automatically.",
    status: "live",
    sections: [
      {
        heading: "Rungs, top to bottom",
        paragraphs: [
          "1. native — Capacitor + ARCore (Android) or ARKit (iOS) under the transparent WebView. Best tracking when the plugin reports support.",
          "2. webxr — Chrome / PWA immersive-ar with WebXR hit-test. Used when you are already in a browser that can run immersive AR.",
          "3. quicklook — iOS Safari opens the system AR Quick Look viewer via a special link.",
          "4. chrome — On Cap Android, if native is unavailable but an HTTPS origin is configured, the app opens Chrome Custom Tabs for WebXR.",
          "5. orbit — Desktop or unsupported devices get a plain 3D orbit viewer (no camera world).",
        ],
      },
      {
        heading: "Why Cap WebView skips WebXR",
        paragraphs: [
          "Android System WebView inside Capacitor cannot start an immersive-ar session the way Chrome can. So the ladder prefers real native AR in the installed app, and only hands off to Chrome when that is the workable path.",
          "You do not pick the rung yourself. At launch the app probes support and shows which mode you landed on.",
        ],
      },
    ],
  },
  {
    id: "hit-cascade",
    section: "placement",
    title: "Hit cascade & anchors",
    summary:
      "Tap screen → plane or Instant Placement → AnchorNode; reposition vs recenter.",
    status: "live",
    sections: [
      {
        heading: "From finger to world pose",
        paragraphs: [
          "A screen tap becomes a ray into the AR world. On Android the cascade prefers a horizontal plane hit, then any plane, then an Instant Placement point roughly a metre out if planes are thin.",
          "A successful hit creates (or updates) an anchor. The model rides that AnchorNode so it stays glued as you walk — that is world tracking, not a sticker on the video feed.",
        ],
      },
      {
        heading: "Reposition vs recenter",
        paragraphs: [
          "Reposition clears the placed object so you can tap a new surface — useful when Instant Placement was temporary and you want a better plane.",
          "Recentre keeps the object but recentres orientation / framing relative to you. Clear / Reposition on the footer follows the same educational idea: start the placement lesson again without exiting AR.",
        ],
      },
    ],
  },
  {
    id: "instant-placement",
    section: "placement",
    title: "Instant Placement vs planes",
    summary:
      "Place early on an estimated pose, then refine as ARCore matures the plane.",
    status: "live",
    sections: [
      {
        heading: "Why Instant Placement exists",
        paragraphs: [
          "Full plane meshes take time. Instant Placement (ARCore LOCAL_Y_UP here) lets you put a model on an approximate horizontal pose before the grid is dense — so the lesson does not stall on 'keep scanning'.",
          "As tracking improves, the same educational idea continues on iOS via estimated planes first. Watch the orange plane grid when a real plane arrives: world lock is getting stricter.",
        ],
      },
      {
        heading: "What to try",
        paragraphs: [
          "Start AR on an ARCore phone, tap as soon as the coach says the surface is ready, then walk around. If the pose feels floaty, use Reposition once planes look solid.",
          "This topic pairs with Hit cascade & anchors — Instant Placement is one rung of that cascade, not a separate product mode.",
        ],
      },
    ],
  },
  {
    id: "webxr-hit-test",
    section: "placement",
    title: "WebXR hit-test & offsetRay",
    summary:
      "Browser cousin of native hits: immersive-ar, hit-test, screen-space rays.",
    status: "live",
    sections: [
      {
        heading: "Screen space to XR view",
        paragraphs: [
          "In Chrome / PWA WebXR, placement uses screen-space rays (offsetRay) so a finger tap maps into the XR camera frustum — the browser cousin of native hit testing.",
          "Sessions often request hit-test plus a DOM overlay for UI. A reticle and emerge timing stay close to the native lesson so switching rungs does not rewrite the interaction vocabulary.",
        ],
      },
      {
        heading: "Where it runs",
        paragraphs: [
          "WebXR immersive-ar runs in Chrome on ARCore phones (and the PWA path), not inside Cap's System WebView. Cap Android may hand off to Chrome Custom Tabs when configured.",
          "Compare this article with Hit cascade & anchors after you have tried both native and WebXR on the same room.",
        ],
      },
    ],
  },
  {
    id: "gestures",
    section: "placement",
    title: "Gestures & emerge",
    summary:
      "Tap place, drag rotate, pinch scale, two-finger move; emerge respects reduced motion.",
    status: "live",
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
          "On place, the model can rise and scale in with a short emerge animation and contact ripples on native — a readable 'it landed' moment for teaching anchors.",
          "If the OS prefers reduced motion, emerge short-circuits to a quick settle. The physics of tracking does not change; only the theatrical intro does.",
        ],
      },
    ],
  },
  {
    id: "orbit-control",
    section: "placement",
    title: "Orbit as non-AR control",
    summary:
      "Honest desktop / unsupported fallback: inspect the model, no world anchors.",
    status: "live",
    sections: [
      {
        heading: "When you land on orbit",
        paragraphs: [
          "Orbit is the bottom rung: no camera world, no planes, no Instant Placement. You still get the shared rotate / pinch vocabulary so the model kit remains inspectable.",
          "Educationally this is the control condition — what 3D looks like without SLAM. If your device can climb the ladder, Start AR again from a Cap install or Chrome on an ARCore phone.",
        ],
      },
    ],
  },
  {
    id: "android-native",
    section: "platforms",
    title: "Native Android path",
    summary:
      "SceneView ARSceneView, ARCore, Instant Placement, plane grid, optional depth.",
    status: "live",
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
          "While you scan, a feature-point HUD (dots + count) draws ARCore's point cloud between the camera view and the WebView. After you place, that overlay dims so the model stays the focus.",
          "When a real plane arrives, an orange grid texture can reveal with a soft spotlight and a gentle breath pulse — cues that the world lock is improving. After you place, plane visuals hide so the model stays the focus.",
          "Where the device supports it, a semi-transparent depth heatmap peeks over the camera while you scan (ARCore depth image) and dims after you place. Automatic depth also helps occlusion-quality tracking. Light estimation is kept simple here with a fixed Filament directional light so the educational demo stays predictable.",
        ],
      },
    ],
  },
  {
    id: "ios-native",
    section: "platforms",
    title: "Native iOS path",
    summary: "ARKit horizontal planes and a soft-to-strict raycast ladder.",
    status: "live",
    sections: [
      {
        heading: "ARKit under Capacitor",
        paragraphs: [
          "On iOS Cap, the same NativeAr plugin API talks to ARKit. Horizontal plane detection runs while the WebView chrome stays on top for controls and coaching.",
          "Models load through the native GLTF stack (GLTFKit2). Materials and scale clamps stay aligned with the Android educational gestures so both platforms feel like one lesson.",
        ],
      },
      {
        heading: "Soft → strict raycast",
        paragraphs: [
          "Placement tries estimated planes first (fast, approximate), then infinite plane fallbacks, then geometry hits when ARKit has denser surface data. That soft-to-strict cascade is why early taps can still succeed while tracking improves.",
          "Ready state can unlock as soon as tracking is normal with an estimated plane — similar educational idea to Android Instant Placement: do not make visitors wait forever for a perfect mesh.",
        ],
      },
    ],
  },
  {
    id: "fallbacks",
    section: "platforms",
    title: "Fallbacks outside native",
    summary: "WebXR hit-test, Quick Look USDZ, Chrome Custom Tabs, orbit viewer.",
    status: "live",
    sections: [
      {
        heading: "WebXR in Chrome",
        paragraphs: [
          "WebXR requests immersive-ar, often with hit-test and a DOM overlay for UI. Placement uses screen-space rays (offsetRay) so a finger tap maps into the XR view.",
          "See WebXR hit-test & offsetRay for the placement detail; this topic is the delivery rung on the mode ladder.",
        ],
      },
      {
        heading: "Quick Look, Chrome handoff, orbit",
        paragraphs: [
          "Quick Look converts / presents a USDZ-style experience in Apple's system viewer — great for iOS Safari when in-app ARKit Cap is not the active path.",
          "Chrome handoff opens Custom Tabs to an HTTPS origin configured for WebXR when Cap Android cannot use native. Orbit is the honest non-AR fallback.",
        ],
      },
    ],
  },
  {
    id: "why-not-webxr-only",
    section: "platforms",
    title: "Why not only WebXR?",
    summary: "Browser limits vs native tracking quality inside the Capacitor app.",
    status: "explained",
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
          "Cross-platform products often keep a PWA WebXR ladder for browsers and a Capacitor native plugin for the installable app — exactly the mode ladder you are standing on.",
          "When you leave this Learn sheet and Start AR, watch Instant Placement or plane cues, then place and gesture. Coach captions name the same ideas in shorter form.",
        ],
      },
    ],
  },
  {
    id: "kind-marker",
    section: "kinds",
    title: "Marker / image tracking",
    summary:
      "Android live: lock the model to a printed image target — separate from the floor lab.",
    status: "live",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Image or marker tracking locks a pose to a known 2D target (poster, QR-like fiducial, product pack). The camera recognizes the target and parents content to it.",
          "Useful for packaging, museum labels, and print campaigns. Different failure mode than plane SLAM: no target in view means no lock.",
        ],
      },
      {
        heading: "Try it",
        paragraphs: [
          "On the Capacitor Android app, open How it works → Marker / image tracking → Try in AR. That starts a separate native session (placementMode: image) — not the floor-plane lab. Home Start AR still opens Instant Placement / planes.",
          "Print the bundled target markers/deez_image_target.png (also at /markers/deez_image_target.png in the web build) about 16 cm / 6 in wide on matte paper. Point the camera at it; the model parents to the image when ARCore locks. Rotate and pinch still work; two-finger move is a no-op because the print is the pose. Feature-point and depth overlays stay off so the marker lesson stays clear.",
          "Browser, WebXR, and iOS do not run this demo yet. Try in AR on those surfaces explains that you need the Android app. iOS ARKit image anchors are deferred.",
        ],
      },
    ],
  },
  {
    id: "kind-slam",
    section: "kinds",
    title: "Markerless plane / SLAM",
    summary:
      "World tracking from feature points and planes — live lab plus native Android feature-point HUD.",
    status: "live",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Simultaneous localization and mapping (SLAM) builds a sense of the room from moving-camera feature points, then proposes horizontal (and sometimes vertical) planes.",
          "This app's native and WebXR place-on-floor demos are markerless plane AR: you scan, tap, and the model rides a world anchor.",
        ],
      },
      {
        heading: "Try it",
        paragraphs: [
          "Start AR on a supported phone. On native Android, cyan feature-point dots and a count label show ARCore's tracking map while you scan; they dim after you place so the model stays the focus. Coach captions walk scan → ready → place → gesture. Pair with Hit cascade & Instant Placement topics.",
          "The feature-point HUD is a teaching overlay on Android (ARCore point cloud). It is not drawn in WebXR or iOS in this pass.",
        ],
      },
    ],
  },
  {
    id: "kind-instant",
    section: "kinds",
    title: "Instant / estimated placement",
    summary: "Early approximate poses before dense geometry — live on this ladder.",
    status: "live",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Instant Placement (ARCore) and estimated planes (ARKit) are techniques to shorten time-to-first-place. Poses may refine as the map matures.",
          "Covered in depth under Instant Placement vs planes and Native iOS path.",
        ],
      },
    ],
  },
  {
    id: "kind-face",
    section: "kinds",
    title: "Face / body tracking",
    summary: "Mesh or landmarks on a face or body — separate mode, not floor place.",
    status: "roadmap",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Face tracking attaches content to facial landmarks or a face mesh (filters, try-on). Body tracking extends the idea to skeleton joints.",
          "Requires different session configuration than horizontal plane AR and usually a front camera.",
        ],
      },
      {
        heading: "In this app",
        paragraphs: [
          "Roadmapped as an optional face-mesh peek (iOS ARKit first). Not part of the default place-on-floor lesson.",
        ],
      },
    ],
  },
  {
    id: "kind-geo",
    section: "kinds",
    title: "Geo / location AR",
    summary: "Content tied to GPS / geospatial anchors — hard outdoor QA.",
    status: "roadmap",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Geo AR places content at real-world coordinates (VPS / geospatial APIs, GPS + compass). Great for wayfinding and site-scale storytelling; sensitive to outdoor conditions and permissions.",
        ],
      },
      {
        heading: "In this app",
        paragraphs: [
          "Hard-deferred: needs location permissions and outdoor device QA. Explained here only until a later epic.",
        ],
      },
    ],
  },
  {
    id: "kind-occlusion",
    section: "kinds",
    title: "Occlusion & depth",
    summary:
      "Real geometry hiding virtual content — Android depth heatmap peek plus automatic depth.",
    status: "live",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Depth and people occlusion let real objects appear in front of virtual ones. Phone AR often uses depth APIs or person segmentation.",
        ],
      },
      {
        heading: "Try it",
        paragraphs: [
          "Start AR on a native Android session. Where ARCore depth is supported, a semi-transparent heatmap covers the camera while you scan (near reads warm, far reads cool). After you place, it dims so the model stays the focus. Phones without depth skip the overlay; placement still works.",
          "This is a CPU depth-image teaching peek, not a people-occlusion mesh. It is not drawn in WebXR or iOS in this pass.",
        ],
      },
    ],
  },
  {
    id: "kind-light",
    section: "kinds",
    title: "Light estimation & shadows",
    summary: "Match virtual lighting to the room — fixed light in this demo for clarity.",
    status: "explained",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Light estimation samples the camera feed (and sometimes probes) so virtual materials respond to real intensity and color temperature. Shadows sell contact with the plane.",
        ],
      },
      {
        heading: "In this app",
        paragraphs: [
          "The educational native path keeps a predictable Filament directional light. A light-estimate readout viz is roadmapped for Phase 3 so you can contrast fixed vs estimated lighting.",
        ],
      },
    ],
  },
  {
    id: "kind-cloud",
    section: "kinds",
    title: "Cloud / multi-user anchors",
    summary: "Shared world poses across devices — not in this build.",
    status: "roadmap",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "Cloud anchors (ARCore Cloud Anchors, ARKit location anchors, commercial sync) let multiple devices resolve the same world pose for shared sessions.",
        ],
      },
      {
        heading: "In this app",
        paragraphs: [
          "Out of scope for the single-device teaching lab. Explained so you can place it on the taxonomy map.",
        ],
      },
    ],
  },
  {
    id: "kind-delivery",
    section: "kinds",
    title: "Web vs native vs hybrid delivery",
    summary: "How the experience reaches the phone — ties directly to the mode ladder.",
    status: "live",
    sections: [
      {
        heading: "Three delivery styles",
        paragraphs: [
          "Pure native (SwiftUI/Compose + ARKit/ARCore) maximizes engine access. Pure web (WebXR / Quick Look links) maximizes reach. Hybrid (this Capacitor app) keeps one UI codebase with a native plugin under a transparent WebView.",
          "The mode ladder is the practical expression of that choice: climb as high as the container allows.",
        ],
      },
    ],
  },
  {
    id: "stack-arcore-arkit",
    section: "stacks",
    title: "ARCore + SceneView vs ARKit",
    summary: "Native engines behind this app's top rung.",
    status: "live",
    sections: [
      {
        heading: "Android",
        paragraphs: [
          "ARCore provides tracking; SceneView 2.x hosts ARSceneView and Filament rendering in the native-ar plugin. Instant Placement, plane grids, the feature-point HUD, the depth heatmap peek, and image-target (Augmented Image) placement are ARCore-flavoured teaching tools.",
        ],
      },
      {
        heading: "iOS",
        paragraphs: [
          "ARKit owns planes and raycasts; GLTFKit2 loads models. Soft→strict raycast mirrors Instant Placement's educational goal. Pure RealityKit/SceneKit apps are siblings in the same stack family — this lesson stays on the shared plugin API.",
        ],
      },
    ],
  },
  {
    id: "stack-webxr-three",
    section: "stacks",
    title: "WebXR + Three.js",
    summary: "Browser immersive-ar path — never Cap System WebView.",
    status: "live",
    sections: [
      {
        heading: "Stack shape",
        paragraphs: [
          "WebXR immersive-ar + hit-test, rendered with Three.js in this repo. Excellent for HTTPS reach; constrained inside Android System WebView, which is why Cap prefers native.",
        ],
      },
    ],
  },
  {
    id: "stack-quicklook",
    section: "stacks",
    title: "Quick Look / USDZ",
    summary: "Apple system AR viewer launched from the web.",
    status: "live",
    sections: [
      {
        heading: "System viewer",
        paragraphs: [
          "iOS Safari can open Quick Look via an <a rel=\"ar\"> style path / USDZ presentation. Great fallback when in-app ARKit Cap is not active. Interaction stays in Apple's viewer, not our gesture stage.",
        ],
      },
    ],
  },
  {
    id: "stack-shells",
    section: "stacks",
    title: "Shells: Cap, AR Foundation, pure native",
    summary: "How teams wrap AR engines in a product container.",
    status: "explained",
    sections: [
      {
        heading: "Choices",
        paragraphs: [
          "This product uses Capacitor as the hybrid shell. Unity AR Foundation is a common game-engine cross-platform wrapper over ARCore/ARKit. Pure native apps call the SDKs directly from Kotlin/Swift.",
          "None of those shells change the underlying kinds of AR — they change who owns UI and how you ship updates.",
        ],
      },
    ],
  },
  {
    id: "stack-commercial",
    section: "stacks",
    title: "Commercial web AR stacks",
    summary: "8th Wall, Vuforia, and friends — context only, not integrated.",
    status: "explained",
    sections: [
      {
        heading: "Context",
        paragraphs: [
          "Commercial engines (historically 8th Wall for WebAR, Vuforia for marker/vision, and others) package tracking, hosting, and tooling. Useful landmarks when comparing industry options.",
          "This educational app does not integrate them; it teaches with open ARCore/ARKit/WebXR paths you can inspect in-repo.",
        ],
      },
    ],
  },
];

export function getLearnTopic(id: string | null): LearnTopic | null {
  if (!id) return null;
  return LEARN_TOPICS.find((topic) => topic.id === id) ?? null;
}

export function topicsForSection(section: LearnSectionId): LearnTopic[] {
  return LEARN_TOPICS.filter((topic) => topic.section === section);
}

export const MODE_LABELS: Record<string, string> = {
  native: "native (ARCore / ARKit)",
  webxr: "WebXR",
  quicklook: "Quick Look",
  chrome: "Chrome handoff",
  orbit: "orbit viewer",
};

export type CoachMilestone = "scan" | "ready" | "placed" | "gesture" | "orbit";

export function coachForMilestone(
  mode: string,
  milestone: CoachMilestone,
  placement: "plane" | "image" = "plane",
): { text: string; topicId: LearnTopicId } {
  if (mode === "orbit" || milestone === "orbit") {
    return {
      text: "Drag to rotate · pinch to scale — orbit (no world anchors) · Learn: orbit-control",
      topicId: "orbit-control",
    };
  }
  if (placement === "image") {
    switch (milestone) {
      case "scan":
        return {
          text: "Point camera at the marker · Learn: kind-marker",
          topicId: "kind-marker",
        };
      case "ready":
        return {
          text: "Marker locked — model will sit on the print · Learn: kind-marker",
          topicId: "kind-marker",
        };
      case "placed":
        return {
          text: "Drag rotate · pinch scale · stays on the print · Learn: kind-marker",
          topicId: "kind-marker",
        };
      case "gesture":
        return {
          text: "Open Learn — marker vs plane tracking · Learn: kind-marker",
          topicId: "kind-marker",
        };
      default:
        return {
          text: "Point camera at the marker · Learn: kind-marker",
          topicId: "kind-marker",
        };
    }
  }
  switch (milestone) {
    case "scan":
      return {
        text: "Move the phone — SLAM finds a surface · Learn: kind-slam",
        topicId: "kind-slam",
      };
    case "ready":
      return {
        text: "Surface ready — tap to anchor · Learn: hit-cascade",
        topicId: "hit-cascade",
      };
    case "placed":
      return {
        text: "Drag rotate · pinch scale · two-finger move · Learn: gestures",
        topicId: "gestures",
      };
    case "gesture":
      return {
        text: "Open Learn — cross-platform ladder & Instant Placement · Learn: cross-platform",
        topicId: "cross-platform",
      };
    default:
      return {
        text: "Explore the room, then place · Learn: mode-ladder",
        topicId: "mode-ladder",
      };
  }
}
