/**
 * NarcoTest Vision (NTV) — Client Application State Machine & Hardware Controller
 *
 * SPECIFICATION REFERENCE: README.md Sections 3, 4, 6, and 7
 * Design System: Forensic Precision Laboratory Console (DESIGN.md)
 *
 * Architecture Compliance:
 * - View 1: Pre-Flight Hardware Permission Gate (Camera + Geolocation)
 * - View 2: Automated 2-Frame Timed Capture (500ms warm-up, t=0s, 5000ms countdown, t=deltaT, no manual tap)
 * - View 3: Mathematical Quality Gate + Local Math + Lock-Before-Display (POST /api/lock before result display)
 * - View 4: Immutable Evidence Vault + Live Tamper Verifier (Stacked Mobile Cards, zero horizontal scroll on 390px)
 *
 * HARD PROHIBITIONS (README.md Section 3):
 * - ZERO file inputs or gallery pickers (<input type="file"> is strictly banned).
 * - ZERO authentication / user login.
 * - ZERO mutating API calls (PUT, PATCH, DELETE).
 * - ZERO external ML or AI classification APIs (100% deterministic local math).
 */

import {
  extractCenterROI,
  evaluateQualityGate,
  computeAverageRGB,
  rgbToCielab,
  classifyReaction
} from './colorMath.js';

// Configuration Constants per Specification (README.md Section 6)
const REACTION_DELAY_MS = 5000; // 5000ms (5s) for live testing/demo
const CAPTURE_MAX_WIDTH = 480;  // Max width for lightweight payload
const ROI_SIZE = 100;           // Fixed 100x100 px centered reticle sampling zone

// Central Application State
const state = {
  activeView: 'view-permissions',
  cameraGranted: false,
  gpsGranted: false,
  gpsCoords: null, // { lat: number, lng: number }
  mediaStream: null,
  isCapturing: false
};

// Cached DOM Elements
const elements = {
  // Navigation
  navBtnTest: document.getElementById('nav-btn-test'),
  navBtnVault: document.getElementById('nav-btn-vault'),

  // Views
  viewPermissions: document.getElementById('view-permissions'),
  viewCapture: document.getElementById('view-capture'),
  viewAnalysis: document.getElementById('view-analysis'),
  viewVault: document.getElementById('view-vault'),

  // View 1: Pre-Flight Gate
  badgeCameraStatus: document.getElementById('badge-camera-status'),
  badgeGpsStatus: document.getElementById('badge-gps-status'),
  labelGpsCoords: document.getElementById('label-gps-coords'),
  btnRequestPerms: document.getElementById('btn-request-perms'),
  btnStartTest: document.getElementById('btn-start-test'),
  permissionErrorAlert: document.getElementById('permission-error-alert'),

  // View 2: Live Capture
  cameraFeed: document.getElementById('camera-feed'),
  captureCanvas: document.getElementById('capture-canvas'),
  timerDisplay: document.getElementById('timer-display'),
  captureStatusOverlay: document.getElementById('capture-status-overlay'),
  captureStatusText: document.getElementById('capture-status-text'),
  qualityGateError: document.getElementById('quality-gate-error'),
  qualityGateErrorText: document.getElementById('quality-gate-error-text'),
  btnRetryCapture: document.getElementById('btn-retry-capture'),
  stepBaseline: document.getElementById('step-baseline'),
  stepReaction: document.getElementById('step-reaction'),
  stepReacted: document.getElementById('step-reacted'),

  // View 3: Lock-Before-Display
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

  // View 4: Evidence Vault
  btnRefreshVault: document.getElementById('btn-refresh-vault'),
  vaultRecordsBody: document.getElementById('vault-records-body'),
  tamperVerificationBanner: document.getElementById('tamper-verification-banner'),
  vaultCaseDetail: document.getElementById('vault-case-detail'),
  vaultDetailCaseId: document.getElementById('vault-detail-case-id'),
  btnCloseVaultDetail: document.getElementById('btn-close-vault-detail'),
  vaultDetailFrame1: document.getElementById('vault-detail-frame1'),
  vaultDetailFrame2: document.getElementById('vault-detail-frame2'),
  vaultDetailDeltaE: document.getElementById('vault-detail-delta-e'),
  vaultDetailGps: document.getElementById('vault-detail-gps'),
  vaultDetailResult: document.getElementById('vault-detail-result')
};

/* =============================================================================
   View Switching & State Navigation
   ============================================================================= */
function switchView(targetViewId) {
  const views = [
    elements.viewPermissions,
    elements.viewCapture,
    elements.viewAnalysis,
    elements.viewVault
  ];

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
   View 1: Pre-Flight Hardware Permission Gate (Fail-Fast Pre-condition)
   ============================================================================= */
async function requestHardwarePermissions() {
  elements.permissionErrorAlert.classList.add('hidden');
  elements.permissionErrorAlert.textContent = '';

  let cameraOk = false;
  let gpsOk = false;
  const errors = [];

  // 1. Hardware Camera Stream Check
  try {
    let testStream;
    try {
      testStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
    } catch {
      // Fallback to any available video sensor (e.g. laptop front camera)
      testStream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    testStream.getTracks().forEach(track => track.stop());
    cameraOk = true;
    state.cameraGranted = true;
    elements.badgeCameraStatus.textContent = 'GRANTED';
    elements.badgeCameraStatus.className = 'badge badge-granted';
  } catch (err) {
    cameraOk = false;
    state.cameraGranted = false;
    elements.badgeCameraStatus.textContent = 'DENIED';
    elements.badgeCameraStatus.className = 'badge badge-denied';
    errors.push('Camera: ' + (err.message || 'Access denied by user or device'));
  }

  // 2. Hardware Geolocation (GPS) Fix Check
  try {
    if (!navigator.geolocation) {
      throw new Error('Geolocation API not supported by browser environment');
    }

    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

    gpsOk = true;
    state.gpsGranted = true;
    state.gpsCoords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };
    elements.badgeGpsStatus.textContent = 'ACQUIRED';
    elements.badgeGpsStatus.className = 'badge badge-granted';
    elements.labelGpsCoords.textContent = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
  } catch (err) {
    gpsOk = false;
    state.gpsGranted = false;
    elements.badgeGpsStatus.textContent = 'DENIED';
    elements.badgeGpsStatus.className = 'badge badge-denied';
    elements.labelGpsCoords.textContent = 'GPS fix unavailable';
    errors.push('GPS: ' + (err.message || 'Position unavailable or denied'));
  }

  // Hard Gate: Perform Field Test button strictly enabled ONLY when both are active
  if (cameraOk && gpsOk) {
    elements.btnStartTest.disabled = false;
    elements.btnStartTest.focus();
  } else {
    elements.btnStartTest.disabled = true;
    elements.permissionErrorAlert.textContent = `Authorization incomplete: ${errors.join(' | ')}`;
    elements.permissionErrorAlert.classList.remove('hidden');
  }
}

/* =============================================================================
   View 2: Automated 2-Frame Timed Capture Sequence (Zero Manual Triggering)
   ============================================================================= */
async function startCaptureSequence() {
  if (!state.cameraGranted || !state.gpsGranted) {
    switchView('view-permissions');
    return;
  }

  switchView('view-capture');
  elements.qualityGateError.classList.add('hidden');
  resetCaptureIndicators();
  state.isCapturing = true;

  try {
    // Initialize live camera (prefer environment, fallback gracefully to laptop default)
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    state.mediaStream = stream;
    elements.cameraFeed.srcObject = stream;
    await elements.cameraFeed.play();

    // 1. Sensor Stream Stabilization (500ms warm-up)
    setCaptureStatus('Warming up optical sensor (500ms)...', true);
    await delay(500);

    // 2. Automated Baseline Capture (t = 0s)
    setCaptureStatus('Sampling Baseline Frame (t=0s)...', true);
    elements.stepBaseline.classList.add('active');
    const frame1 = captureFrameAndCenterROI();

    // Mathematical Quality Gate on Frame 1
    const qg1 = evaluateQualityGate(frame1.roiImageData);
    if (!qg1.valid) {
      abortCapture(`Baseline Frame Failed Quality Gate: ${qg1.reason}`);
      return;
    }

    elements.stepBaseline.classList.remove('active');
    elements.stepBaseline.classList.add('complete');

    // 3. Chemical Reaction Countdown (Uninterruptible REACTION_DELAY_MS = 5000)
    elements.stepReaction.classList.add('active');
    setCaptureStatus('Incubation Active — Align vial in reticle...', true);
    await runCountdown(REACTION_DELAY_MS);
    elements.stepReaction.classList.remove('active');
    elements.stepReaction.classList.add('complete');

    // 4. Automated Reacted Capture (t = deltaT, zero manual user tap)
    setCaptureStatus('Sampling Reacted Frame (t=\u0394t)...', true);
    elements.stepReacted.classList.add('active');
    const frame2 = captureFrameAndCenterROI();

    // Stop camera hardware tracks immediately
    stopCamera();

    // Mathematical Quality Gate on Frame 2
    const qg2 = evaluateQualityGate(frame2.roiImageData);
    if (!qg2.valid) {
      abortCapture(`Reacted Frame Failed Quality Gate: ${qg2.reason}`);
      return;
    }

    elements.stepReacted.classList.remove('active');
    elements.stepReacted.classList.add('complete');
    setCaptureStatus('', false);
    state.isCapturing = false;

    // Transition to Mathematical Processing & Lock-Before-Display
    processAndLockEvidence(frame1, frame2);

  } catch (err) {
    stopCamera();
    abortCapture('Camera initialization failed: ' + (err.message || 'Stream error'));
  }
}

/**
 * Extracts resized video frame (max width 480px, Base64 JPEG 0.8) and center 100x100 ROI.
 */
function captureFrameAndCenterROI() {
  const canvas = elements.captureCanvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const video = elements.cameraFeed;

  const videoW = video.videoWidth || 640;
  const videoH = video.videoHeight || 480;

  // Scale down to max width 480 maintaining aspect ratio (Section 6)
  const targetW = Math.min(CAPTURE_MAX_WIDTH, videoW);
  const targetH = Math.round((videoH / videoW) * targetW);

  canvas.width = targetW;
  canvas.height = targetH;

  // Draw full video frame onto canvas
  ctx.drawImage(video, 0, 0, targetW, targetH);
  const base64Jpeg = canvas.toDataURL('image/jpeg', 0.8);

  // Extract center 100x100 Region of Interest (ROI)
  const roiImageData = extractCenterROI(ctx, targetW, targetH, ROI_SIZE);

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
    }, 40);
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
  state.isCapturing = false;
}

function abortCapture(reason) {
  stopCamera();
  elements.qualityGateErrorText.textContent = `INVALID CAPTURE: ${reason} — RETRY TEST`;
  elements.qualityGateError.classList.remove('hidden');
  setCaptureStatus('', false);
}

/* =============================================================================
   View 3: Local Mathematical Analysis & Lock-Before-Display Protocol
   ============================================================================= */
async function processAndLockEvidence(frame1, frame2) {
  switchView('view-analysis');

  // Lock-Before-Display: Show locking spinner, do NOT display result yet
  elements.lockingSpinner.classList.remove('hidden');
  elements.lockedReportContainer.classList.add('hidden');

  // 1. Synchronous Deterministic Colorimetric Transformation (README.md Section 7)
  const rgb1 = computeAverageRGB(frame1.roiImageData);
  const rgb2 = computeAverageRGB(frame2.roiImageData);

  const lab1 = rgbToCielab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = rgbToCielab(rgb2.r, rgb2.g, rgb2.b);

  const classification = classifyReaction(lab1, lab2);

  // 2. Lock-Before-Display: POST /api/lock
  try {
    const payload = {
      frame_1: frame1.base64Jpeg,
      frame_2: frame2.base64Jpeg,
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

    // 3. Render Locked Read-Only Report ONLY after receiving HTTP 201 Created
    renderLockedReport(lockedRecord);

  } catch (err) {
    elements.lockingSpinner.classList.add('hidden');
    alert('Cryptographic Lock Failed: ' + err.message + '\nEvidence was NOT committed to the permanent vault.');
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
   View 4: Read-Only Evidence Vault & Live Tamper Verifier (Stacked Mobile Cards)
   ============================================================================= */
async function loadVaultRecords() {
  elements.vaultRecordsBody.innerHTML = '<div class="vault-empty-state">Fetching locked evidence records...</div>';
  elements.tamperVerificationBanner.classList.add('hidden');
  elements.vaultCaseDetail.classList.add('hidden');

  try {
    const res = await fetch('/api/evidence');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const records = await res.json();

    if (!records || records.length === 0) {
      elements.vaultRecordsBody.innerHTML = '<div class="vault-empty-state">No evidence records committed to the vault yet.</div>';
      return;
    }

    elements.vaultRecordsBody.innerHTML = '';
    records.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'evidence-vault-card';

      let badgeClass = 'badge-pending';
      if (rec.matched_result && rec.matched_result.includes('POSITIVE')) {
        badgeClass = 'badge-success';
      } else if (rec.matched_result && rec.matched_result.includes('NEGATIVE')) {
        badgeClass = 'badge-pending';
      } else if (rec.matched_result && rec.matched_result.includes('INCONCLUSIVE')) {
        badgeClass = 'badge-danger';
      }

      card.innerHTML = `
        <div class="vault-card-header">
          <div class="case-id-group">
            <span class="card-field-label">Case Identifier</span>
            <span class="case-id-mono">${escapeHtml(rec.case_id)}</span>
          </div>
          <span class="badge ${badgeClass}">
            ${escapeHtml(rec.matched_result)}
          </span>
        </div>

        <div class="vault-card-telemetry">
          <div class="telemetry-cell">
            <span class="card-field-label">Timestamp (UTC)</span>
            <span class="telemetry-value">${new Date(rec.server_timestamp).toUTCString()}</span>
          </div>
          <div class="telemetry-cell">
            <span class="card-field-label">Perceptual Shift (&Delta;E)</span>
            <span class="telemetry-value highlight">${Number(rec.delta_e).toFixed(4)}</span>
          </div>
          <div class="telemetry-cell full-width">
            <span class="card-field-label">GPS Coordinate Fix</span>
            <span class="telemetry-value">${Number(rec.gps_lat).toFixed(6)}, ${Number(rec.gps_lng).toFixed(6)}</span>
          </div>
        </div>

        <button class="btn btn-secondary btn-sm btn-verify btn-full" data-case-id="${escapeHtml(rec.case_id)}" type="button">
          <svg class="btn-svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>Verify Integrity &rarr;</span>
        </button>
      `;
      elements.vaultRecordsBody.appendChild(card);
    });

    // Attach click listeners for integrity verification
    document.querySelectorAll('.btn-verify').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        verifyRecordIntegrity(btn.dataset.caseId);
      });
    });

  } catch (err) {
    elements.vaultRecordsBody.innerHTML = `<div class="alert alert-danger">Failed to load vault records: ${err.message}</div>`;
  }
}

async function verifyRecordIntegrity(caseId) {
  try {
    elements.tamperVerificationBanner.classList.add('hidden');
    const res = await fetch(`/api/evidence/${encodeURIComponent(caseId)}/verify`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    elements.tamperVerificationBanner.classList.remove('hidden', 'verified', 'tampered');

    if (result.status === 'VERIFIED') {
      elements.tamperVerificationBanner.classList.add('verified');
      elements.tamperVerificationBanner.innerHTML = `
        <strong>&#10004; INTEGRITY VERIFIED &bull; CASE: <code>${escapeHtml(caseId)}</code></strong>
        <span style="font-size: 0.75rem; color: #047857; display: block; margin-top: 0.25rem; margin-bottom: 0.5rem;">
          Server recomputed SHA-256 matches stored evidentiary seal byte-for-byte:
        </span>
        <div class="hash-box">
          <span class="hash-box-label">Verified SHA-256 Digest</span>
          <code style="color: var(--status-granted); font-weight: 700;">${escapeHtml(result.stored_hash)}</code>
        </div>
      `;
    } else {
      elements.tamperVerificationBanner.classList.add('tampered');
      elements.tamperVerificationBanner.innerHTML = `
        <strong>&#9888; TAMPERING DETECTED (ALERT) &bull; CASE: <code>${escapeHtml(caseId)}</code></strong>
        <span style="font-size: 0.75rem; color: #B91C1C; display: block; margin-top: 0.25rem; margin-bottom: 0.5rem;">
          Cryptographic signature divergence! SQLite storage row has been altered:
        </span>
        <div class="hash-comparison-grid">
          <div class="hash-box">
            <span class="hash-box-label">Stored Hash in Vault</span>
            <code style="color: var(--status-pending); font-weight: 700;">${escapeHtml(result.stored_hash)}</code>
          </div>
          <div class="hash-box">
            <span class="hash-box-label">Recomputed Canonical Hash</span>
            <code style="color: var(--status-denied); font-weight: 700;">${escapeHtml(result.computed_hash)}</code>
          </div>
        </div>
      `;
    }

    // Populate Inspection Detail Panel if full record was returned
    if (result.record) {
      elements.vaultDetailCaseId.textContent = result.record.case_id;
      elements.vaultDetailFrame1.src = result.record.frame_1;
      elements.vaultDetailFrame2.src = result.record.frame_2;
      elements.vaultDetailDeltaE.textContent = Number(result.record.delta_e).toFixed(4);
      elements.vaultDetailGps.textContent = `${Number(result.record.gps_lat).toFixed(6)}, ${Number(result.record.gps_lng).toFixed(6)}`;
      elements.vaultDetailResult.textContent = result.record.matched_result;
      elements.vaultCaseDetail.classList.remove('hidden');
    }

    elements.tamperVerificationBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    alert('Integrity verification request failed: ' + err.message);
  }
}

/* =============================================================================
   Utilities & Event Wiring
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

// Navigation Events
elements.navBtnTest.addEventListener('click', () => switchView('view-permissions'));
elements.navBtnVault.addEventListener('click', () => switchView('view-vault'));

// View 1 Events
elements.btnRequestPerms.addEventListener('click', requestHardwarePermissions);
elements.btnStartTest.addEventListener('click', startCaptureSequence);

// View 2 Events
elements.btnRetryCapture.addEventListener('click', () => {
  elements.qualityGateError.classList.add('hidden');
  startCaptureSequence();
});

// View 3 Events
elements.btnNextTest.addEventListener('click', () => {
  switchView('view-permissions');
});
elements.btnViewInVault.addEventListener('click', () => {
  switchView('view-vault');
});

// View 4 Events
elements.btnRefreshVault.addEventListener('click', loadVaultRecords);
elements.btnCloseVaultDetail.addEventListener('click', () => {
  elements.vaultCaseDetail.classList.add('hidden');
});

// Page Initialization
window.addEventListener('DOMContentLoaded', () => {
  elements.btnStartTest.disabled = true;
});
