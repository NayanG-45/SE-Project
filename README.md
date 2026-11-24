# NarcoTest Vision (NTV)
### Objective Chemical Colorimetry & Tamper-Evident Evidence Locking System

> "The NTV system securely locks drug test results with time & location and provides tamper-proof evidence of results."

NarcoTest Vision (NTV) is a lightweight, zero-build client-server web application that replaces subjective naked-eye reading of colorimetric field drug tests (Marquis, Scott, and Mecke reagents) with deterministic CIE $L^*a^*b^*$ computer vision, a guided 3-frame anti-framing capture workflow, and an append-only SQLite evidence vault sealed with server-side SHA-256 hashes.

---

## Why NarcoTest Vision?

Conventional roadside colorimetric drug tests suffer from five well-documented evidentiary vulnerabilities:

* **Perceptual & Lighting Bias:** Streetlights and vehicle headlights distort human visual judgment and raw smartphone RGB values.
* **Timing & Oxidation Drift:** Reading a chemical reagent too early misses color formation; waiting too long causes air oxidation (dark brown/black false positives).
* **Gallery Uploads & Metadata Forgery:** Standard photo uploads permit image editing, sample substitution, and altered EXIF timestamps/GPS tags.
* **Pre-Commit Suppression:** Previewing a classification before saving allows unfavorable tests to be silently discarded.
* **Sample Framing Attacks:** Pre-colored vials or instant sample swaps can mimic a positive color without a genuine chemical reaction curve.

---

## Key Features & Architectural Guardrails

* **Hardware Pre-Flight Gate:** Enforces live camera (`getUserMedia`) and GPS (`Geolocation`) authorization before a test can begin. File uploads (`<input type="file">`) and gallery pickers are strictly excluded.
* **Guided 3-Frame Anti-Framing Capture:** Captures Frame 1 (unreacted dry baseline) $\to$ prompts reagent addition $\to$ snaps Frame 2 ($t = 0\text{s}$) $\to$ runs an uninterruptible 5.00 s countdown $\to$ automatically captures Frame 3 ($t = 5\text{s}$) and stops all camera tracks.
* **Optical Quality Gate:** Automatically rejects covered/dark lenses ($\mu_Y < 25.0$), severe glare ($\mu_Y > 248.0$), or flat blank frames ($\sigma_Y < 1.5$) across the centered $100 \times 100\text{ px}$ Region of Interest (ROI).
* **100% Deterministic Colorimetry (Zero AI / ML):** Converts sRGB $\to$ Linear RGB $\to$ CIE XYZ (D65) $\to$ CIE $L^*a^*b^*$ locally in < 50 ms with zero external APIs, neural networks, or training datasets.
* **Lock-Before-Display Protocol:** Withholds the verdict behind a locking spinner until `POST /api/lock` commits the record with an authoritative server UTC timestamp, Case ID, and 10-parameter SHA-256 seal (`201 Created`).
* **Append-Only Immutability:** Uses SQLite in WAL mode with zero `UPDATE` or `DELETE` queries in application code, backed by an explicit router guard returning `HTTP 405 Method Not Allowed` on all `PUT`, `PATCH`, and `DELETE` requests.
* **Instant Print-Ready A4 Forensic Report (`/report.html`):** Auto-generates a court-formatted A4 PDF sheet (`@media print`) embedding all 3 captured photos, quantitative $\Delta E$ proof table, live Green/Red SHA-256 verification seal, and deterministic rule-based summary text.
* **Presumptive Screening Notice:** Colorimetric field tests are strictly presumptive indicators for preliminary screening. NTV does not replace confirmatory laboratory testing (GC-MS or LC-MS/MS).

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                  CLIENT TIER (Responsive Desktop & Mobile)                 │
│                                                                            │
│  View 1: Hardware Gate ──▶ View 2: 3-Frame Capture ──▶ View 3: Lock Screen │
│  (Camera + GPS Check)      (F1 Dry → F2 t=0s → F3 5s)   (POST /api/lock)   │
│                                                               │            │
│  View 4: Evidence Vault ◀─────────────────────────────────────┘            │
│  (Case List + Inline SHA-256 Verifier)                                     │
│                                                                            │
│  Standalone A4 Report (/report.html?id=<case_id>)                          │
│  (Live Seal · 3-Frame Strip · Proof Table · Rule-Based Summary · PDF Print)│
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ JSON over HTTP (Port 3000, 10 MB limit)
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      SERVER TIER (Node.js + Express)                       │
│                                                                            │
│  • POST /api/lock               (Case ID, UTC Clock, 10-Field SHA-256)     │
│  • GET  /api/evidence           (Reverse-chronological vault listing)      │
│  • GET  /api/evidence/:id/verify(Constant-time timingSafeEqual check)      │
│  • PUT / PATCH / DELETE /api/*  (HTTP 405 Method Not Allowed Guard)        │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ Append-Only INSERT / SELECT (WAL Mode)
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    STORAGE TIER (SQLite — narcotest.db)                    │
│                                                                            │
│  evidence_records (11 Columns: case_id, frame_1..3, delta_e_pre, delta_e, │
│                   matched_result, gps_lat, gps_lng, server_timestamp,      │
│                   sha256_hash)                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```text
SE-Project/
├── docs/
│   ├── NTV_SRS.pdf           # IEEE Std 830-1998 Software Requirements Specification
│   └── NTV_Presentation.pptx # Project Defense Presentation Deck
├── public/
│   ├── index.html            # 4-view Single-Page Application console
│   ├── style.css             # Responsive clinical forensic stylesheet (Desktop & 390px Mobile)
│   ├── app.js                # Hardware permissions, 3-frame capture state machine & vault UI
│   ├── colorMath.js          # Quality Gate, sRGB→CIELAB (D65), ΔE76 & anti-framing engine
│   ├── report.html           # Standalone print-ready A4 chain-of-custody report
│   └── report.js             # Report hydration, live verification & rule-based narrative prose
├── server/
│   ├── server.js             # Express REST API, 10-field SHA-256 sealing & HTTP 405 guard
│   └── db.js                 # SQLite WAL initialization (better-sqlite3 / node:sqlite / sqlite3)
├── package.json
├── LICENSE
└── README.md
```

---

## Colorimetry & Anti-Framing Pipeline

All optical analysis runs locally in `public/colorMath.js` over the centered $100 \times 100\text{ px}$ ROI (resized frame width: 480 px, JPEG quality 0.8):

1. **Optical Quality Gate:** Computes per-pixel Rec. 709 relative luminance $Y_i = 0.2126 R_i + 0.7152 G_i + 0.0722 B_i$ across all three frames. Aborts immediately with zero server writes if $\mu_Y < 25.0$ (dark/covered), $\mu_Y > 248.0$ (glare), or $\sigma_Y < 1.5$ (flat blank).
2. **CIELAB Conversion & Kinetic Shifts:** Transforms mean ROI RGB for all 3 frames into CIE $L^*a^*b^*$ under standard illuminant D65 ($X_n = 0.95047, Y_n = 1.00000, Z_n = 1.08883$) and computes Euclidean distance $\Delta E_{76}$:
   * Pre-reagent shift: $\Delta E_{1\to 2} = \Delta E_{76}(\text{lab}_1, \text{lab}_2)$
   * 5-second reaction shift: $\Delta E_{2\to 3} = \Delta E_{76}(\text{lab}_2, \text{lab}_3)$
3. **Sequential Classification & Anti-Framing Decision Tree:**
   * **Guard 1 — Pre-Contaminated Baseline:** If $\Delta E_{76}(\text{lab}_1, \text{centroid}) \le 35.0$ $\to$ `SUSPECTED FRAMING — PRE-CONTAMINATED BASELINE`
   * **Guard 2 — Instant Swap:** If $\Delta E_{1\to 2} > 35.0$ and $\Delta E_{2\to 3} < 10.0$ $\to$ `SUSPECTED FRAMING — INSTANT SWAP / NO REACTION CURVE`
   * **No-Reaction Gate:** If $\Delta E_{2\to 3} < 12.0$ $\to$ `NEGATIVE — NO SIGNIFICANT REACTION`
   * **Nearest-Centroid Match:** Otherwise matches $\text{lab}_3$ to the closest calibrated centroid within $\Delta E_{76} \le 45.0$ (else `INCONCLUSIVE — UNRECOGNIZED COLOR SHIFT`).

| Reference Reagent | Target Tone | Calibrated CIELAB $(L^*, a^*, b^*)$ | Presumptive Classification Output |
| :--- | :--- | :--- | :--- |
| **Marquis (Purple/Violet)** | Deep Purple | $(30, 45, -45)$ | `PRESUMPTIVE POSITIVE: OPIATE CLASS (MARQUIS PURPLE)` |
| **Marquis (Orange/Brown)** | Orange-Brown | $(55, 40, 55)$ | `PRESUMPTIVE POSITIVE: AMPHETAMINE CLASS (MARQUIS ORANGE)` |
| **Scott (Turquoise/Blue)** | Cobalt Blue | $(45, -10, -45)$ | `PRESUMPTIVE POSITIVE: COCAINE CLASS (SCOTT BLUE)` |
| **Mecke (Blue-Green)** | Forest Green | $(40, -35, 15)$ | `PRESUMPTIVE POSITIVE: OPIATE/HEROIN CLASS (MECKE GREEN)` |

---

## Database & Cryptographic Seal

* **Persistence (`server/db.js`):** Uses an 11-column append-only SQLite table (`evidence_records`) in WAL mode (`PRAGMA journal_mode = WAL;`) with automatic driver fallback (`better-sqlite3` $\to$ native `node:sqlite` $\to$ `sqlite3`).
* **Canonical SHA-256 Serialization (`server/server.js`):** Eliminates JSON key-order or floating-point drift by hashing a fixed-precision, pipe-delimited (`|`) UTF-8 string across all 10 data fields:
  ```text
  case_id|frame_1|frame_2|frame_3|delta_e_pre(4dp)|delta_e(4dp)|matched_result|gps_lat(6dp)|gps_lng(6dp)|server_timestamp
  ```
* **Verification:** Executes constant-time byte comparison (`crypto.timingSafeEqual`) against the stored `sha256_hash` in $O(1)$ time.

---

## REST API Reference

| Method & Endpoint | Description | Status Codes |
| :--- | :--- | :--- |
| `POST /api/lock` | Validates 8 client fields + GPS bounds ($[-90, 90]$, $[-180, 180]$), issues `case_id` & UTC `server_timestamp`, computes SHA-256 seal, and inserts into SQLite. | `201 Created`, `400 Bad Request` |
| `GET /api/evidence` | Returns all committed evidence summaries ordered newest-first (`server_timestamp DESC`). | `200 OK` |
| `GET /api/evidence/:id/verify` | Fetches full record, recomputes 10-field canonical SHA-256, and returns `{ status: "VERIFIED" \| "TAMPERED", stored_hash, computed_hash, record }`. | `200 OK`, `404 Not Found` |
| `PUT / PATCH / DELETE /api/*` | Explicitly blocked by router immutability guard. | `405 Method Not Allowed` |

---

## Quick Start

### Prerequisites
* Node.js v18+

### Run Locally
```bash
git clone https://github.com/NayanG-45/SE-Project.git
cd SE-Project
npm install
npm start
```
Open `http://localhost:3000` in Chrome, Edge, Firefox, or Safari.

> **Mobile Testing Note:** Browser Camera (`getUserMedia`) and Geolocation APIs require a Secure Context. Desktop `http://localhost:3000` is natively secure; for mobile testing, deploy over HTTPS (e.g., Render) or forward port 3000 via `adb reverse tcp:3000 tcp:3000` / VS Code Port Forwarding.

---

## Live Tamper-Detection Verification

To demonstrate cryptographic tamper detection live during evaluation:

1. Complete any field test and confirm the green `INTEGRITY VERIFIED` banner in the Evidence Vault or `/report.html`.
2. Modify a single record directly in SQLite from the terminal:
   ```bash
   node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('narcotest.db'); db.exec(\"UPDATE evidence_records SET matched_result = 'ALTERED EVIDENCE TAMPER' WHERE rowid = (SELECT rowid FROM evidence_records ORDER BY server_timestamp DESC LIMIT 1);\"); console.log('Last evidence record altered in SQLite.');"
   ```
3. Click **Verify Integrity** in the Evidence Vault (or refresh `/report.html`). The seal flips immediately to red `TAMPERING DETECTED` displaying the Stored vs. Recomputed SHA-256 hash mismatch.

---

## Project Team & Documentation

**Team Members:**
* Chaitanya Mahendra Singh Chouhan (LIT2025024)
* Harsh Doud (LIT2025059)
* Nayan Gupta (LIT2025045)
* Bikash Kumar Meher (LIT2025009)

**Course Instructor:** Dr. Sushil Kumar Tiwari  
**Documentation:** See [docs/NTV_SRS.pdf](file:///c:/Users/Dell/OneDrive/Desktop/SE-Project/docs/NTV_SRS.pdf) for the full IEEE Std 830-1998 Software Requirements Specification.

---

## License

This project is licensed under the [MIT License](file:///c:/Users/Dell/OneDrive/Desktop/SE-Project/LICENSE).
