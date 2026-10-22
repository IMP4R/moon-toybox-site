# Baked pipeline verification

- CLI rendered moon/truck/knot at 192 and 384, 96 frames each, using real SDF pearl rendering in headed Chromium.
- Browser production baker rendered a 12-frame moon and enabled saving; real WebP alpha corner=0 and nonempty content verified.
- Node tests: manifest validation rejects unsafe paths and invalid budgets; teddy export rejected before rendering.
- Reduced-motion test: visible baked canvases change from 4 to 0, original images restored.
- Published production Toybox on simulated software WebGL: 4 baked animations active, ambient video paused and src removed. Main-thread TaskDuration over six seconds: 1.33% of one core on this Mac. This is NOT total CPU and NOT a Windows measurement.
- Earlier Windows WARP test before ambient video removal: 43.4% total-machine CPU with four baked animations and ambient video. Do not present that as final performance. A follow-up Windows measurement after removal remains pending: MCP connection currently resets.
- Release 0.2.1 archive checked: 68 files, baker/runtime/credits present, no teddy assets. Explicit allowlists make packaging reproducible.
- Behavior extractor produced 0 nodes; 0/0 reported by coverage is not meaningful coverage. Focused tests above are the actual evidence; full lifecycle/save-dialog/mobile acceptance is not claimed.

Additional browser acceptance: saveBake wrote each sheet plus manifest through a stubbed File System Access API (native picker UI was not automated). Cancellation raised AbortError and disposed renderer. Playback lifecycle: 39 real drawImage calls, then zero further draws after moving offscreen; dispose removed canvas and restored original image and opacity. Production master already verified real 12-frame rendering.

Release-consumer smoke test: imports from generated release package lib/baked.js, lib/bake.js and bake-cli.mjs succeeded; exported functions exist; packaged bakeAnimation rejects teddy. Published deploys verified built for Moon Studio 68712c6 and Toybox 73c6805; later 0.2.1 package release source is ff92682.

Remaining: final Windows total-process CPU after ambient removal. Windows MCP returned connection reset consistently in autonomous rounds 2, 3 and 4; no final Windows performance claim. Main-thread software-renderer test on Mac is not a substitute for total-process Windows CPU.
