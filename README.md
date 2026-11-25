# Pocket Brief

Raw meeting notes in, a one-page decision brief out — computed on your device by
Gemini Nano, with a cloud fallback you control.

Built for **#BuildHybridAI 2026** (Google × Devpost), using **Firebase AI Logic**
hybrid inference with **App Check**.

Live demo: https://abhinavshukla152005-beep.github.io/pocket-brief/

## What it does

Paste messy notes. Pick where the model should run. Get five fixed sections:
Summary, Decisions, Owners and dates, Risks, Next steps. Names and dates are kept
verbatim; missing dates become "date unset".

Four modes, mapped one-to-one onto `InferenceMode`:

| UI | InferenceMode | Behaviour |
|---|---|---|
| Auto | `PREFER_ON_DEVICE` | Nano if ready, cloud otherwise |
| Private | `ONLY_ON_DEVICE` | never leaves the browser; errors if Nano is unavailable |
| Quality | `ONLY_IN_CLOUD` | cloud only (`gemini-3.5-flash-lite`) |
| Cloud first | `PREFER_IN_CLOUD` | cloud, device as backup |

Every result is labelled with `response.inferenceSource` (`ON_DEVICE` /
`IN_CLOUD`), so the page can say where the answer actually came from.

## Requirements

- Chrome on desktop, version 139+ (for the built-in Gemini Nano API).
- Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, then
  restart Chrome. The model downloads on first use (a few GB) — the
  *Prepare on-device model* button shows progress.
- Without Nano, Auto falls back to the cloud; Private mode tells you the device
  model is unavailable instead of silently sending notes away.

## Run locally

```bash
python -m http.server 8099
# open http://localhost:8099
```

No build step, no npm. The Firebase SDK loads from gstatic as ES modules.

## How it is wired

- `app.js` — Firebase init, App Check, mode mapping, prompt, device-model
  preparation, status rendering.
- Firebase project `default-gemini-project-98b1f`, web app `my-ai-app`.
- App Check is enforced by Firebase AI Logic. This demo build ships the
  registered **debug token** the hackathon rules explicitly permit
  ("debug tokens are accepted in submissions"). Do not reuse this token
  elsewhere.

## Honest limits

- On-device inference is single-turn text only (a Nano constraint); no chat
  history, no images.
- The on-device path needs a real user gesture to start the model; the page
  triggers it from the button click.
- The sample notes are synthetic (a fictional payments squad).
- Routing is decided per request; there is no request queueing or retry layer.
