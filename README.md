# Snap2Skill

Snap2Skill is a focused developer tool that turns whiteboard photos, notebook flowcharts, and SOP sketches into portable Agent Skills. The workflow is intentionally small: provide a sketch, inspect the detected flow, copy the generated `SKILL.md`, and validate the skill in a live sandbox.

## Product workflow

1. **Capture** — Upload a process sketch or load the built-in incident-triage sample.
2. **Interpret** — Extract workflow nodes, decisions, owners, and output contracts.
3. **Compile** — Generate a standard-compliant Agent Skill in Markdown.
4. **Validate** — Run realistic prompts through the Live Sandbox before sharing the skill.

The UI is built as a single-screen studio with a responsive input hub and output studio. The sample workflow makes the product demonstrable without an external image upload.

## Stack

- React 19 + TypeScript
- Vite 7
- Express runtime for server-side model calls
- Tailwind CSS v4 and custom CSS tokens
- Lucide React icons
- Google Gemma 4 through the Gemini API

## Local development

```bash
pnpm install
pnpm dev
```

The app runs on port `3000` by default. For a static-only preview:

```bash
pnpm dev:static
```

Useful checks:

```bash
pnpm check
pnpm build:static
```

## Gemma configuration

Snap2Skill is designed to use `gemma-4-26b-a4b-it` for both sketch compilation and Live Sandbox chat. Keep the Google AI Studio key server-side as `GOOGLE_GEMMA_API_KEY`; never expose it through `VITE_*` variables or client-side source.

The official Gemma API supports text and image understanding through the Gemini API. The key can be provided in local development through the environment or through the managed project secret configuration. The production runtime should receive the same secret through the deployment platform's protected environment settings.

## Vercel deployment

1. Import the repository into Vercel.
2. Use the Vite build command `pnpm build:static`.
3. Use `dist/public` as the output directory for the static UI.
4. Add `GOOGLE_GEMMA_API_KEY` as a protected environment variable for the environments where server-side Gemma calls are enabled.
5. If using the Express API route for compilation and chat, deploy the server runtime rather than only the static output and make sure the runtime exposes the required `/api/*` routes.

The included `vercel.json` already sets the Vite framework, build command, output directory, and SPA fallback routing.

Do not commit `.env` files, API keys, generated uploads, or user-provided sketch images.

## Design system

The current visual direction is a bright developer studio: soft white surfaces, a cool off-white canvas, crisp lavender-gray borders, dark graphite text, and electric indigo for actions, active tabs, and model status. This keeps the interface high-contrast and calm while preserving Snap2Skill's recognizable violet signal.

## Project structure

- `client/src/pages/Home.tsx` — the interactive studio and local workflow state machine.
- `client/src/index.css` — responsive layout, bright theme tokens, flowchart canvas, code view, and sandbox styling.
- `server/_core/index.ts` — Express runtime entrypoint and API surface.
- `client/public/manus-routes.json` — managed route declaration for the home experience.

## License

MIT
