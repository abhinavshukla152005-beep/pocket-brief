import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getAI, getGenerativeModel, GoogleAIBackend, InferenceMode,
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-ai.js";
import {
  initializeAppCheck, ReCaptchaEnterpriseProvider,
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXQcGS4e1I1N4axd8t2_s4BpRYG8tPiFQ",
  authDomain: "default-gemini-project-98b1f.firebaseapp.com",
  projectId: "default-gemini-project-98b1f",
  storageBucket: "default-gemini-project-98b1f.firebasestorage.app",
  messagingSenderId: "163668924289",
  appId: "1:163668924289:web:298d2b76ed83fa8e637a80",
};

// Demo build: this token is registered in Firebase console > App Check > my-ai-app.
// The hackathon rules explicitly accept App Check debug tokens in submissions.
self.FIREBASE_APPCHECK_DEBUG_TOKEN = "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const app = initializeApp(firebaseConfig);

let appCheckReady = false;
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider("6Lc0000000000000000000000000000000000000000"),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckReady = true;
} catch (err) {
  console.warn("App Check init failed:", err);
}

const ai = getAI(app, { backend: new GoogleAIBackend() });

const CLOUD_MODEL = "gemini-3.5-flash-lite";

const MODES = {
  auto: { mode: InferenceMode.PREFER_ON_DEVICE },
  device: { mode: InferenceMode.ONLY_ON_DEVICE },
  cloud: { mode: InferenceMode.ONLY_IN_CLOUD, model: CLOUD_MODEL },
  cloudfirst: { mode: InferenceMode.PREFER_IN_CLOUD, model: CLOUD_MODEL },
};

const el = {
  notes: document.getElementById("notes"),
  run: document.getElementById("runBtn"),
  prep: document.getElementById("prepBtn"),
  sample: document.getElementById("sampleBtn"),
  copy: document.getElementById("copyBtn"),
  output: document.getElementById("output"),
  status: document.getElementById("status"),
  chip: document.getElementById("deviceChip"),
  net: document.getElementById("netChip"),
  count: document.getElementById("charCount"),
  downloadWrap: document.getElementById("downloadWrap"),
  downloadBar: document.getElementById("downloadBar"),
  downloadText: document.getElementById("downloadText"),
  timing: document.getElementById("timing"),
};

const SAMPLE = `sync fri 21 nov — payments squad + infra (40 min)
- ravi: psp webhook retries still double-count on timeout. fix merged thursday, needs soak. decision: hold the invoicing beta until 1 dec.
- priya: we can't ship the new dashboard without the token rotation work; she owns it, target 27 nov.
- idea from dhruv: bundle reconciliation report as an add-on instead of free tier. nobody objected; needs pricing check by 25 nov (ravi).
- risk: EU data residency review still open — legal says answer by 3 dec or the launch slips to jan.
- webhook dedupe: add a replay console so support can requeue safely (priya, small, after token rotation)
next sync 28 nov. bring a one-pager on the add-on pricing.`;

const PROMPT_HEAD = [
  "You write decision briefs from messy meeting notes.",
  "Output EXACTLY these five headings, each on its own line, with 1-4 terse bullets under each.",
  "SUMMARY",
  "DECISIONS",
  "OWNERS AND DATES",
  "RISKS",
  "NEXT STEPS",
  "No preamble. No markdown symbols. Max 160 words. Keep names and dates exactly as written; if a date is missing write 'date unset'.",
  "",
  "NOTES:",
].join("\n");

function setStatus(text, kind) {
  el.status.textContent = text;
  el.status.className = "status" + (kind ? " " + kind : "");
}

async function refreshDeviceChip() {
  if (typeof LanguageModel === "undefined") {
    el.chip.textContent = "no on-device model API";
    el.chip.className = "chip bad";
    return;
  }
  try {
    const a = await LanguageModel.availability();
    const labels = {
      readily: ["device ready", "ok"],
      available: ["device ready", "ok"],
      downloadable: ["device model downloadable", "warn"],
      downloading: ["device model downloading", "warn"],
      unavailable: ["device model unavailable", "bad"],
    };
    const [text, cls] = labels[a] || [String(a), ""];
    el.chip.textContent = text;
    el.chip.className = "chip " + cls;
  } catch (err) {
    el.chip.textContent = "device check failed";
    el.chip.className = "chip bad";
  }
}

function refreshNet() {
  el.net.textContent = navigator.onLine ? "online" : "offline";
  el.net.className = "chip " + (navigator.onLine ? "ok" : "bad");
}

function pickMode() {
  const v = document.querySelector('input[name="mode"]:checked').value;
  return { key: v, opts: MODES[v] };
}

function modelFor(opts) {
  return getGenerativeModel(ai, opts);
}

async function ensureDeviceModel(model) {
  if (typeof LanguageModel === "undefined") return false;
  try {
    const a = await LanguageModel.availability();
    if (a === "readily" || a === "available") return true;
    if (a === "unavailable") return false;
    el.downloadWrap.classList.remove("hidden");
    el.downloadText.textContent = "preparing on-device model…";
    await model.initializeDeviceModel((p) => {
      const pct = Math.round(p * 100);
      el.downloadBar.style.width = pct + "%";
      el.downloadText.textContent = `preparing on-device model… ${pct}%`;
    });
    el.downloadWrap.classList.add("hidden");
    return true;
  } catch {
    el.downloadWrap.classList.add("hidden");
    return false;
  }
}

async function prepareDevice() {
  el.prep.classList.add("hidden");
  el.downloadWrap.classList.remove("hidden");
  setStatus("Preparing the on-device model. One-time download, a few GB.", "");
  try {
    const model = modelFor({ mode: InferenceMode.PREFER_ON_DEVICE });
    await model.initializeDeviceModel((p) => {
      const pct = Math.round(p * 100);
      el.downloadBar.style.width = pct + "%";
      el.downloadText.textContent = pct < 100 ? `downloading model… ${pct}%` : "finalising model…";
    });
    el.downloadText.textContent = "on-device model ready";
    setStatus("Gemini Nano is ready in this browser.", "on-device");
    await refreshDeviceChip();
  } catch (err) {
    el.downloadText.textContent = "could not prepare the model";
    setStatus("Could not prepare the on-device model: " + err.message, "error");
  } finally {
    setTimeout(() => {
      el.downloadWrap.classList.add("hidden");
      el.prep.classList.remove("hidden");
    }, 2500);
  }
}

async function run() {
  const notes = el.notes.value.trim();
  if (!notes) {
    setStatus("Paste some notes first.", "error");
    return;
  }
  const { key, opts } = pickMode();
  el.run.disabled = true;
  el.output.textContent = "…";
  setStatus("Thinking…", "");

  const t0 = performance.now();
  try {
    const model = modelFor(opts);

    // The SDK may fall back to the cloud even in ONLY_ON_DEVICE, so Private
    // mode verifies the device model itself and never lets a cloud answer through.
    if (key === "device") {
      const ready = await ensureDeviceModel(model);
      if (!ready) {
        el.output.textContent = "—";
        setStatus("Gemini Nano is not available in this browser, so nothing was generated and nothing was sent anywhere. Install the model in Chrome 139+ and retry.", "error");
        el.run.disabled = false;
        return;
      }
    }

    const res = await model.generateContent(PROMPT_HEAD + notes);
    const text = res.response.text().trim();
    const src = String(res.response.inferenceSource || "").toUpperCase();
    const ms = Math.round(performance.now() - t0);

    if (key === "device" && src !== "ON_DEVICE") {
      el.output.textContent = "—";
      setStatus("Private mode was violated: the request was answered in the cloud, so the result is discarded. Use Auto if you accept cloud fallback.", "error");
      el.run.disabled = false;
      return;
    }

    el.output.textContent = text || "(empty response)";
    el.timing.textContent = `${key} · ${ms} ms`;

    if (src === "ON_DEVICE" || src === "IN_CLOUD") {
      setStatus(
        src === "ON_DEVICE"
          ? "Answered on-device by Gemini Nano. The notes never left this browser."
          : "Answered in the cloud by Firebase AI Logic. The notes went to Gemini.",
        src === "ON_DEVICE" ? "on-device" : "in-cloud"
      );
    } else {
      setStatus("Answered. Backend not reported by this SDK build (" + key + ").", "");
    }
    refreshDeviceChip();
  } catch (err) {
    const msg = String(err && err.message || err);
    let hint = msg;
    if (/user gesture/i.test(msg)) hint = "Could not start the on-device model — click the button again in Chrome.";
    if (/not available|unavailable/i.test(msg)) hint = "That mode is unavailable right now. Try Auto or Quality. (" + msg + ")";
    el.output.textContent = "—";
    setStatus(hint, "error");
  } finally {
    el.run.disabled = false;
  }
}

el.run.addEventListener("click", run);
el.prep.addEventListener("click", prepareDevice);
el.sample.addEventListener("click", () => {
  el.notes.value = SAMPLE;
  el.notes.dispatchEvent(new Event("input"));
});
el.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.output.textContent);
    el.copy.textContent = "Copied";
    setTimeout(() => (el.copy.textContent = "Copy"), 1200);
  } catch {
    el.copy.textContent = "No access";
  }
});
el.notes.addEventListener("input", () => {
  el.count.textContent = el.notes.value.length + " chars";
});
window.addEventListener("online", refreshNet);
window.addEventListener("offline", refreshNet);

refreshNet();
refreshDeviceChip();
if (!appCheckReady) {
  setStatus("App Check provider unavailable in this browser build; cloud calls may fail.", "error");
}
