# AI Agent Sync & Handover Protocol (Top Banner)

> [!IMPORTANT]
> ### MASTER AI-HANDOVER SPECIFICATION — SINGLE SOURCE OF TRUTH (SSOT)
> **Target Audience:** Any AI Assistant, LLM Agent, Evaluator, or Developer reviewing, evaluating, or extending this codebase (including drafting the IEEE-830 Software Requirements Specification, compiling the 5-slide defense presentation deck, preparing oral examination / viva voce defense, or conducting automated regression testing).
>
> **Strict Operational Instructions:**
> 1. **Absolute Ground Truth:** Treat this document as the sole authoritative specification of the finalized, feature-frozen system. Never invent, hallucinate, or assume features, endpoints, libraries, background workers, machine learning models, cloud services, blockchain networks, or hardware accessories not explicitly documented herein.
> 2. **Non-Negotiable Guardrails:** Strictly obey the [Section 3 Hard Prohibitions](#hard-prohibitions-non-negotiable-guardrails). Do NOT add authentication, user roles, file upload pickers (`<input type="file">`), external AI/LLM APIs, or mutating database endpoints (`PUT`, `PATCH`, `DELETE`).
> 3. **1-to-1 Specification Mapping:** If generating IEEE-830 SRS sections, slide decks, or architectural diagrams, map requirements, functional flows, mathematical formulas, and REST schemas 1-to-1 to the exact names, formulas, calibrated centroids, and database columns provided in this document.
> 4. **Codebase Status:** **FEATURE-COMPLETE & CODE-FROZEN**. All core logic, cryptographic verification, kinetic anti-framing algorithms, responsive mobile/desktop UI, and standalone print-ready reporting are implemented, audited, and verified.

---

# Project Overview & Forensic Philosophy

NarcoTest Vision (NTV) is a forensic precision instrument and client-server software application designed to replace subjective visual interpretation of chemical field drug tests with an objective, deterministic computer-vision color-matching pipeline bound to cryptographically locked metadata.

### The Problem Statement
Conventional presumptive field tests (e.g., Marquis, Scott, Mecke colorimetric reagents) represent law enforcement's primary frontline narcotics identification tool. However, standard field procedures suffer from severe evidentiary vulnerabilities:
1. **Perceptual Subjectivity & Ambient Lighting Drift:** Human visual evaluation under sodium-vapor street lamps, car headlights, or nighttime illumination is notoriously inaccurate. Standard smartphone RGB photo comparison also fails because RGB color space is device-dependent and perceptually non-uniform.
2. **Kinetic Reaction Window & Atmospheric Oxidation:** Colorimetric reagents are dynamic chemical kinetic processes. Reading a test too early (< 5s) yields incomplete color formation; reading too late (> 30s) exposes the reagent to atmospheric oxidation, turning almost any organic compound dark brown/black and precipitating false positives.
3. **Gallery Injection & Post-Test Manipulation:** Standard mobile applications that allow users to select photos from the camera roll allow malicious operators or compromised witnesses to inject pre-staged photos, substitute stock images, or strip/spoof EXIF timestamps and GPS telemetry.
4. **Selective Suppression (Pre-Commit Cherry-Picking):** If an application previews the classification result to the operator *before* committing the record to permanent storage, the operator can discard unfavorable results ("cherry-picking") before any supervisory record is created.
5. **Pre-Contamination & Sample Swapping (Framing):** Corrupt operators or biased witnesses may introduce pre-colored substances into test vials prior to reagent dispensing or swap out the test vial immediately after adding reagent to fake a positive reaction.

### The Forensic Philosophy: Lock-Before-Display
To eliminate every threat vector above, NarcoTest Vision implements a strict **Lock-Before-Display** architecture:
* **Optical Continuity via Guided 3-Frame Capture:** The client enforces an unalterable 3-frame progression: Frame 1 (unreacted dry baseline sample) $\to$ Frame 2 ($t=0\text{s}$ post-reagent introduction) $\to$ uninterruptible 5.00s incubation countdown $\to$ Frame 3 ($t=5\text{s}$ reacted final state).
* **Deterministic Local Mathematics:** Zero black-box neural networks or external AI classifiers. All colorimetric analysis is calculated locally using pure, deterministic mathematics (CIE $L^*a^*b^*$ conversion under D65 standard illuminant and CIE76 $\Delta E$ perceptual color distance).
* **Cryptographic Lock-Before-Display:** The client transmits optical frames and calculated telemetry to the backend *before* rendering the presumptive classification. The server independently issues an authoritative UTC timestamp and Case ID, computes a canonical SHA-256 digital digest over all parameters, and commits the row to an append-only SQLite store. Only after receiving `HTTP 201 Created` does the interface navigate to the official forensic report.
* **$O(1)$ Tamper Evident Verification:** Any byte-level alteration to the database row (e.g., modifying coordinates, timestamps, or classifications) causes instant cryptographic signature divergence, turning verification seals from Green `INTEGRITY VERIFIED` to Red `TAMPERING DETECTED`.

---

# Hard Prohibitions (Non-Negotiable Guardrails)

Any AI agent, developer, or documentation author working with this repository **MUST** respect the following boundaries. These constraints are non-negotiable architectural invariants:

1. **ZERO User Authentication or Session Management:**
   * Strictly NO login screens, sign-up forms, passwords, JWT tokens, cookies, OAuth flows, WebAuthn, or role-based access control (RBAC).
   * *Forensic Justification:* A physical field instrument must operate instantly in high-stress, fail-safe field scenarios without authentication lockouts or credential transmission failures.
2. **ZERO File Uploads or Gallery Pickers:**
   * Strictly NO `<input type="file">`, drag-and-drop dropzones, file pickers, or camera roll ingestion anywhere in the codebase.
   * *Forensic Justification:* All ingested frames must originate strictly from the live hardware video stream (`navigator.mediaDevices.getUserMedia`) to eliminate gallery injection and metadata forgery.
3. **ZERO Generative AI / Machine Learning / LLM Models:**
   * Strictly NO OpenAI, Gemini, Claude, TensorFlow, PyTorch, OpenCV deep learning weights, or cloud vision APIs.
   * *Forensic Justification:* Deep neural networks are statistical approximations vulnerable to hallucinations, adversarial lighting shifts, and court challenges regarding "black-box" interpretability (Daubert/Frye standard). Forensic evidence must be 100% deterministic, transparent, and reproducible by opposing expert witnesses.
4. **ZERO External Blockchains or Specialized Hardware Accessories:**
   * Strictly NO Web3, smart contracts, Ethereum, Solana, Merkle tree ledgers, HSMs, optical spectrometers, or custom microcontrollers.
   * *Forensic Justification:* Eliminates extreme latency, gas fees, external network dependencies, and expensive proprietary hardware requirements. Standard COTS (Commercial Off-The-Shelf) mobile browsers with local SHA-256 and SQLite append-only storage provide complete, mathematically rigorous tamper evidence.
5. **ZERO Mutating Database Operations:**
   * Strictly NO `UPDATE` or `DELETE` SQL queries in normal operation.
   * Strictly NO `PUT`, `PATCH`, or `DELETE` HTTP endpoints on `/api/evidence`. Enforced at the server router level via `405 Method Not Allowed`.
6. **Strictly Presumptive (Never Confirmatory):**
   * All outputs must be labeled as **Presumptive Identification**. Chemical colorimetric tests establish preliminary evidentiary probable cause; they do NOT replace confirmatory laboratory instrumentation (Gas Chromatography-Mass Spectrometry [GC-MS] or Liquid Chromatography-Tandem Mass Spectrometry [LC-MS/MS]).

---

# System Architecture & Exact File Map

### Architectural Tier Diagram

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER (Mobile 390px & Desktop 1280px)                     │
│                                                                                        │
│   [View 1: Hardware Check] ──> [View 2: 3-Frame Capture] ──> [View 3: Lock Screen]    │
│    - Camera Stream Check        - Step 1: Baseline (Frame 1)  - POST /api/lock         │
│    - GPS Coordinates Fix        - Step 2: Reagent Prompt      - Spin Lock Before Disp  │
│    - Strict Start Gate          - Step 3: 5s Timer (F2 -> F3) - Auto-Redirect          │
│                                                                     │                  │
│   [View 4: Evidence Vault] <────────────────────────────────────────┘                  │
│    - Reverse Chronological List                                                        │
│    - Inline Tamper Verifier (GET /api/evidence/:id/verify)                             │
│                                                                                        │
│   [Standalone Report Sheet: /report.html?id=<case_id>]                                 │
│    - Print-Ready A4 Document Sheet (@media print optimization)                         │
│    - Real-Time Cryptographic Seal (Green VERIFIED / Red TAMPERED)                      │
│    - 3-Frame Photographic Evidence Strip                                               │
│    - Quantitative Telemetry Table & Deterministic Forensic Clinical Prose              │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │ JSON over HTTP (Port 3000)
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVER TIER (Node.js + Express)                           │
│                                                                                        │
│   server/server.js:                                                                    │
│    ├── POST /api/lock                (Case ID, UTC Timestamp, SHA-256 Seal, SQLite)   │
│    ├── GET  /api/evidence            (Reverse chronological record query)              │
│    ├── GET  /api/evidence/:id/verify (Recomputes Canonical SHA-256 vs. Stored Digest)  │
│    └── 405 Method Not Allowed Guard (Blocks all PUT, PATCH, DELETE mutations)          │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │ Synchronous / WAL Driver
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE TIER (SQLite 3 File)                              │
│                                                                                        │
│   narcotest.db -> evidence_records (11 Columns, Append-Only Relational Table)          │
│   (case_id, frame_1, frame_2, frame_3, delta_e_pre, delta_e, matched_result, ...)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Complete Codebase File Inventory

| Relative Path | Size / Type | Core Responsibilities & Key Exported Symbols |
| :--- | :--- | :--- |
| `server/db.js` | CommonJS Module | Initializes SQLite database via tri-layer fallback strategy (`better-sqlite3` $\to$ native `node:sqlite DatabaseSync` $\to$ `sqlite3`). Enforces WAL mode (`PRAGMA journal_mode = WAL;`), creates the 11-column `evidence_records` table, auto-migrates missing columns (`frame_3`, `delta_e_pre`), and exports `initDatabase`, `insertEvidenceRecord`, `getAllEvidenceRecords`, and `getEvidenceRecordById`. |
| `server/server.js` | Node.js / Express | Main backend web service running on port 3000. Serves `public/` statically; configures `express.json({ limit: '10mb' })`; enforces 405 Method Not Allowed on mutating HTTP verbs; generates authoritative Case IDs (`NTV-YYYYMMDD-XXXXXX`) and ISO-8601 UTC timestamps; serializes the 10-parameter canonical payload; computes SHA-256 seals; exposes `POST /api/lock`, `GET /api/evidence`, and `GET /api/evidence/:id/verify`. |
| `public/index.html` | Vanilla HTML5 | Single-Page Application shell structuring all 4 console views. Fully responsive with mobile sticky navigation header, hardware status cards, camera viewfinder with centered 100×100 px ROI reticle, live countdown indicator, locking spinner, and responsive Evidence Vault cards. |
| `public/style.css` | CSS3 Stylesheet | Modern, clinical forensic design system (Inter sans-serif, monospace telemetry, light slate `#F8FAFC` canvas, crisp white cards, `#2563EB` clinical blue accents, 1px `#E2E8F0` borders). Contains full responsive media queries (`max-width: 640px` and `max-width: 900px`), CSS grid definitions, and zero horizontal overflow on 390px mobile viewports. |
| `public/app.js` | ES6 Module | Client application controller and hardware state machine. Implements live DOM accessor via dynamic `Proxy` + `ID_MAP` for null-safe lookups; requests camera and GPS hardware permissions; drives the 3-frame capture state machine; executes local Quality Gate checks; coordinates the uninterruptible 5.00s countdown timer; dispatches `POST /api/lock`; handles redirection to `/report.html`; and renders Evidence Vault cards with live verification. |
| `public/colorMath.js` | ES6 Module | Pure mathematical colorimetry and computer vision engine. Exports calibrated reference centroids (`REAGENT_CENTROIDS`), thresholds (`DELTA_E_NO_REACTION_THRESHOLD = 12.0`, `DELTA_E_MATCH_MAX_THRESHOLD = 45.0`), `extractCenterROI`, `evaluateQualityGate`, `computeAverageRGB`, `rgbToCielab`, `computeDeltaE`, `classifyReaction`, and `evaluateThreeFrameAnalysis`. Exposes all functions to `window.ColorMath` and `globalThis.ColorMath`. |
| `public/report.html` | Vanilla HTML5 | Standalone, print-ready A4 official forensic chain-of-custody report. Features top action bar (`window.print()`), official header, live cryptographic integrity seal banner (Green/Red), color-coded verdict banner, 3-frame photographic strip, quantitative colorimetric proof table, deterministic clinical narrative summary, and statutory legal disclaimer. Formatted with `@page { size: A4; margin: 12mm 15mm; }` for direct PDF export. |
| `public/report.js` | ES6 Module | Controller for the standalone report. Reads `?id=<case_id>` query parameter; fetches `GET /api/evidence/:id/verify`; populates all DOM identifiers; renders verification status; and executes `generateNarrativeReport()` to generate deterministic, rule-based forensic prose in formal clinical English. |
| `package.json` | Manifest | Declares project dependencies (`express`, `cors`, `better-sqlite3`, `sqlite3`), start scripts (`npm start`), and metadata. |
| `README.md` | Markdown Document | This comprehensive, self-contained Master AI-Handover Specification. |

---

# Responsive UI & Complete 3-Frame User Workflow

The application user interface is styled in a modern, clinical forensic aesthetic (clean light slate `#F8FAFC` background, crisp white cards, 1px solid `#E2E8F0` borders, subtle box shadows, and 12px border radius). It adapts seamlessly between **Desktop (1280×800)** and **Mobile (390×844)** viewports with zero horizontal scrolling.

### Top Sticky Navigation
* Centered maximum width container (`1100px`) featuring an SVG shield brand icon and title (**NarcoTest Vision**).
* Segmented pill button switcher toggle:
  * **New Field Test** (`#nav-btn-test`): Navigates to the pre-flight testing console (Views 1–3).
  * **Evidence Vault** (`#nav-btn-vault`): Navigates to the immutable record vault (View 4).

---

### View 1: Pre-Flight Hardware Check (Fail-Fast Gate)
* **DOM Container:** `#view-permissions` (max-width: 720px centered).
* **Hardware Status Grid:** 2-column grid on desktop, stacking to 1 column on mobile.
  * **Camera Stream Card:** Contains SVG aperture icon, description, and status badge (`#badge-camera-status`: `PENDING` $\to$ `GRANTED` / `DENIED`).
  * **GPS Sensor Card:** Contains SVG satellite icon, description, status badge (`#badge-gps-status`: `PENDING` $\to$ `ACQUIRED` / `DENIED`), and coordinates read-out (`#label-gps-coords`).
* **Action Controls:**
  * **"Authorize Hardware Sensors"** (`#btn-request-perms`): Triggers `requestHardwarePermissions()`. Invokes `navigator.mediaDevices.getUserMedia` (requesting rear environment camera with laptop fallback) and `navigator.geolocation.getCurrentPosition`.
  * **"Perform Field Test"** (`#btn-start-test`): **STRICT HARD GATE**. Kept strictly `disabled` until both Camera and GPS are verified active. Clicking this button opens the live camera in View 2. Never automatically starts capture without explicit user tap.

---

### View 2: Guided 3-Frame Live Capture & Kinetic Protocol
* **DOM Container:** `#view-capture` (max-width: 1000px).
* **Desktop vs. Mobile Layout:** 2-column layout on desktop (viewfinder left, preparation/incubation card right); stacks vertically on mobile.
* **Viewfinder Components:** Live `<video>` feed (`#camera-feed`), hidden processing `<canvas>` (`#capture-canvas`), centered visual 100×100 px SVG reticle (`#roi-reticle`), live status overlay badge (`#capture-status-overlay`), and Quality Gate error notification (`#quality-gate-error`).
* **Step Progress Indicator Strip:** Visual stepper showing `Baseline` (`#step-baseline`) $\to$ `Reaction` (`#step-reaction`) $\to$ `Reacted` (`#step-reacted`).

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           VIEW 2 GUIDED CAPTURE SEQUENCE                                │
│                                                                                         │
│  [Step 1: Alignment Mode]                                                               │
│   - Live camera stream runs inside viewfinder with 100x100 reticle.                     │
│   - Instructions: 1. Place dry sample in reticle. 2. Capture baseline. 3. Add reagent.  │
│   - Operator clicks: [Capture Baseline Sample (Frame 1)] (#btn-capture-baseline)        │
│                                │                                                        │
│                                ▼                                                        │
│  [Frame 1 Optical Sampling & Immediate Quality Gate]                                    │
│   - Snaps Frame 1 (480px width, JPEG 0.8) and extracts center 100x100 ROI.              │
│   - Evaluates evaluateQualityGate(roi1). If invalid (dark/glare/blank), aborts test     │
│     immediately with INVALID CAPTURE error and enables retry button.                     │
│   - If valid, locks Frame 1, marks step 1 done, and keeps live camera stream active.    │
│                                │                                                        │
│                                ▼                                                        │
│  [Step 2: Amber Reagent Prompt]                                                         │
│   - Prominent amber instruction card (#capture-step-reagent) appears.                   │
│   - "Baseline locked. Add the chemical reagent to the sample now, then immediately     │
│      click below."                                                                      │
│   - Operator adds chemical drops and clicks: [Reagent Added — Start 5s Reaction]        │
│                                │                                                        │
│                                ▼                                                        │
│  [Step 3: Automated Reaction Timing & Final Capture]                                    │
│   - Immediately snaps Frame 2 (t = 0s post-reagent initial contact).                    │
│   - Initiates uninterruptible 5.00s countdown timer (#timer-display).                   │
│   - Reaching 0.00s automatically snaps Frame 3 (t = 5s reacted final state).            │
│   - Instantly terminates all hardware camera tracks (hardware privacy lamp turns off).  │
│                                │                                                        │
│                                ▼                                                        │
│  [Local 3-Frame Kinetic Analysis & Anti-Framing Engine]                                 │
│   - Runs evaluateThreeFrameAnalysis(roi1, roi2, roi3).                                  │
│   - Checks for pre-contaminated baselines (Frame 1 within ΔE ≤ 35 of any centroid).     │
│   - Checks for instant fluid swap (ΔE₁→₂ > 35 AND ΔE₂→₃ < 10).                          │
│   - Checks reaction threshold (ΔE₂→₃ < 12 = Negative; else matches centroid ≤ 45).      │
│                                │                                                        │
│                                ▼                                                        │
│  [Lock-Before-Display Protocol]                                                         │
│   - Dispatches POST /api/lock containing { frame_1, frame_2, frame_3, ... }.            │
│   - Displays locking spinner (#locking-spinner). Result is NOT rendered.                │
│   - On HTTP 201 Created response, automatically redirects client to:                    │
│     window.location.href = `/report.html?id=${encodeURIComponent(lockedRecord.case_id)}`│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### View 3: Client Lock-Before-Display State
* **DOM Container:** `#view-analysis`.
* **State Behavior:** Displays an animated loading spinner (`#locking-spinner`) with the caption *"Cryptographically Locking Evidence..."*.
* **Guaranteed Invariant:** The classification verdict is **NEVER** revealed on this view prior to successful server database commitment. If `POST /api/lock` fails, an alert is displayed and the system returns to View 1; uncommitted results cannot be viewed.

---

### View 4: Read-Only Evidence Vault & Inline Tamper Verifier
* **DOM Container:** `#view-vault` (max-width: 1000px).
* **Record Layout:** Responsive 2-column card grid on desktop (`#vault-records-body`), collapsing to a single stacked column on mobile (390px) with zero horizontal overflow.
* **Card Data Elements:**
  * Header: Case Identifier (`.case-id-mono`, e.g., `NTV-20261124-A8F29C`) and matched result pill badge (`.badge-success`, `.badge-pending`, `.badge-danger`).
  * Telemetry Grid: UTC Timestamp, Pre-Shift ($\Delta E_{1\to 2}$), Reaction Shift ($\Delta E_{2\to 3}$), and GPS Coordinates fix.
  * Dual Action Buttons:
    1. **"Verify Integrity"** (`.btn-verify`): Fires `GET /api/evidence/:id/verify`. Displays prominent banner above cards:
       * **Green Banner (`.verified`):** `✔ INTEGRITY VERIFIED • CASE: NTV-...` — Confirms runtime recomputed SHA-256 matches stored seal byte-for-byte.
       * **Red Banner (`.tampered`):** `⚠ TAMPERING DETECTED (ALERT) • CASE: NTV-...` — Displays side-by-side comparison boxes showing the stored vault hash vs. the recomputed canonical hash.
    2. **"View Official Report ↗"** (`.btn-view-report`): Opens `/report.html?id=<case_id>` in a new browser tab (`target="_blank"`).

---

# Exact Colorimetry, Quality Gate & Anti-Framing Math (`public/colorMath.js`)

All computer vision and colorimetry operations are 100% deterministic, mathematically auditable, and run locally in vanilla JavaScript.

### 1. Centered Region of Interest (ROI) Pixel Extraction
* **Source:** Captured HTML5 canvas (`width: 480px`, aspect-ratio preserved height).
* **Function:** `extractCenterROI(ctx, canvasWidth, canvasHeight, roiSize = 100)`
* **Formula:**
  $$\text{size} = \min(\text{roiSize}, \text{canvasWidth}, \text{canvasHeight})$$
  $$\text{startX} = \max\left(0, \left\lfloor \frac{\text{canvasWidth} - \text{size}}{2} \right\rfloor\right), \quad \text{startY} = \max\left(0, \left\lfloor \frac{\text{canvasHeight} - \text{size}}{2} \right\rfloor\right)$$
* Extracts exactly $100 \times 100 = 10,000$ pixels ($40,000$ Uint8 RGBA values) from the optical center.

---

### 2. Optical Quality Gate (Fail-Fast Blank & Lighting Rejection)
* **Function:** `evaluateQualityGate(roiImageData)`
* **Relative Luminance Equation (Rec. 709 / sRGB Standard):**
  $$Y_i = 0.2126\,R_i + 0.7152\,G_i + 0.0722\,B_i, \quad \text{for } i \in [1, N]$$
* **Statistical Metrics:**
  $$\mu_Y = \frac{1}{N} \sum_{i=1}^N Y_i, \qquad \sigma_Y = \sqrt{\frac{1}{N} \sum_{i=1}^N (Y_i - \mu_Y)^2}$$
* **Threshold Rejection Rules:**
  * **Dark / Covered Camera Lens:** Rejects if $\mu_Y < 25.0$. Reason: `"Dark frame / covered lens detected (mean luminance < 25)"`.
  * **Overexposed / Severe Glare:** Rejects if $\mu_Y > 248.0$. Reason: `"Overexposed frame / severe glare detected (mean luminance > 248)"`.
  * **Solid Blank / Textureless Frame:** Rejects if $\sigma_Y < 1.5$. Reason: `"Flat/solid blank frame detected (luminance variance < 1.5)"`.

---

### 3. Color Space Transformation: sRGB $\to$ CIE XYZ $\to$ CIE $L^*a^*b^*$
* **Function:** `rgbToCielab(r, g, b)`
* **Step A: Channel Normalization & Inverse sRGB Companding (Linearization):**
  $$\bar{r} = \frac{R}{255}, \quad \bar{g} = \frac{G}{255}, \quad \bar{b} = \frac{B}{255}$$
  For each channel $c \in \{\bar{r}, \bar{g}, \bar{b}\}$:
  $$c_{\text{lin}} = \begin{cases} \dfrac{c}{12.92} & \text{if } c \le 0.04045 \\ \left(\dfrac{c + 0.055}{1.055}\right)^{2.4} & \text{if } c > 0.04045 \end{cases}$$
* **Step B: Linear RGB to CIE 1931 XYZ (D65 Reference White Matrix):**
  $$\begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \begin{bmatrix} 0.4124564 & 0.3575761 & 0.1804375 \\ 0.2126729 & 0.7151522 & 0.0721750 \\ 0.0193339 & 0.1191920 & 0.9503041 \end{bmatrix} \begin{bmatrix} r_{\text{lin}} \\ g_{\text{lin}} \\ b_{\text{lin}} \end{bmatrix}$$
  *Reference White Coordinates (D65 Standard):*
  $$X_n = 0.95047, \quad Y_n = 1.00000, \quad Z_n = 1.08883$$
* **Step C: XYZ to CIE $L^*a^*b^*$ Transfer Functions:**
  Constants: $\epsilon = 0.008856 \approx \left(\frac{216}{24389}\right), \quad \kappa = 903.3 \approx \left(\frac{24389}{27}\right)$
  $$f(t) = \begin{cases} t^{1/3} & \text{if } t > \epsilon \\ \dfrac{\kappa \, t + 16}{116} & \text{if } t \le \epsilon \end{cases}$$
  $$L^* = 116 \, f(Y / Y_n) - 16$$
  $$a^* = 500 \left[ f(X / X_n) - f(Y / Y_n) \right]$$
  $$b^* = 200 \left[ f(Y / Y_n) - f(Z / Z_n) \right]$$

---

### 4. Perceptual Distance Metric (CIE76 $\Delta E$)
* **Function:** `computeDeltaE(labA, labB)`
* **Euclidean Formula in Perceptually Uniform Space:**
  $$\Delta E_{76} = \sqrt{(L_A^* - L_B^*)^2 + (a_A^* - a_B^*)^2 + (b_A^* - b_B^*)^2}$$

---

### 5. Calibrated Reagent Reference Centroids (`REAGENT_CENTROIDS`)

| Reagent Test Standard | Target Visual Tone | Calibrated Target CIELAB $(L^*, a^*, b^*)$ | Formal Classification Verdict |
| :--- | :--- | :--- | :--- |
| **Marquis — Purple/Violet** | Deep Purple / Violet | $(L: 30, a: 45, b: -45)$ | `PRESUMPTIVE POSITIVE: OPIATE CLASS (MARQUIS PURPLE)` |
| **Marquis — Orange/Brown** | Vivid Orange / Red-Brown | $(L: 55, a: 40, b: 55)$ | `PRESUMPTIVE POSITIVE: AMPHETAMINE CLASS (MARQUIS ORANGE)` |
| **Scott — Turquoise/Blue** | Cobalt / Turquoise Blue | $(L: 45, a: -10, b: -45)$ | `PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)` |
| **Mecke — Blue-Green** | Forest Blue-Green | $(L: 40, a: -35, b: 15)$ | `PRESUMPTIVE POSITIVE: OPIATE/HEROIN CLASS (MECKE GREEN)` |

*Global Reaction Thresholds:*
* Minimum Reaction Threshold: `DELTA_E_NO_REACTION_THRESHOLD = 12.0`
* Maximum Target Match Centroid Tolerance: `DELTA_E_MATCH_MAX_THRESHOLD = 45.0`

---

### 6. Three-Frame Kinetic & Anti-Framing Protocol (`evaluateThreeFrameAnalysis`)
* **Function:** `evaluateThreeFrameAnalysis(roi1, roi2, roi3)`
* **Inputs:** 100×100 ImageData from Frame 1 ($t_{\text{pre}}$ unreacted baseline), Frame 2 ($t=0\text{s}$ post-reagent contact), and Frame 3 ($t=5\text{s}$ reacted final state).
* **Sequential Decision Tree:**

```text
 1. Optical Quality Gate:
    Run evaluateQualityGate on roi1, roi2, and roi3.
    IF any frame fails -> RETURN { valid: false, reason: "Frame X: [Reason]" }

 2. Transform Color Spaces:
    lab1 = rgbToCielab(computeAverageRGB(roi1))
    lab2 = rgbToCielab(computeAverageRGB(roi2))
    lab3 = rgbToCielab(computeAverageRGB(roi3))

 3. Calculate Kinetic Vectors:
    delta_e_pre = computeDeltaE(lab1, lab2)   // Shift upon reagent contact
    delta_e     = computeDeltaE(lab2, lab3)   // Progressive 5s incubation shift

 4. Branch A: Pre-Contaminated Baseline Detection (Anti-Framing Guard 1)
    FOR each centroid in REAGENT_CENTROIDS:
      dist = computeDeltaE(lab1, centroid.targetLab)
      IF dist <= 35.0:
        RETURN matched_result = "SUSPECTED FRAMING — PRE-CONTAMINATED BASELINE"

 5. Branch B: Instant Swap / Kinetic Discontinuity (Anti-Framing Guard 2)
    IF (delta_e_pre > 35.0) AND (delta_e < 10.0):
      RETURN matched_result = "SUSPECTED FRAMING — INSTANT SWAP / NO REACTION CURVE"

 6. Branch C: No-Reaction Gate
    IF delta_e < 12.0:
      RETURN matched_result = "NEGATIVE — NO SIGNIFICANT REACTION"

 7. Branch D: Centroid Tolerance Nearest-Neighbor Match
    minDistance = Infinity; bestMatch = null
    FOR each centroid in REAGENT_CENTROIDS:
      dist = computeDeltaE(lab3, centroid.targetLab)
      IF dist < minDistance: minDistance = dist; bestMatch = centroid
    
    IF minDistance <= 45.0:
      RETURN matched_result = bestMatch.classification
    ELSE:
      RETURN matched_result = "INCONCLUSIVE — UNRECOGNIZED COLOR SHIFT"
```

---

# Database Schema, Cryptographic Seal & REST API (`server/db.js`, `server/server.js`)

### 1. SQLite Relational Schema (`server/db.js`)
The persistence layer manages a local SQLite file named `narcotest.db` configured in Write-Ahead Logging mode (`PRAGMA journal_mode = WAL;`).

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

#### Detailed Column Dictionary

| Column Name | SQL Type | Constraint | Description | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `case_id` | `TEXT` | `PRIMARY KEY` | Server-generated unique case identifier | `'NTV-20261124-E3A91B'` |
| `frame_1` | `TEXT` | `NOT NULL` | Base64 JPEG (max width 480px, quality 0.8) of Frame 1 | `'data:image/jpeg;base64,/9j/4AAQSkZ...'` |
| `frame_2` | `TEXT` | `NOT NULL` | Base64 JPEG of Frame 2 (reagent initial contact $t=0\text{s}$) | `'data:image/jpeg;base64,/9j/4AAQSkZ...'` |
| `frame_3` | `TEXT` | `NOT NULL` | Base64 JPEG of Frame 3 (reacted sample $t=5\text{s}$) | `'data:image/jpeg;base64,/9j/4AAQSkZ...'` |
| `delta_e_pre` | `REAL` | `NOT NULL` | Perceptual color shift from Frame 1 to Frame 2 ($\Delta E_{1\to 2}$) | `14.2851` |
| `delta_e` | `REAL` | `NOT NULL` | Reaction color shift from Frame 2 to Frame 3 ($\Delta E_{2\to 3}$) | `32.6104` |
| `matched_result` | `TEXT` | `NOT NULL` | Presumptive classification string or anomaly verdict | `'PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)'` |
| `gps_lat` | `REAL` | `NOT NULL` | WGS84 Latitude coordinate from hardware sensor | `37.774929` |
| `gps_lng` | `REAL` | `NOT NULL` | WGS84 Longitude coordinate from hardware sensor | `-122.419416` |
| `server_timestamp` | `TEXT` | `NOT NULL` | Authoritative ISO-8601 UTC server generation timestamp | `'2026-11-24T19:42:01.892Z'` |
| `sha256_hash` | `TEXT` | `NOT NULL` | 64-character lowercase hexadecimal SHA-256 seal | `'4f8b2c1a8e9d3f5...'` |

---

### 2. Canonical Payload Serialization & Cryptographic SHA-256 Seal
To eliminate floating-point formatting discrepancies, whitespace variances, or JSON key-reordering bugs across different operating systems and CPU architectures, the cryptographic engine hashes a strict **pipe-delimited (`|`) canonical UTF-8 string**:

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

*Exact Formatting Invariants:*
* `case_id`: Exact string.
* `frame_1`, `frame_2`, `frame_3`: Exact Base64 strings.
* `delta_e_pre` and `delta_e`: Exactly **4 decimal places** (`.toFixed(4)`).
* `matched_result`: Exact string.
* `gps_lat` and `gps_lng`: Exactly **6 decimal places** (`.toFixed(6)`).
* `server_timestamp`: Authoritative ISO-8601 string issued by `new Date().toISOString()`.

---

### 3. REST API Contract (`server/server.js`)

#### A. `POST /api/lock`
* **Purpose:** Locks evidence by issuing Case ID, authoritative server timestamp, computing the SHA-256 seal, and committing to SQLite.
* **Payload Limit:** `10mb` JSON.
* **Request Headers:** `Content-Type: application/json`
* **Request Body Example:**
  ```json
  {
    "frame_1": "data:image/jpeg;base64,...",
    "frame_2": "data:image/jpeg;base64,...",
    "frame_3": "data:image/jpeg;base64,...",
    "delta_e_pre": 14.2851,
    "delta_e": 32.6104,
    "matched_result": "PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)",
    "gps_lat": 37.774929,
    "gps_lng": -122.419416
  }
  ```
* **Validation Failure:** Returns `400 Bad Request` if any frame string is missing/empty, if numeric parameters are non-finite, or if GPS coordinates violate physical ranges (latitude $\in [-90, 90]$, longitude $\in [-180, 180]$).
* **Success Response (`201 Created`):**
  ```json
  {
    "case_id": "NTV-20261124-E3A91B",
    "frame_1": "data:image/jpeg;base64,...",
    "frame_2": "data:image/jpeg;base64,...",
    "frame_3": "data:image/jpeg;base64,...",
    "delta_e_pre": 14.2851,
    "delta_e": 32.6104,
    "matched_result": "PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)",
    "gps_lat": 37.774929,
    "gps_lng": -122.419416,
    "server_timestamp": "2026-11-24T19:42:01.892Z",
    "sha256_hash": "4f8b2c1a8e9d3f5b7c8a1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a"
  }
  ```

---

#### B. `GET /api/evidence`
* **Purpose:** Retrieves summary cards for the Evidence Vault in reverse chronological order.
* **Response (`200 OK`):**
  ```json
  [
    {
      "case_id": "NTV-20261124-E3A91B",
      "delta_e_pre": 14.2851,
      "delta_e": 32.6104,
      "matched_result": "PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)",
      "gps_lat": 37.774929,
      "gps_lng": -122.419416,
      "server_timestamp": "2026-11-24T19:42:01.892Z",
      "sha256_hash": "4f8b2c1a8e9d3f5b7c8a1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a"
    }
  ]
  ```

---

#### C. `GET /api/evidence/:id/verify`
* **Purpose:** Real-time tamper verification and retrieval of the full record.
* **Process:** Fetches SQLite row by `case_id`; recomputes canonical SHA-256 digest via `computeEvidenceHash(row)`; executes constant-time byte comparison (`crypto.timingSafeEqual`).
* **Success Response (`200 OK` — Verified State):**
  ```json
  {
    "status": "VERIFIED",
    "case_id": "NTV-20261124-E3A91B",
    "stored_hash": "4f8b2c1a8e9d3f5b7c8a1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a",
    "computed_hash": "4f8b2c1a8e9d3f5b7c8a1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a",
    "record": { ... }
  }
  ```
* **Tampered State (`200 OK` — Tampering Detected):**
  ```json
  {
    "status": "TAMPERED",
    "case_id": "NTV-20261124-E3A91B",
    "stored_hash": "4f8b2c1a8e9d3f5b7c8a1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a",
    "computed_hash": "e9a718b520cf6721da817ef842187bc932187fca0198273b4c5d6e7f8a9b0c1d",
    "record": { ... }
  }
  ```
* **Not Found:** Returns `404 Not Found` if `case_id` does not exist.

---

#### D. Router Guard: 405 Method Not Allowed
* Intercepts any incoming HTTP `PUT`, `PATCH`, or `DELETE` requests matching `/api/*`.
* **Response (`405 Method Not Allowed`):**
  ```json
  {
    "error": "Method Not Allowed — Evidence records are immutable and append-only."
  }
  ```

---

# Standalone Print-Ready A4 Forensic Report (`public/report.html`, `public/report.js`)

When an evidence record is locked (or opened via *"View Official Report ↗"*), it renders on `/report.html?id=<case_id>` as a formal, print-ready forensic laboratory document.

### Print & Export Architecture (`@media print`)
* **A4 Geometry:** Configured via `@page { size: A4; margin: 12mm 15mm; }`.
* **Print Styling:** In `@media print`, top action bars (`.no-print`) are stripped, background shading is eliminated, borders are rendered in crisp 1px neutral slate, box shadows are zeroed out, and page breaks inside telemetry rows are prevented (`page-break-inside: avoid`). Clicking **"Print / Save as PDF"** generates an unadulterated PDF suitable for court admission.

---

### Structured Document Sections

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [TOP ACTION BAR: no-print]  [<- Back to Console]             [Print / Save as PDF]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. OFFICIAL HEADER & METADATA                                                          │
│    Brand: NarcoTest Vision                                                             │
│    Title: Official Chain-of-Custody Report                                             │
│    Subtitle: Objective Chemical Colorimetry & Cryptographic Proof of Integrity         │
│    Case ID: NTV-20261124-E3A91B            Server Timestamp: 2026-11-24 19:42:01 UTC   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. CRYPTOGRAPHIC INTEGRITY SEAL BANNER                                                 │
│    [✔] INTEGRITY VERIFIED (GREEN)                                                      │
│    Server recomputed SHA-256 matches stored evidentiary seal byte-for-byte:            │
│    Hash: 4f8b2c1a8e9d3f5b7c8a1e2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a             │
│    (OR RED ALERT TAMPER BANNER with side-by-side Stored vs Recomputed Hash Comparison) │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. COLOR-CODED CLASSIFICATION VERDICT BANNER                                           │
│    Verdict: Presumptive Positive Chemical Identification                               │
│    Result: PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. 3-FRAME PHOTOGRAPHIC OPTICAL EVIDENCE STRIP                                         │
│    ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐        │
│    │  [Frame 1: Baseline] │  │  [Frame 2: Reaction] │  │  [Frame 3: Reacted]  │        │
│    │  Unreacted Dry Sample│  │  Reagent Added (t=0s)│  │  Incubation (t=5s)   │        │
│    └──────────────────────┘  └──────────────────────┘  └──────────────────────┘        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. QUANTITATIVE COLORIMETRY & CRYPTOGRAPHIC PROOF TABLE                                │
│    Pre-Reagent Shift (ΔE 1->2)       : 14.2851                                         │
│    Reaction Shift (ΔE 2->3)          : 32.6104                                         │
│    GPS Coordinate Fix                : 37.774929, -122.419416                          │
│    Authoritative Server Timestamp    : 2026-11-24T19:42:01.892Z                        │
│    Stored SHA-256 Digest             : 4f8b2c1a8e9d...                                 │
│    Recomputed SHA-256 Digest         : 4f8b2c1a8e9d...                                 │
│    Cryptographic Verification Status : VERIFIED — BYTE-FOR-BYTE CANONICAL MATCH        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 6. DETERMINISTIC FORENSIC NARRATIVE SUMMARY (Rule-Based Clinical Prose)                │
│    "On Tue, 24 Nov 2026 19:42:01 GMT, an automated three-stage optical colorimetric   │
│     analysis was initiated under authoritative case identifier NTV-20261124-E3A91B     │
│     at geographic coordinates 37.774929, -122.419416..."                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 7. FORENSIC NOTICE & LEGAL PRESUMPTIVE DISCLAIMER                                      │
│    "The classifications rendered by the NarcoTest Vision system represent objective   │
│     mathematical colorimetry... Chemical field test reactions are strictly presumptive │
│     and do not replace definitive laboratory confirmation by GC-MS or LC-MS/MS..."     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Deterministic Forensic Narrative Generator (`public/report.js`)
In strict adherence to Section 3 (Zero AI/LLM), the narrative text box is generated by a deterministic, rule-based algorithmic function (`generateNarrativeReport`) combining case telemetry with standardized clinical forensic prose:

```javascript
function generateNarrativeReport(record, verificationResult) {
  const timestampUTC = new Date(record.server_timestamp).toUTCString();
  const gpsLat = Number(record.gps_lat).toFixed(6);
  const gpsLng = Number(record.gps_lng).toFixed(6);
  const deltaEPre = record.delta_e_pre !== undefined ? Number(record.delta_e_pre).toFixed(4) : '0.0000';
  const deltaE = Number(record.delta_e).toFixed(4);
  const resultStr = String(record.matched_result || '');
  const isVerified = verificationResult.status === 'VERIFIED';

  let narrative = `On ${timestampUTC}, an automated three-stage optical colorimetric analysis was initiated under authoritative case identifier ${record.case_id} at geographic coordinates ${gpsLat}, ${gpsLng}. `;
  narrative += `The unreacted sample baseline (Frame 1) was captured and successfully verified against automated luminance and variance quality gate parameters prior to chemical reagent introduction. `;

  // Kinetic & Reaction Analysis Rationale
  if (resultStr.includes('PRE-CONTAMINATED BASELINE')) {
    narrative += `BASELINE ANOMALY DETECTED: Pre-reagent optical evaluation of Frame 1 revealed a severe colorimetric deviation (ΔE ≤ 35.0000) aligning with calibrated chemical reference centroids prior to reagent dispensation. This demonstrates pre-existing contamination of the test medium, deliberate container adulteration, or an active chemical baseline consistent with evidence pre-contamination. `;
  } else if (resultStr.includes('INSTANT SWAP / NO REACTION CURVE')) {
    narrative += `KINETIC DISCONTINUITY DETECTED: The sample exhibited an immediate artificial transition (ΔE₁→₂ = ${deltaEPre}) followed by a flat reaction curve across the 5.00-second incubation window (ΔE₂→₃ = ${deltaE} < 10.0000). The absence of progressive kinetic oxidation indicates physical sample substitution or instant fluid swap rather than genuine chemical reagent development. `;
  } else if (resultStr.includes('NEGATIVE — NO SIGNIFICANT REACTION')) {
    narrative += `REACTION EVALUATION: Following reagent introduction, the chemical medium remained stable across the fixed 5.00-second incubation window, producing a cumulative reaction shift of ΔE = ${deltaE}. This displacement falls strictly below the minimum chemical reactivity threshold (ΔE < 12.0000), confirming a presumptive negative determination for target narcotics classes. `;
  } else if (resultStr.includes('PRESUMPTIVE POSITIVE')) {
    narrative += `REACTION EVALUATION: Following reagent dispensation, the test medium exhibited progressive colorimetric development across the fixed 5.00-second incubation curve, producing a significant reaction shift of ΔE = ${deltaE}. The reacted state at Frame 3 converged within calibrated centroid tolerance (ΔE ≤ 45.0000) to reference standard '${resultStr}'. `;
  } else {
    narrative += `REACTION EVALUATION: Chemical reaction incubation produced a measurable color shift of ΔE = ${deltaE}. However, the resulting CIELAB coordinates did not resolve within acceptance tolerance (ΔE ≤ 45.0000) of any calibrated reference reagent signature, resulting in an inconclusive classification. `;
  }

  // Cryptographic Chain of Custody Summary
  if (isVerified) {
    narrative += `EVIDENTIARY INTEGRITY: Cryptographic chain-of-custody was validated at report generation time. The 256-bit SHA-256 canonical hash recomputed directly from the 10-parameter record matches the authoritative server seal (${verificationResult.stored_hash}) byte-for-byte, confirming zero post-commit database alteration.`;
  } else {
    narrative += `EVIDENTIARY WARNING: Cryptographic integrity verification FAILED. The recomputed SHA-256 digest (${verificationResult.computed_hash}) diverges from the stored database seal (${verificationResult.stored_hash}), indicating post-commit alteration or data corruption.`;
  }

  return narrative;
}
```

---

# Verified End-to-End Test Matrix & Setup Guide

### Local Execution & Setup
The repository requires standard Node.js (v18+) without any external compilation steps.

```bash
# 1. Install dependencies
npm install

# 2. Start the local server
npm start
# Server listens at http://localhost:3000
```

> [!NOTE]
> **Browser Security Context:** Hardware camera streams (`getUserMedia`) and GPS geolocation require a **Secure Context**. Standard modern desktop browsers treat `http://localhost:3000` natively as a secure origin. If testing from a smartphone over local Wi-Fi, port-forward through `adb reverse tcp:3000 tcp:3000`, VS Code Port Forwarding, or a local SSL reverse proxy.

---

### The 4 Verified Test Scenarios

#### Scenario 1: Optical Quality Gate Rejection (Dark Lens / Glare / Blank)
* **Execution:** Click *"Authorize Hardware Sensors"* $\to$ click *"Perform Field Test"*. Cover the camera lens completely with an opaque object or a finger. Tap *"Capture Baseline Sample (Frame 1)"*.
* **Expected Result:**
  * Mean luminance drops below threshold ($\mu_Y < 25.0$).
  * Capture aborts immediately with error banner: `INVALID CAPTURE: Baseline Sample: Dark frame / covered lens detected (mean luminance < 25) — RETRY TEST`.
  * Zero network traffic is sent to the backend; zero records written to SQLite.

#### Scenario 2: Presumptive Positive Test Execution
* **Execution:**
  1. Aim camera at neutral background (white paper) $\to$ click *"Capture Baseline Sample (Frame 1)"*.
  2. Frame 1 locks; stepper marks Baseline complete; amber card appears prompting reagent addition.
  3. Introduce target color (e.g., cobalt blue card or Scott blue swatch) $\to$ click *"Reagent Added — Start 5s Reaction"*.
  4. Frame 2 captures; 5.00s countdown timer decrements uninterruptibly; Frame 3 captures at $t=5.00\text{s}$.
* **Expected Result:**
  * Client computes $\Delta E_{1\to 2}$ and $\Delta E_{2\to 3} \ge 12.0$.
  * Frame 3 CIELAB matches Scott Blue centroid within tolerance $\le 45.0$.
  * Client sends `POST /api/lock`, receives `201 Created`, and redirects to `/report.html?id=NTV-...`.
  * Report renders Green `INTEGRITY VERIFIED` seal, 3-frame strip, telemetry table, and positive opiate/cocaine narrative.

#### Scenario 3: Suspected Framing Anomaly (Instant Fluid Swap)
* **Execution:**
  1. Capture dry neutral sample in Frame 1.
  2. In Step 2, instantly swap in an already fully developed dye swatch (e.g., deep purple) and hold it completely static through the 5s timer.
* **Expected Result:**
  * Engine detects immediate initial displacement upon step 2 ($\Delta E_{1\to 2} > 35.0$).
  * Engine detects flat kinetic oxidation curve across incubation ($\Delta E_{2\to 3} < 10.0$).
  * Matched result triggers Branch B: `SUSPECTED FRAMING — INSTANT SWAP / NO REACTION CURVE`.
  * Report sheet renders amber `Anomalous Reaction / Suspected Framing Alert` banner and explains the kinetic discontinuity in clinical prose.

#### Scenario 4: Live SQLite Tamper Simulation & Cryptographic Break
* **Execution:**
  1. Complete a valid test and observe Green `INTEGRITY VERIFIED` status in the Evidence Vault or report.
  2. Open a terminal and run the exact 1-line Node SQLite tamper simulation command below:

```bash
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('narcotest.db'); db.exec(\"UPDATE evidence_records SET matched_result = 'ALTERED EVIDENCE TAMPER' WHERE rowid = (SELECT rowid FROM evidence_records ORDER BY server_timestamp DESC LIMIT 1);\"); console.log('[TAMPER INJECTED] Last evidence record altered in SQLite.');"
```

  3. Return to the browser Evidence Vault and click **"Verify Integrity"** (or refresh `/report.html?id=<case_id>`).
* **Expected Result:**
  * The backend recomputes SHA-256 over the altered record.
  * Computed digest diverges from the stored database seal.
  * Seal flips immediately to prominent Red Alert banner: **`TAMPERING DETECTED (RED ALERT)`**.
  * UI displays the side-by-side hash divergence box showing the Stored Hash vs. Recomputed Canonical Hash.

---

### Project Change Log (Feature-Complete & Frozen)

| Date | Release Milestone | Verification Status |
| :--- | :--- | :--- |
| **2026-11-24** | Architecture & Specification Lock | Core problem statement, threat model, and Section 3 Hard Prohibitions locked. |
| **2026-11-24** | Append-Only SQLite & Backend API | Implemented `server/db.js` with WAL mode and `server/server.js` with 10-parameter canonical hashing, 405 mutation guards, and timing-safe verification. |
| **2026-11-24** | Deterministic CV & CIELAB Math | Implemented `public/colorMath.js`: center 100×100 ROI extraction, relative luminance quality gate, sRGB $\to$ CIE XYZ $\to$ CIE $L^*a^*b^*$ (D65 illuminant), and CIE76 $\Delta E$. |
| **2026-11-24** | 3-Frame Anti-Framing Kinetic Engine | Implemented `evaluateThreeFrameAnalysis`: Pre-contaminated baseline detection ($\Delta E \le 35$), instant swap detection ($\Delta E_{1\to 2} > 35, \Delta E_{2\to 3} < 10$), and 5.00s reaction incubation. |
| **2026-11-24** | Mobile & Desktop Responsive Redesign | Modern light-mode clinical forensic UI (`public/index.html`, `public/style.css`, `public/app.js`). Dynamic Proxy accessor for null-safe DOM querying; zero horizontal overflow on 390px mobile viewports. |
| **2026-11-24** | Standalone A4 PDF Forensic Report | Implemented `public/report.html` and `public/report.js`: `@media print` A4 sheet, live cryptographic seal, 3-frame optical strip, proof table, deterministic narrative prose generator, and GC-MS disclaimer. |
| **2026-11-24** | **Master Specification & Code Freeze** | Entire repository audited and verified. Syntax checks exit code 0. `README.md` updated as comprehensive, self-contained Single Source of Truth. **FEATURE-COMPLETE & CODE-FROZEN**. |
