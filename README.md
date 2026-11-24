## ⚠️ AI Agent Sync Protocol (READ FIRST)
This `README.md` is a **living specification**. Before making changes, distinguish between:

1. **IMMUTABLE CORE (Do NOT break without explicit user approval):**
   - Live camera only (zero file/gallery uploads).
   - Automated 2-frame timed capture ($t=0\text{s}$ and $t=\Delta t$).
   - Deterministic CIELAB ($\Delta E$) math + Quality Gate (no AI/ML classifiers).
   - Lock-Before-Display protocol + Server-side SHA-256 canonical hashing.
   - Append-only SQLite API (`POST /api/lock`, `GET /api/evidence`, `GET /api/evidence/:id/verify` — no `PUT`/`PATCH`/`DELETE`).

2. **FLEXIBLE LAYER (Free to evolve):**
   - UI/UX layout, CSS styling, color themes, responsive components, animations, and display formatting.
   - Minor UX helpers (e.g., better countdown visuals, clearer ROI reticle, report print/export styling).

**MANDATORY RULE FOR ALL AI AGENTS:**
- Always inspect the **actual current codebase** before assuming `README.md` is up to date on UI/design details.
- Whenever you modify UI, routes, constants, or file structure, **immediately update the corresponding section of `README.md` (and log it in the Changelog below)** so the next AI agent stays 100% synced.

### Change Log (Auto-Updated by AI)
- `2026-11-24`: Initial architecture & spec locked.
- `2026-11-24`: Complete backend and math engine implemented and verified (SQLite append-only layer, canonical SHA-256 locking, 405 mutation guard, Quality Gate, sRGB->CIELAB D65 pipeline, and tamper detection).
- `2026-11-24`: Mobile-first frontend implementation complete (Views 1–4, responsive CSS, hardware permission gate, 2-frame automated capture state machine, Lock-Before-Display presentation, Evidence Vault inspection & tamper verifier). Verified on mobile viewport (390×844) via Chrome DevTools with 0 console/network errors.
- `2026-11-24`: Clinical forensic redesign executed via Stitch MCP (Forensic Precision Laboratory Console) and documented in DESIGN.md. Applied crisp 1px borders, 0px sharp geometry, Public Sans / JetBrains Mono typography, inline SVGs, stacked mobile action buttons, and zero horizontal overflow stacked vault cards. Verified via Chrome DevTools MCP at 390×844.
- `2026-11-24`: Complete redesign and rebuild of `public/index.html` and `public/style.css` into a modern, responsive light clinical forensic UI (#F8FAFC page background, crisp white cards, soft #E2E8F0 borders, 12px radius, Inter typography, #2563EB clinical blue accent). Removed dark terminal/brutalist styling and robotic jargon in favor of natural forensic labels (Hardware Check, Live Capture, Locked Evidence Report, Evidence Vault). Preserved 100% of DOM IDs and event hooks in `public/app.js`. Verified via Chrome DevTools MCP across both Desktop (1280×800) and Mobile (390×844) with 0 console errors, 0 network errors, zero horizontal overflow, and fully responsive grid/stack transitions.
- `2026-11-24`: Implemented 3-Frame Anti-Framing Kinetic Verification Protocol (Frame 1 pre-reagent baseline, Frame 2 post-reagent t=0s, Frame 3 reacted t=5s) and standalone print-ready A4 PDF report (/report.html and /report.js) with deterministic clinical narrative generation, 10-parameter canonical SHA-256 hash lock, and live integrity verification.

# NarcoTest Vision (NTV) — Complete Technical Specification & Architecture Blueprint

> **Official Project Description:** "The NTV system securely locks the drug test results with time & location and provides tamper-proof evidence of results."

---

## 1. Project Identity, Context & Academic Constraints
NarcoTest Vision (NTV) is an academic Software Engineering (SE) project engineered to replace subjective visual interpretation of chemical field drug tests with an objective, deterministic, computer-vision color-matching pipeline bound to cryptographically verifiable metadata.

### Evaluation & Deliverable Constraints
* **Repository Deliverables:** Source Code (`src` / `public` & `server`), IEEE-830 Software Requirements Specification (`docs/NTV_SRS.pdf`), and Presentation (`docs/NTV_Presentation.pptx`, maximum 5 slides, 10-minute defense).
* **Core Design Philosophy (Single-Problem Depth):** The system intentionally avoids broad, multi-module "management system" bloat. Every line of code exists strictly to solve **one atomic problem**: converting a time-sensitive chemical color reaction into an objective mathematical score and locking it into a court-defensible, tamper-evident record.
* **Originality & Engineering Rigor:** Every architectural choice (color space, capture timing, cryptographic primitive, API restrictions, and database model) is explicitly justified against standard alternatives to withstand technical cross-questioning.

---

## 2. Problem Statement & Forensic Threat Model
Standard law enforcement colorimetric field tests (e.g., Marquis, Scott, and Duquenois-Levine reagents) suffer from documented false-positive rates and evidentiary challenges due to four specific failure modes:

1. **Perceptual Subjectivity & Lighting Variance:** Human vision is unreliable under variable street lighting (sodium-vapor lamps, vehicle headlights, night conditions). Standard RGB pixel comparisons also fail because RGB is device-dependent and perceptually non-uniform.
2. **Reaction-Window Timing Bias & Oxidation:** Colorimetric reagents are dynamic chemical reactions, not static snapshots. Reading a test too early misses the target color transition; waiting too long causes atmospheric oxidation (turning almost any reagent dark brown/black), producing false positives.
3. **Gallery Injection & Post-Capture Manipulation:** Allowing standard smartphone photo uploads permits officers or malicious actors to edit images, substitute photos from unrelated cases, or strip/forge EXIF metadata (timestamps and GPS coordinates).
4. **Selective Suppression (Pre-Commit Tampering):** If a system displays the test result *before* committing the record to permanent storage, an operator can selectively discard inconvenient results or tamper with metadata before saving.

---

## 3. Strict Scope Boundaries & Hard Prohibitions (DO NOT IMPLEMENT)
Any AI agent or developer working on this repository **MUST** obey the following hard bans. Do not introduce these features under any circumstances:

* **NO Authentication / User Management:** No login screens, signup flows, JWTs, OAuth, WebAuthn, or role-based dashboards.
* **NO File / Media Uploads:** Zero `<input type="file">` elements, drag-and-drop zones, or gallery pickers anywhere in the frontend. Media ingestion is strictly restricted to live hardware camera streams (`MediaDevices.getUserMedia`).
* **NO Generative AI / Deep Learning / Black-Box Classifiers:** Do NOT call LLM APIs (OpenAI, Gemini, etc.) for report writing, blank-frame detection, or color classification, and do NOT use CNNs/ML models. Forensic evidence must be 100% deterministic, reproducible, auditable, and free of hallucination or training-data bias.
* **NO Blockchain / Distributed Ledgers:** Do not integrate Web3, smart contracts, or external blockchains. Server-side SHA-256 hashing + an append-only relational store provides $O(1)$ tamper detection without latency or infrastructure bloat.
* **NO Mutating API Endpoints:** The backend MUST NOT implement `PUT`, `PATCH`, or `DELETE` routes for evidence records. Immutability is enforced at the API contract level.
* **NO Heavy Frontend Build Toolchains:** Use zero-build Vanilla HTML5, CSS3, and modular ES6 JavaScript to guarantee instant local execution, high readability, and zero dependency breakage during live demos.

---

## 4. System Architecture & Technology Stack

```text
[Mobile/Desktop Browser Client]
 ├── View 1: Pre-Flight Permission Gate (Camera + Geolocation Pre-conditions)
 ├── View 2: Guided 3-Frame Live Capture (Alignment Mode -> Dry Baseline Frame 1 -> Reagent Added -> 5s Incubation -> Frame 2 & Frame 3)
 ├── View 3: Local CV & Anti-Framing Engine (Quality Gate -> 3-Frame Kinetic Analysis -> Reagent Match)
 │            └── Lock-Before-Display: POST /api/lock -> Redirects to /report.html?id=<case_id>
 ├── View 4: Read-Only Evidence Vault (Reverse chronological summary + View Official Report ↗ link)
 └── Standalone Report: /report.html (Print-ready A4 PDF report with deterministic clinical narrative & tamper seal)
        │
        ▼  (JSON over HTTP)
[Node.js + Express Backend]
 ├── Authoritative UTC Timestamp Generator (Server-side; ignores client clock)
 ├── Canonical Serialization & SHA-256 Cryptographic Engine (10-parameter payload)
 └── Append-Only SQLite Persistence Layer (`evidence_records` table)
```

### Stack Specification
* **Frontend:** Vanilla HTML5, CSS3, ES6 JavaScript. Hardware APIs: `navigator.mediaDevices.getUserMedia`, `navigator.geolocation`, HTML5 `<canvas>` 2D pixel manipulation.
* **Backend:** Node.js (v18+) with `express` and `cors`.
* **Database:** SQLite (`better-sqlite3` preferred for synchronous, clean atomic transactions; fallback `sqlite3` if native build fails on Windows).
* **Cryptography:** Node.js built-in `crypto` module (`SHA-256` hex digest).

---

## 5. Exact Repository & File Structure

```text
NarcoTest-Vision/
├── docs/
│   ├── NTV_SRS.pdf                 # IEEE-830 Software Requirements Specification
│   └── NTV_Presentation.pptx       # 5-Slide Defense Deck
├── public/
│   ├── index.html                  # Single-Page Application (4 state-managed views)
│   ├── style.css                   # Clean, high-contrast mobile-first UI styling
│   ├── app.js                      # State machine, permissions, camera/GPS, timer, API calls
│   ├── colorMath.js                # Pure math module: Quality Gate, sRGB->CIELAB, ΔE, Reagent Matcher, 3-Frame Analysis
│   ├── report.html                 # Standalone print-ready A4 PDF forensic report document
│   └── report.js                   # Report population, verification fetch, deterministic narrative generator
├── server/
│   ├── server.js                   # Express app, static serving, strict append-only API, SHA-256 logic
│   └── db.js                       # SQLite connection, schema initialization, read/insert queries only
├── .gitignore                      # Ignores node_modules/, .env, *.db, *.sqlite, *.sqlite3
├── package.json                    # Dependencies and `npm start` script
├── LICENSE                         # MIT License
└── README.md                       # This master specification
```

---

## 6. Frontend State Machine & Functional Requirements

The frontend is a Single-Page Application (SPA) with a top navigation bar switching strictly between **New Test** (Views 1–3) and **Evidence Vault** (View 4).

### View 1: Pre-Flight Permission Gate (Fail-Fast Pre-condition)
* On application load, check and request hardware permissions for **Camera** and **Geolocation (GPS)**.
* Display explicit status badges:
  * `Camera Permission: GRANTED / PENDING / DENIED`
  * `GPS Location: ACQUIRED (lat, lng) / PENDING / DENIED`
* **Hard Gate:** The `Perform Test` button MUST remain `disabled` until **both** Camera and GPS are actively verified. Once granted, the browser persists permission so the user is not re-prompted on subsequent tests.

### View 2: Guided 3-Frame Anti-Framing Capture Sequence
* Clicking `Perform Field Test` initializes the live rear camera feed (`facingMode: "environment"` with fallback to default webcam on laptops) inside a `<video>` element with a centered visual 100×100 px Region of Interest (ROI) Reticle paused in **Alignment Mode**.
* **Step 1 (Alignment & Preparation):** Displays preparation instructions (dry sample placement, capture baseline, add reagent only when prompted) and a `Capture Baseline Sample (Frame 1)` button.
* **Step 2 (Reagent Prompt):** Clicking `Capture Baseline Sample (Frame 1)` snaps **Frame 1** ($t_{\text{pre}}$ unreacted dry sample), executes `evaluateQualityGate` immediately (aborting if invalid), keeps camera tracks active, and displays an amber instruction box with `Reagent Added — Start 5s Reaction`.
* **Step 3 (Automated Reaction & Redirect):** Clicking `Reagent Added — Start 5s Reaction` immediately snaps **Frame 2** ($t = 0\text{s}$ post-reagent), runs an uninterruptible 5.00s countdown, snaps **Frame 3** ($t = 5\text{s}$ reacted), stops all camera hardware tracks, and executes `evaluateThreeFrameAnalysis(roi1, roi2, roi3)` (aborting on Quality Gate failure).
* **Step 4 (Lock-Before-Display & Report Redirection):** Commits evidence via `POST /api/lock` containing `{ frame_1, frame_2, frame_3, delta_e_pre, delta_e, matched_result, gps_lat, gps_lng }`. On `HTTP 201 Created`, immediately redirects to the standalone report `/report.html?id=<case_id>`.

### View 3: Local Mathematical Analysis & Lock-Before-Display
Immediately upon completion of the reaction countdown, the client colorimetry engine executes:
1. **Quality Gate Check:** Evaluates luminance and variance on all three frame ROIs, aborting if any frame fails.
2. **Kinetic & Anti-Framing Analysis:** Computes $\Delta E_{1\to 2}$ ($\Delta E_{\text{pre}}$) and $\Delta E_{2\to 3}$ ($\Delta E$) to identify contaminated baselines or artificial sample substitution before matching against calibrated reagent centroids.
3. **Cryptographic Locking:** Displays `"Cryptographically Locking Evidence..."` while sending `POST /api/lock`. On `201 Created`, navigates directly to `/report.html?id=<case_id>` for the official court-admissible report sheet.

### View 4: Read-Only Evidence Vault & Live Tamper Verifier
* Fetches all committed records via `GET /api/evidence` and displays them in reverse chronological order.
* Each card displays Case ID, UTC timestamp, Pre-Reagent Shift ($\Delta E_{1\to 2}$), Reaction Shift ($\Delta E_{2\to 3}$), GPS Coordinates, and Matched Result.
* Dual actions per card:
  * **"Verify Integrity"**: Executes `GET /api/evidence/:id/verify` to display green `VERIFIED` or red `TAMPERED` status with side-by-side hash comparison.
  * **"View Official Report ↗"**: Opens the standalone print-ready `/report.html?id=<case_id>` in a new tab (`target="_blank"`).

---

## 7. Mathematical Specification (`public/colorMath.js`)
All CV operations MUST be implemented in pure deterministic JavaScript using the exact formulas below.

### 7.1 Region of Interest (ROI) Extraction
Extract pixel data from the center square of the captured frame (center 20% width × 20% height, or fixed centered 100×100 px box). Iterate over all $N$ pixels $(R_i, G_i, B_i)$ in the ROI.

### 7.2 Quality Gate (Blank / Dark / Covered Lens Detection)
For each pixel $i$ in the ROI, compute relative luminance $Y_i \in [0, 255]$:
$$Y_i = 0.2126 R_i + 0.7152 G_i + 0.0722 B_i$$

Compute the mean luminance $\mu_Y$ and luminance standard deviation $\sigma_Y$:
$$\mu_Y = \frac{1}{N} \sum_{i=1}^{N} Y_i, \qquad \sigma_Y = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (Y_i - \mu_Y)^2}$$

* **Dark / Covered Lens Rejection:** Reject if $\mu_Y < 25$.
* **Overexposed / Glare Rejection:** Reject if $\mu_Y > 248$.
* **Flat / Solid Blank Frame Rejection:** Reject if $\sigma_Y < 1.5$ (note: keep threshold low enough that a real colored paper card under normal room light passes due to natural lighting texture/noise, while a synthetic solid-color/covered sensor fails).

### 7.3 sRGB to CIE $L^*a^*b^*$ Conversion (D65 Standard Illuminant)
Compute the mean $(\bar{R}, \bar{G}, \bar{B})$ of the ROI, normalize to $[0, 1]$ ($r = \bar{R}/255, g = \bar{G}/255, b = \bar{B}/255$), and apply inverse sRGB companding for each channel $c \in \{r, g, b\}$:

$$c_{\text{lin}} = \begin{cases} c / 12.92 & \text{if } c \le 0.04045 \\ \left(\frac{c + 0.055}{1.055}\right)^{2.4} & \text{if } c > 0.04045 \end{cases}$$

Transform linear RGB to CIE XYZ (D65 reference white: $X_n = 0.95047, Y_n = 1.00000, Z_n = 1.08883$):
$$X = 0.4124564\,r_{\text{lin}} + 0.3575761\,g_{\text{lin}} + 0.1804375\,b_{\text{lin}}$$
$$Y = 0.2126729\,r_{\text{lin}} + 0.7151522\,g_{\text{lin}} + 0.0721750\,b_{\text{lin}}$$
$$Z = 0.0193339\,r_{\text{lin}} + 0.1191920\,g_{\text{lin}} + 0.9503041\,b_{\text{lin}}$$

Define $f(t)$ where $\epsilon = 0.008856$ and $\kappa = 903.3$:
$$f(t) = \begin{cases} t^{1/3} & \text{if } t > \epsilon \\ \frac{\kappa t + 16}{116} & \text{otherwise} \end{cases}$$

Compute CIE $L^*a^*b^*$:
$$L^* = 116\,f(Y/Y_n) - 16, \qquad a^* = 500\left[f(X/X_n) - f(Y/Y_n)\right], \qquad b^* = 200\left[f(Y/Y_n) - f(Z/Z_n)\right]$$

### 7.4 Perceptual Color Distance ($\Delta E_{76}$) & Classification
Calculate the reaction color shift between Frame 1 $(L_1, a_1, b_1)$ and Frame 2 $(L_2, a_2, b_2)$:
$$\Delta E_{\text{shift}} = \sqrt{(L_2 - L_1)^2 + (a_2 - a_1)^2 + (b_2 - b_1)^2}$$

* **No-Reaction Gate:** If $\Delta E_{\text{shift}} < 12.0$, immediately classify as **`NEGATIVE — NO SIGNIFICANT REACTION`**.
* **Reagent Reference Matching:** If $\Delta E_{\text{shift}} \ge 12.0$, compute $\Delta E$ between Frame 2's $(L_2, a_2, b_2)$ and each reference centroid below, selecting the nearest match within threshold $\Delta E \le 45.0$ (otherwise classify as **`INCONCLUSIVE — UNRECOGNIZED COLOR SHIFT`**):

| Reference Reagent Signature | Target Color | Target CIELAB $(L^*, a^*, b^*)$ | Presumptive Classification Output |
| :--- | :--- | :--- | :--- |
| **Marquis — Purple/Violet** | Deep Purple | $(30, 45, -45)$ | `PRESUMPTIVE POSITIVE: OPIATE CLASS (MARQUIS PURPLE)` |
| **Marquis — Orange/Brown** | Orange-Brown | $(55, 40, 55)$ | `PRESUMPTIVE POSITIVE: AMPHETAMINE CLASS (MARQUIS ORANGE)` |
| **Scott — Turquoise/Blue** | Cobalt/Blue | $(45, -10, -45)$ | `PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)` |
| **Mecke — Blue-Green** | Dark Green | $(40, -35, 15)$ | `PRESUMPTIVE POSITIVE: OPIATE/HEROIN CLASS (MECKE GREEN)` |

*(Note: Centroids are calibrated to work reliably with physical colored reference cards or food coloring in water during classroom verification.)*

### 7.5 Three-Frame Kinetic Verification & Anti-Framing Protocol (`evaluateThreeFrameAnalysis`)
To prevent framing, contaminated vials, or deliberate mid-test fluid substitutions, the mathematical engine enforces a deterministic 3-frame evaluation:
1. **Quality Gate Verification:** Evaluates luminance ($\mu_Y \in [25, 248]$) and variance ($\sigma_Y \ge 1.5$) across Frame 1, Frame 2, and Frame 3.
2. **Pre-Contaminated Baseline Detection:** If Frame 1 (unreacted dry sample) falls within $\Delta E \le 35.0$ of any calibrated reagent centroid prior to reagent introduction, classify as **`SUSPECTED FRAMING — PRE-CONTAMINATED BASELINE`**.
3. **Instant Swap / Kinetic Discontinuity Detection:** If an instantaneous color displacement occurs upon reagent contact ($\Delta E_{1\to 2} > 35.0$) followed by a flat kinetic profile across the 5.00s reaction window ($\Delta E_{2\to 3} < 10.0$), classify as **`SUSPECTED FRAMING — INSTANT SWAP / NO REACTION CURVE`**.
4. **Reaction Evaluation:** If $\Delta E_{2\to 3} < 12.0$, classify as **`NEGATIVE — NO SIGNIFICANT REACTION`**; otherwise match Frame 3 against reference centroids within threshold $\Delta E \le 45.0$ (or **`INCONCLUSIVE — UNRECOGNIZED COLOR SHIFT`**).

---

## 8. Cryptographic Integrity & Canonical Hashing Protocol
To guarantee deterministic verification without floating-point formatting drift or JSON key-order mismatches, the backend **MUST** compute SHA-256 over a strict, pipe-delimited 10-parameter **Canonical Payload String**:

```javascript
function computeEvidenceHash(record) {
  const canonicalPayload = [
    String(record.case_id),
    String(record.frame_1),
    String(record.frame_2),
    String(record.frame_3),
    Number(record.delta_e_pre).toFixed(4),
    Number(record.delta_e).toFixed(4),
    String(record.matched_result),
    Number(record.gps_lat).toFixed(6),
    Number(record.gps_lng).toFixed(6),
    String(record.server_timestamp)
  ].join('|');

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}
```

* **Server Authority:** `case_id` (format: `NTV-YYYYMMDD-XXXXXX` using random hex/alphanumeric) and `server_timestamp` (`new Date().toISOString()`) MUST be generated strictly on the server inside `POST /api/lock`. Never trust client-supplied timestamps.
* **Verification Rule:** `GET /api/evidence/:id/verify` reads the stored row from SQLite, passes it to `computeEvidenceHash(row)`, and performs a constant-time comparison against `row.sha256_hash`.

---

## 9. Database Schema & Append-Only REST API Contract

### SQLite Schema (`server/db.js`)
```sql
CREATE TABLE IF NOT EXISTS evidence_records (
  case_id TEXT PRIMARY KEY,
  frame_1 TEXT NOT NULL,
  frame_2 TEXT NOT NULL,
  frame_3 TEXT NOT NULL,
  delta_e_pre REAL NOT NULL,
  delta_e REAL NOT NULL,
  matched_result TEXT NOT NULL,
  gps_lat REAL NOT NULL,
  gps_lng REAL NOT NULL,
  server_timestamp TEXT NOT NULL,
  sha256_hash TEXT NOT NULL
);
```

### Strict Append-Only Endpoints (`server/server.js`)
Configure `express.json({ limit: '10mb' })` to accommodate the Base64 frame strings.

1. **`POST /api/lock`**
   * **Request Body:** `{ frame_1, frame_2, frame_3, delta_e_pre, delta_e, matched_result, gps_lat, gps_lng }`
   * **Validation:** Reject with `400 Bad Request` if any required field is missing, non-finite (for numbers), or empty.
   * **Action:** Generate `case_id` and `server_timestamp`, compute `sha256_hash`, execute `INSERT INTO evidence_records (...)`, return `201 Created` with the complete locked record.
2. **`GET /api/evidence`**
   * **Action:** Return `200 OK` with an array of all records ordered by `server_timestamp DESC` (omit heavy frame strings in list summary for fast loading).
3. **`GET /api/evidence/:id/verify`**
   * **Action:** Fetch the full row by `case_id`. If not found, return `404 Not Found`. Re-compute `computed_hash = computeEvidenceHash(row)`. Return `200 OK`:
     ```json
     {
       "status": "VERIFIED", // or "TAMPERED"
       "stored_hash": "...",
       "computed_hash": "...",
       "record": { ... }
     }
     ```
4. **Forbidden Routes:** Do NOT define `PUT`, `PATCH`, or `DELETE` handlers on `/api/evidence`.

---

## 10. Software Engineering (SE) Traceability & Cross-Questioning Defense
This matrix maps architectural decisions directly to SE syllabus principles for the SRS and 5-slide presentation:

| Design Choice | Alternative Rejected | Technical & SE Justification |
| :--- | :--- | :--- |
| **CIELAB ($\Delta E_{76}$)** | RGB / HSV Euclidean Distance | RGB is hardware- and lighting-dependent; CIELAB is perceptually uniform, meaning mathematical distance directly correlates to human visual difference. |
| **3-Frame Kinetic Capture** | Full Video Processing / Single Photo | Single photos miss reaction curves and allow oxidation bias; full video incurs ~100x storage/bandwidth overhead. Three timed frames prove genuine chemical kinetics ($\Delta E_{2\to 3}$) while detecting pre-contamination ($\Delta E \le 35$) and liquid swaps ($\Delta E_{1\to 2} > 35, \Delta E_{2\to 3} < 10$). |
| **Deterministic Math** | Deep Learning (CNN) / LLM Vision | Zero training dataset required (impossible to legally source thousands of drug samples), zero hallucination risk, 100% mathematically auditable in court. |
| **SHA-256 + Append-Only SQLite** | Blockchain / Standard Editable DB | $O(1)$ cryptographic tamper detection with zero gas fees, network latency, or distributed-node complexity. |
| **Mobile-First Web App** | Native Android/iOS Apps | Eliminates OS fragmentation across police hardware and guarantees instant deployment via standard browser Camera/GPS APIs. |
| **Lock-Before-Display** | Save-After-Preview | Eliminates selective suppression by committing the cryptographic hash before the operator sees the presumptive classification. |

---

## 11. Testing Strategy & Tamper Demonstration Protocol
To generate verifiable data for the SRS Testing section and Slide 4:

1. **Equivalence Partitioning & Boundary Tests:**
   * *Valid Positive Simulation:* White card at $t=0\text{s}$ $\rightarrow$ Purple/Orange/Blue card at $t=5\text{s}$ $\rightarrow$ Verify $\Delta E_{\text{shift}} \ge 12$, correct presumptive match, `VERIFIED` hash.
   * *Valid Negative Simulation:* White card at $t=0\text{s}$ $\rightarrow$ Same white card at $t=5\text{s}$ $\rightarrow$ Verify $\Delta E_{\text{shift}} < 12$, classified `NEGATIVE`.
   * *Invalid Capture Gate:* Cover webcam lens ($\mu_Y < 25$) $\rightarrow$ Verify immediate rejection (`INVALID CAPTURE`) and zero DB writes.
2. **Live Tamper-Detection Proof:**
   * Lock a valid test case (e.g., `NTV-20261124-A1B2C3`). Confirm it shows `VERIFIED` (Green) in the Evidence Vault.
   * Directly modify 1 character of `matched_result` or 1 decimal digit of `gps_lat` inside the SQLite `.db` file (via SQLite CLI or DB Browser).
   * Re-click **"Verify Integrity"** in the UI $\rightarrow$ Confirm it immediately flips to **`TAMPERED` (Red Alert)** displaying the mismatched hashes.

---

## 12. Local Execution & Browser Security Context
* **Run Command:** `npm install && npm start` (serves on `http://localhost:3000`).
* **Browser Hardware Permissions:** `navigator.mediaDevices.getUserMedia` and `navigator.geolocation` require a **Secure Context**. `http://localhost:3000` is natively treated as a secure context by Chrome/Edge/Firefox on desktop. If testing from a smartphone over LAN IP, serve via HTTPS or use `adb reverse` / ngrok / VS Code port forwarding.