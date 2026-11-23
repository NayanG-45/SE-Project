/**
 * NarcoTest Vision (NTV) — Client Application State Machine & Hardware Controller
 *
 * SPECIFICATION REFERENCE: README.md Section 6
 * Responsibilities:
 * - View Navigation (New Test Views 1-3 vs Evidence Vault View 4)
 * - View 1: Hardware Pre-Flight Gate (Camera & Geolocation Permissions)
 * - View 2: Automated 2-Frame Timed Capture (getUserMedia, Fixed Timer, ROI canvas extraction)
 * - View 3: Mathematical Analysis & Lock-Before-Display (POST /api/lock before result display)
 * - View 4: Immutable Evidence Vault & Live Tamper Verifier (GET /api/evidence & /:id/verify)
 *
 * HARD PROHIBITIONS (Section 3):
 * - ZERO file inputs / gallery uploads.
 * - ZERO authentication / user login.
 * - ZERO mutating API calls (PUT, PATCH, DELETE).
 * - ZERO external ML or AI classification APIs.
 */

import {
  extractCenterROI,
  evaluateQualityGate,
  computeAverageRGB,
  rgbToCielab,
  classifyReaction
} from './colorMath.js';

// Configuration Constants
const REACTION_DELAY_MS = 5000; // 5000ms (5s) for live testing/demo; configurable to 30000-60000ms for field reagents
const CAPTURE_WIDTH = 480;
const CAPTURE_HEIGHT = 360;
const ROI_SIZE = 100;

// Application State
const state = {
  activeView: 'view-permissions',
  cameraGranted: false,
  gpsGranted: false,
  gpsCoords: null, // { lat: number, lng: number }
  mediaStream: null,
  isCapturing: false,
  capturedData: {
    frame_1: null, // Base64 JPEG
    frame_2: null, // Base64 JPEG
    delta_e: null,
    matched_result: null
  }
};

// DOM Elements
const elements = {
  // Navigation
  navBtnTest: document.getElementById('nav-btn-test'),
  navBtnVault: document.getElementById('nav-btn-vault'),

  // Views
  viewPermissions: document.getElementById('view-permissions'),
  viewCapture: document.getElementById('view-capture'),
  viewAnalysis: document.getElementById('view-analysis'),
  viewVault: document.getElementById('view-vault'),

  // View 1
  badgeCameraStatus: document.getElementById('badge-camera-status'),
  badgeGpsStatus: document.getElementById('badge-gps-status'),
  labelGpsCoords: document.getElementById('label-gps-coords'),
  btnRequestPerms: document.getElementById('btn-request-perms'),
  btnStartTest: document.getElementById('btn-start-test'),
  permissionErrorAlert: document.getElementById('permission-error-alert'),

  // View 2
  cameraFeed: document.getElementById('camera-feed'),
  captureCanvas: document.getElementById('capture-canvas'),
  timerDisplay: document.getElementById('timer-display'),
  captureStatusOverlay: document.getElementById('capture-status-overlay'),
  captureStatusText: document.getElementById('capture-status-text'),
  qualityGateError: document.getElementById('quality-gate-error'),
  stepBaseline: document.getElementById('step-baseline'),
  stepReaction: document.getElementById('step-reaction'),
  stepReacted: document.getElementById('step-reacted'),

  // View 3
  lockingSpinner: document.getElementById('locking-spinner'),
  lockedReportContainer: document.getElementById('locked-report-container'),
  reportCaseId: document.getElementById('report-case-id'),
  reportTimestamp: document.getElementById('report-timestamp'),
  imgBaseline: document.getElementById('img-baseline'),
  imgReacted: document.getElementById('img-reacted'),
  reportDeltaE: document.getElementById('report-delta-e'),
  reportGps: document.getElementById('report-gps'),
  reportMatchedResult: document.getElementById('report-matched-result'),
  reportSha256: document.getElementById('report-sha256'),
  btnNextTest: document.getElementById('btn-next-test'),
  btnViewInVault: document.getElementById('btn-view-in-vault'),

  // View 4
  btnRefreshVault: document.getElementById('btn-refresh-vault'),
  vaultRecordsBody: document.getElementById('vault-records-body'),
  tamperVerificationBanner: document.getElementById('tamper-verification-banner')
};

/* =============================================================================
   View Switching & State Navigation
   ============================================================================= */
function switchView(targetViewId) {
  // TODO: Switch active panel visibility and update navigation button states
  const views = [elements.viewPermissions, elements.viewCapture, elements.viewAnalysis, elements.viewVault];
  views.forEach(v => {
    if (v.id === targetViewId) {
      v.classList.remove('hidden');
      v.classList.add('active');
    } else {
      v.classList.add('hidden');
      v.classList.remove('active');
    }
  });

  state.activeView = targetViewId;

  if (targetViewId === 'view-vault') {
    elements.navBtnVault.classList.add('active');
    elements.navBtnTest.classList.remove('active');
    loadVaultRecords();
  } else {
    elements.navBtnTest.classList.add('active');
    elements.navBtnVault.classList.remove('active');
  }
}

/* =============================================================================
   View 1: Pre-Flight Hardware Permission Gate
   ============================================================================= */
async function requestHardwarePermissions() {
  // TODO: Request camera and GPS hardware permissions, update status badges, and enable "Perform Test"
  elements.permissionErrorAlert.classList.add('hidden');

  try {
    // 1. Camera check
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: CAPTURE_WIDTH }, height: { ideal: CAPTURE_HEIGHT } }
    });
    // Release stream after permission verification
    stream.getTracks().forEach(track => track.stop());
    state.cameraGranted = true;
    elements.badgeCameraStatus.textContent = 'GRANTED';
    elements.badgeCameraStatus.className = 'badge badge-granted';
  } catch (err) {
    state.cameraGranted = false;
    elements.badgeCameraStatus.textContent = 'DENIED';
    elements.badgeCameraStatus.className = 'badge badge-denied';
    showPermissionError('Camera permission denied: ' + err.message);
  }

  try {
    // 2. Geolocation check
    await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation not supported by device'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.gpsGranted = true;
          state.gpsCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          elements.badgeGpsStatus.textContent = 'ACQUIRED';
          elements.badgeGpsStatus.className = 'badge badge-granted';
          elements.labelGpsCoords.textContent = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
          resolve(pos);
        },
        (err) => {
          state.gpsGranted = false;
          elements.badgeGpsStatus.textContent = 'DENIED';
          elements.badgeGpsStatus.className = 'badge badge-denied';
          elements.labelGpsCoords.textContent = 'Position unavailable';
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  } catch (err) {
    showPermissionError('GPS location failed: ' + err.message);
  }

  // Hard Gate check: both must be granted
  if (state.cameraGranted && state.gpsGranted) {
    elements.btnStartTest.disabled = false;
  } else {
    elements.btnStartTest.disabled = true;
  }
}

function showPermissionError(msg) {
  elements.permissionErrorAlert.textContent = msg;
  elements.permissionErrorAlert.classList.remove('hidden');
}

/* =============================================================================
   View 2: Automated 2-Frame Timed Capture Sequence
   ============================================================================= */
async function startCaptureSequence() {
  // TODO: Start live camera feed, sample Frame 1 at t=0s, countdown REACTION_DELAY_MS, sample Frame 2 at t=deltaT
  switchView('view-capture');
  elements.qualityGateError.classList.add('hidden');
  resetCaptureIndicators();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: CAPTURE_WIDTH },
        height: { ideal: CAPTURE_HEIGHT }
      }
    });

    state.mediaStream = stream;
    elements.cameraFeed.srcObject = stream;
    await elements.cameraFeed.play();

    // Stabilization delay (500ms) before t=0s baseline capture
    setCaptureStatus('Warming up sensor stream...', true);
    await delay(500);

    // Frame 1: Baseline Capture (t=0s)
    setCaptureStatus('Capturing Baseline Frame (t=0s)...', true);
    elements.stepBaseline.classList.add('active');
    const frame1Result = captureFrameAndROI();

    // Quality Gate Check on Frame 1
    const qg1 = evaluateQualityGate(frame1Result.roiImageData);
    if (!qg1.valid) {
      abortCapture('Frame 1 (Baseline) Rejected: ' + qg1.reason);
      return;
    }

    elements.stepBaseline.classList.remove('active');
    elements.stepBaseline.classList.add('complete');

    // Reaction Countdown
    elements.stepReaction.classList.add('active');
    setCaptureStatus('Chemical Reaction Window Active...', true);
    await runCountdown(REACTION_DELAY_MS);
    elements.stepReaction.classList.remove('active');
    elements.stepReaction.classList.add('complete');

    // Frame 2: Reacted Capture (t=deltaT)
    setCaptureStatus('Capturing Reacted Frame (t=\u0394t)...', true);
    elements.stepReacted.classList.add('active');
    const frame2Result = captureFrameAndROI();

    // Stop camera immediately
    stopCamera();

    // Quality Gate Check on Frame 2
    const qg2 = evaluateQualityGate(frame2Result.roiImageData);
    if (!qg2.valid) {
      abortCapture('Frame 2 (Reacted) Rejected: ' + qg2.reason);
      return;
    }

    elements.stepReacted.classList.remove('active');
    elements.stepReacted.classList.add('complete');
    setCaptureStatus('', false);

    // Transition to Mathematical Analysis & Lock-Before-Display
    processAndLockEvidence(frame1Result, frame2Result);

  } catch (err) {
    stopCamera();
    abortCapture('Camera initialization error: ' + err.message);
  }
}

function captureFrameAndROI() {
  const canvas = elements.captureCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = CAPTURE_WIDTH;
  canvas.height = CAPTURE_HEIGHT;

  ctx.drawImage(elements.cameraFeed, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
  const base64Jpeg = canvas.toDataURL('image/jpeg', 0.8);
  const roiImageData = extractCenterROI(ctx, CAPTURE_WIDTH, CAPTURE_HEIGHT, ROI_SIZE);

  return { base64Jpeg, roiImageData };
}

function runCountdown(durationMs) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, durationMs - elapsed);
      elements.timerDisplay.textContent = (remaining / 1000).toFixed(2) + 's';

      if (remaining <= 0) {
        clearInterval(interval);
        elements.timerDisplay.textContent = '0.00s';
        resolve();
      }
    }, 50);
  });
}

function setCaptureStatus(text, visible) {
  elements.captureStatusText.textContent = text;
  if (visible) {
    elements.captureStatusOverlay.classList.remove('hidden');
  } else {
    elements.captureStatusOverlay.classList.add('hidden');
  }
}

function resetCaptureIndicators() {
  elements.stepBaseline.className = 'step-indicator';
  elements.stepReaction.className = 'step-indicator';
  elements.stepReacted.className = 'step-indicator';
  elements.timerDisplay.textContent = (REACTION_DELAY_MS / 1000).toFixed(2) + 's';
}

function stopCamera() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }
  elements.cameraFeed.srcObject = null;
}

function abortCapture(reason) {
  stopCamera();
  elements.qualityGateError.textContent = `INVALID CAPTURE: ${reason} — RETRY TEST`;
  elements.qualityGateError.classList.remove('hidden');
  setCaptureStatus('', false);
}

/* =============================================================================
   View 3: Local Mathematical Analysis & Lock-Before-Display Protocol
   ============================================================================= */
async function processAndLockEvidence(frame1Data, frame2Data) {
  // TODO: Compute CIELAB shift & reagent match, then POST to /api/lock before displaying results
  switchView('view-analysis');
  elements.lockingSpinner.classList.remove('hidden');
  elements.lockedReportContainer.classList.add('hidden');

  // 1. Deterministic mathematical color transformation
  const rgb1 = computeAverageRGB(frame1Data.roiImageData);
  const rgb2 = computeAverageRGB(frame2Data.roiImageData);

  const lab1 = rgbToCielab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = rgbToCielab(rgb2.r, rgb2.g, rgb2.b);

  const classification = classifyReaction(lab1, lab2);

  // 2. Lock-Before-Display: POST /api/lock
  try {
    const payload = {
      frame_1: frame1Data.base64Jpeg,
      frame_2: frame2Data.base64Jpeg,
      delta_e: parseFloat(classification.deltaE_shift.toFixed(4)),
      matched_result: classification.matchedResult,
      gps_lat: parseFloat(state.gpsCoords.lat.toFixed(6)),
      gps_lng: parseFloat(state.gpsCoords.lng.toFixed(6))
    };

    const res = await fetch('/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const lockedRecord = await res.json();

    // 3. Render Locked Read-Only Report ONLY after server confirmation
    renderLockedReport(lockedRecord);

  } catch (err) {
    elements.lockingSpinner.classList.add('hidden');
    alert('Cryptographic Lock Failed: ' + err.message + '\nEvidence was NOT committed.');
    switchView('view-permissions');
  }
}

function renderLockedReport(record) {
  elements.lockingSpinner.classList.add('hidden');
  elements.lockedReportContainer.classList.remove('hidden');

  elements.reportCaseId.textContent = record.case_id;
  elements.reportTimestamp.textContent = new Date(record.server_timestamp).toUTCString();
  elements.imgBaseline.src = record.frame_1;
  elements.imgReacted.src = record.frame_2;
  elements.reportDeltaE.textContent = Number(record.delta_e).toFixed(4);
  elements.reportGps.textContent = `${Number(record.gps_lat).toFixed(6)}, ${Number(record.gps_lng).toFixed(6)}`;
  elements.reportMatchedResult.textContent = record.matched_result;
  elements.reportSha256.textContent = record.sha256_hash;
}

/* =============================================================================
   View 4: Evidence Vault & Live Tamper Verification
   ============================================================================= */
async function loadVaultRecords() {
  // TODO: Fetch records via GET /api/evidence and populate the vault table
  elements.vaultRecordsBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Fetching locked evidence...</td></tr>';
  elements.tamperVerificationBanner.classList.add('hidden');

  try {
    const res = await fetch('/api/evidence');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const records = await res.json();

    if (!records || records.length === 0) {
      elements.vaultRecordsBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No evidence records locked yet.</td></tr>';
      return;
    }

    elements.vaultRecordsBody.innerHTML = '';
    records.forEach(rec => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="font-family: var(--font-mono);">${escapeHtml(rec.case_id)}</strong></td>
        <td>${new Date(rec.server_timestamp).toUTCString()}</td>
        <td><span class="badge badge-pending" style="font-size: 0.7rem;">${escapeHtml(rec.matched_result)}</span></td>
        <td style="font-family: var(--font-mono);">${Number(rec.delta_e).toFixed(4)}</td>
        <td style="font-family: var(--font-mono); font-size: 0.75rem;">${Number(rec.gps_lat).toFixed(6)}, ${Number(rec.gps_lng).toFixed(6)}</td>
        <td>
          <button class="btn btn-secondary btn-verify" data-case-id="${escapeHtml(rec.case_id)}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
            Verify Integrity
          </button>
        </td>
      `;
      elements.vaultRecordsBody.appendChild(tr);
    });

    // Attach verify click handlers
    document.querySelectorAll('.btn-verify').forEach(btn => {
      btn.addEventListener('click', () => verifyRecordIntegrity(btn.dataset.caseId));
    });

  } catch (err) {
    elements.vaultRecordsBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load vault: ${err.message}</td></tr>`;
  }
}

async function verifyRecordIntegrity(caseId) {
  // TODO: Call GET /api/evidence/:id/verify and display GREEN (VERIFIED) or RED (TAMPERED)
  try {
    const res = await fetch(`/api/evidence/${encodeURIComponent(caseId)}/verify`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    elements.tamperVerificationBanner.classList.remove('hidden', 'verified', 'tampered');

    if (result.status === 'VERIFIED') {
      elements.tamperVerificationBanner.classList.add('verified');
      elements.tamperVerificationBanner.innerHTML = `
        <strong>&#10004; INTEGRITY VERIFIED (GREEN)</strong> &mdash; Case: <code>${escapeHtml(caseId)}</code><br>
        <span style="font-size: 0.8rem;">SHA-256 Digest matches stored byte-for-byte:</span><br>
        <code style="word-break: break-all; font-size: 0.75rem;">${escapeHtml(result.stored_hash)}</code>
      `;
    } else {
      elements.tamperVerificationBanner.classList.add('tampered');
      elements.tamperVerificationBanner.innerHTML = `
        <strong>&#9888; TAMPERING DETECTED (RED ALERT)</strong> &mdash; Case: <code>${escapeHtml(caseId)}</code><br>
        <span style="font-size: 0.8rem;">Database row corruption or unauthorized modification detected!</span><br>
        <div style="font-size: 0.75rem; margin-top: 0.5rem; word-break: break-all;">
          <strong>Stored Hash:</strong> <code>${escapeHtml(result.stored_hash)}</code><br>
          <strong>Recomputed Hash:</strong> <code>${escapeHtml(result.computed_hash)}</code>
        </div>
      `;
    }

    elements.tamperVerificationBanner.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    alert('Verification request failed: ' + err.message);
  }
}

/* =============================================================================
   Utilities & Event Listeners
   ============================================================================= */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Event Listeners
elements.navBtnTest.addEventListener('click', () => switchView('view-permissions'));
elements.navBtnVault.addEventListener('click', () => switchView('view-vault'));
elements.btnRequestPerms.addEventListener('click', requestHardwarePermissions);
elements.btnStartTest.addEventListener('click', startCaptureSequence);
elements.btnRefreshVault.addEventListener('click', loadVaultRecords);
elements.btnNextTest.addEventListener('click', () => switchView('view-permissions'));
elements.btnViewInVault.addEventListener('click', () => switchView('view-vault'));

// Auto-request or check permissions on initial page load if supported
window.addEventListener('DOMContentLoaded', () => {
  // Initial ready state
});
