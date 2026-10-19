# Office 3D

An additive page at `#/office`. All new styling is scoped under `.office3d-root`.

- `model.ts`: pure layout validation, collision detection, defaults and activity projection.
- `models.mjs`: original procedural meshes, used by the scene and asset generator.
- `OfficeScene.tsx`: isolated Three.js renderer, camera, picking, dragging and companion animation.
- `../../pages/Office3DPage.tsx`: real workspace data, inspector and local editor history.

Furniture edits are drafts until Save. Cancel leaves the saved layout unchanged. Layout storage is versioned and keyed by workspace and user; it does not write to Supabase. JSON import validates identities, bounds, numeric values, type, capacity and collisions. Task edits reuse the existing TaskDetailDrawer and service callbacks. The 3D representation is activity visualization, not presence tracking.

Build dependencies: Three.js 0.170.0 and matching type definitions. React stays at version 18; the scene uses direct Three.js within an isolated React component, avoiding a second React renderer and extra editor libraries. No external CDN is required at runtime.

Generate portable assets with `node scripts/generate-office-assets.mjs`. Models in `public/office3d/` use the same mesh builders as the page. Companion GLB includes Idle, Blink, Wave, Celebrate, Typing, Walk, Nod and Sit clips. The eight human GLB clips are sampled from the same pose controller used by the dashboard; live encounter timing and booking state remain application logic.

Visual/interaction studies: https://sael.net/interior/, https://sael.net/moods/ and the installed Munder Difflin 0.5.5 OfficeFloor. No source, brand artwork, private data, tracking or assets from those products are included. The geometry and controller here are original implementations for Nayagement.

## Run and verification

- Run `npm run dev`, then choose **Office 3D** in the sidebar (route `#/office`).
- `npm run test:office3d`: validates layout round-trips, import rejection, bounds/collisions, timezone-aware activity filters and exported GLB structure/animation clips.
- `npm run build`: TypeScript and production bundle. The Three.js page is lazy-loaded; Vite reports a size warning for large chunks.
- Local browser fixture verified rendering, legacy Dashboard navigation, task detail drawer, dark appearance, add furniture, Undo/Redo, save/reload persistence and cancel. Live Supabase writes and mobile device rendering were not exercised.

This addition has not been deployed. Existing DashboardPage.tsx and app.css retain their pre-implementation content, including the user's existing edits. Furniture layouts are device-local and do not sync across browsers/devices.

## Reference plan and scheduled consultations

Plan 3 adapts the user's Planner 5D office (https://planner5d.onelink.me/stDT/0w8oc9kx), inspected in the browser: central open office; lounge at upper left; service wing below it; two meeting rooms on the right; two front offices. The lounge serves as waiting, the right rooms serve review and consultation, and the front offices serve reception and planning. Pantry and washrooms are static scenery. The asymmetric footprint and outer windows follow that arrangement; dimensions and furniture are adapted for dashboard use rather than a construction drawing.

Eight fixed waiting chairs and the consultation table/chairs keep the compact lounge and service routes usable. Other furniture remains editable. Door positions and additional studio doors are shared data; sliding door leaves park along the wall. Protected circulation follows the studio perimeter from the front entrance through reception to the left waiting lounge, and from there across the studio's lower edge to consultation on the right.

Legacy plans 1/2 migrate to plan 3 without mutating the input. Default furnishing IDs receive new reference placements; custom items are transformed and kept only if they fit without collisions or blocking protected paths. Floor/wall/daylight settings are preserved. Before saving a migrated layout, its original local storage value is backed up under the same key plus `:legacy-plan-1` or `:legacy-plan-2`. Layout storage remains device-local, with no database layout writes.

A dedicated seated consultant stays at the service table. Guest states use booking `startsAt`, `endsAt`, `createdAt` and local date. New/Confirmed bookings for today wait from creation; cancelled/completed and other-day bookings are absent. At start they walk to the guest chair (up to 12 seconds), sit, and at end walk back through reception (22 seconds), then disappear. Reload reconstructs clock phase/position. Overlapping appointments queue for one consultant within their scheduled times; waiting does not extend calendar slots. Visitors beyond eight chairs use standing positions. The scene follows activity filters; the live daily summary counts workspace bookings. Existing App subscriptions/polling supply updates.

Latest validation: production build, plan migration, reference room arrangement, every doorway's protection, default furniture/path clearance, consultation phase boundaries, short/overlapping appointments and GLB structure/animations pass. The local browser fixture rendered the reference layout with a seated consultant and a waiting guest. Production Supabase writes and mobile device rendering were not exercised. Existing DashboardPage.tsx and app.css remain byte-identical to their pre-implementation state.

## Human characters and interactions

Characters are now stylized humans with faces, hair, office shirts, trousers and shoes. Their shoulders, elbows, hands/fingers, hips, knees and ankles are distinct geometry with independent rig pivots. The robot screen, fur, rabbit ears and propeller have been removed. Shirt colors follow the room palette; face/hair variants distinguish occupants.

`motion.mjs` drives human poses. Standing gait uses alternating leg/arm swings and knee bends without squash/stretch. Seated hips remain above cushions, thighs bend forward and shins extend to bring shoes near the floor. The torso, hands and feet stay outside chair/backrest/desktop geometry in sampled tests. Workstation pairing keeps people facing their computers after furniture edits. Typing, thinking pauses, conversational nods, waves, blinks and encounter greeting timing remain active; reduced-motion and editing modes suppress decorative motion.

The eight GLB clips (Idle, Blink, Wave, Celebrate, Typing, Walk, Nod, Sit) are baked from the same human pose controller. Runtime clip names remain compatible with previous asset downloads, but their contents now animate human joints. Local browser preview rendered seated human occupants at workstations and in consultation/review rooms. Regression checks cover explicit limb pairs, human-face geometry, absence of robot attachments, seated clearances, computer orientation and walking height under door lintels. Build and tests pass; no production deployment or database writes were performed.

## Hair and visual gender variants

Twelve avatar presets alternate male/female presentation: crop, bob, side-part, ponytail, quiff, bun, curls, pixie, swept, waves, textured and braid. Hair is actual distinct mesh geometry rather than only a color change. Small collar/neckline details complement the styles; the same articulated human anatomy and animation rig are retained.

The default six staff occupants include three male and three female avatar presets. A component-lifetime registry keys appearances by workstation/consultant/booking identity, gives the first twelve registered occupants distinct base hairstyles, and retains assignments through filtering, new arrivals and movement. Additional occupants use deterministic color/length variations. These are visual avatar choices, not assertions about a real person's gender: booking records have no gender field and names are not used to infer it.

`human-variants.glb` contains all twelve human presets as a gallery, and `human-appearances.json` lists their metadata. Tests verify unique base styles, the balanced default staff, stable existing assignments after new arrivals, per-variant anatomy and door clearance, plus the exported GLB structure.

Hair coverage fix: every style now includes a continuous ellipsoidal scalp shell outside the skin surface, with a shaped front hairline and lower side/back coverage. This replaces flattened caps that exposed the crown. Geometry ray tests sample 80 crown directions for each of the twelve styles, verify hair is the first visible surface, and separately check that the face remains visible below the hairline.
