# Moon Toybox — baked animation (0.2.0)

No visitor-side 3D rendering is needed. The included cycles are rendered from the original licensed SDF shapes with the real pearl shader, not a CSS rotation of a still image. Each loop is 96 frames / 24 fps / 4 seconds, ±30° rocking, with transparent WebP atlases and JSON metadata. Only moon, truck and knot are distributed; teddy is excluded.

## Browser baker

Open `bake.html` on the Toybox site. Choose shape, frame size (192 or 384), number of frames, frame rate and angular amplitude. Press **Запечь**, inspect the preview, then **Сохранить файлы**. Chromium supports saving directly into a directory. Other browsers download sheets and manifest separately: put all files into the same folder. Baking requires hardware WebGL; playback does not. Cancellation disposes the renderer. The original files are not overwritten by the browser unless you explicitly select and approve a destination.

## Package API

```js
import { bakeAnimation, saveBake } from 'moon-toybox/bake';
const result = await bakeAnimation({
  shape: 'moon', size: 192, frames: 96, fps: 24,
  amplitude: 30, base: '/fields/',
  onProgress: ({frame, frames}) => console.log(frame, frames),
});
await saveBake(result);
```

Serve library assets over HTTP(S), with three and three-mesh-bvh available to the bundler. `result.files` contains `{name, blob}` entries; `result.manifest` is plain JSON. Nothing is persisted automatically in a visitor session. Call the baker only from an explicit authoring action or build task.

## CLI

Requires Node, Playwright and its Chromium browser. Start this source site's Vite dev server first (`npm install`, `npm run dev -- --port 5193`). Then:

```sh
node bake-cli.mjs --url http://127.0.0.1:5193/moon-toybox-site/ --out public/animations --size 192
node bake-cli.mjs --url http://127.0.0.1:5193/moon-toybox-site/ --out public/animations --size 384
```

The package also exposes `moon-bake` with the same arguments. `--url` must point to a served **source baker** (with `lib/bake.js` available), not an arbitrary production bundle. Optional `--shape moon|truck|knot`, `--frames`, `--fps`. Runs a headed hardware-accelerated Chromium and saves each result into `<shape>-<size>/`. It will fail rather than silently CPU-raymarch on a software renderer.

## Playback

Copy `animations/` to your asset directory. Keep an ordinary image as the first paint/error/reduced-motion fallback:

```html
<img data-moon-icon="moon" width="96" height="96" src="/icons/moon-high.webp" alt="Moon">
```

```js
import { upgradeBaked } from 'moon-toybox/baked';
const dispose = upgradeBaked(document, {base: '/animations/'});
```

`data-baked-size="large"` selects the 384 variant; otherwise 192. Playback uses Canvas2D at the manifest frame rate, shares decoded atlases within one mount and stops timers when offscreen/hidden/reduced motion. Reduced motion keeps the original image without downloading the animation. Call `dispose()` on teardown to restore original images and remove observers/timers. Reparenting travelers preserves their enclosing `.moon-live` wrapper.

`upgradeTo3D` now defaults to `mode:'baked'`; explicitly use `mode:'live'` for interactive hardware WebGL. This is an intentional behavior change in 0.2.0. Do not load both runtimes on the same images.

## Distribution and licensing

Keep CREDITS.html with the package. Truck: dehariyalokesh1998, CC BY 4.0. No teddy model, fields or generated animation is included. WebP transparency and Canvas2D work without WebGL, but video/2D compositing may still cost CPU on software-only machines; measure actual devices rather than assuming zero cost.
