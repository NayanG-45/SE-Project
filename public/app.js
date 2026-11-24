/**
 * NarcoTest Vision (NTV) — Client Application State Machine & Hardware Controller
 *
 * SPECIFICATION REFERENCE: README.md Sections 3, 4, 6, and 7
 * Design System: Forensic Precision Laboratory Console (DESIGN.md)
 *
 * Architecture Compliance:
 * - View 1: Pre-Flight Hardware Permission Gate (Camera + Geolocation)
 * - View 2: Automated Guided Capture & Kinetic Incubation (Baseline -> Reagent -> 5s Incubation -> Reacted)
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
  classifyReaction,
  evaluateThreeFrameAnalysis
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
  isCapturing: false,
  frame1: null,
  frame2: null,
  frame3: null
};

// DOM ID Mapping Table
const ID_MAP = {
  // Navigation
  navBtnTest: 'nav-btn-test',
  navBtnVault: 'nav-btn-vault',

  // Views
  viewPermissions: 'view-permissions',
  viewCapture: 'view-capture',
  viewAnalysis: 'view-analysis',
  viewVault: 'view-vault',

  // View 1: Pre-Flight Gate
  badgeCameraStatus: 'badge-camera-status',
  badgeGpsStatus: 'badge-gps-status',
  labelGpsCoords: 'label-gps-coords',
  btnRequestPerms: 'btn-request-perms',
  btnStartTest: 'btn-start-test',
  permissionErrorAlert: 'permission-error-alert',

  // View 2: Live Capture & Instructions
  cameraFeed: 'camera-feed',
  captureCanvas: 'capture-canvas',
  timerDisplay: 'timer-display',
  captureStatusOverlay: 'capture-status-overlay',
  captureStatusText: 'capture-status-text',
  qualityGateError: 'quality-gate-error',
  qualityGateErrorText: 'quality-gate-error-text',
  btnRetryCapture: 'btn-retry-capture',
  stepBaseline: 'step-baseline',
  stepReaction: 'step-reaction',
  stepReacted: 'step-reacted',
  captureStepPrep: 'capture-step-prep',
  btnCaptureBaseline: 'btn-capture-baseline',
  captureStepReagent: 'capture-step-reagent',
  btnStartReaction: 'btn-start-reaction',

  // View 3: Lock-Before-Display
  lockingSpinner: 'locking-spinner',
  lockedReportContainer: 'locked-report-container',
  reportCaseId: 'report-case-id',
  reportTimestamp: 'report-timestamp',
  imgBaseline: 'img-baseline',
  imgReacted: 'img-reacted',
  reportDeltaE: 'report-delta-e',
  reportGps: 'report-gps',
  reportMatchedResult: 'report-matched-result',
  reportSha256: 'report-sha256',
  btnNextTest: 'btn-next-test',
  btnViewInVault: 'btn-view-in-vault',

  // View 4: Evidence Vault
  btnRefreshVault: 'btn-refresh-vault',
  vaultRecordsBody: 'vault-records-body',
  tamperVerificationBanner: 'tamper-verification-banner',
  vaultCaseDetail: 'vault-case-detail',
  vaultDetailCaseId: 'vault-detail-case-id',
  btnCloseVaultDetail: 'btn-close-vault-detail',
  vaultDetailFrame1: 'vault-detail-frame1',
  vaultDetailFrame2: 'vault-detail-frame2',
  vaultDetailDeltaE: 'vault-detail-delta-e',
  vaultDetailGps: 'vault-detail-gps',
  vaultDetailResult: 'vault-detail-result'
};

// Dynamic Element Accessor via Proxy (Guarantees live DOM resolution with null-safety)
const elements = new Proxy({}, {
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined;
    const id = ID_MAP[prop] || prop;
    return (typeof document !== 'undefined') ? document.getElementById(id) : null;
  }
});

/**
 * Safe Event Listener Helper
 * Ensures absent elements never crash script initialization
 */
function addSafeListener(el, event, handler) {
  if (el && typeof el.addEventListener === 'function') {
    el.addEventListener(event, handler);
  }
}

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
    if (!v) return;
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
    if (elements.navBtnVault) elements.navBtnVault.classList.add('active');
    if (elements.navBtnTest) elements.navBtnTest.classList.remove('active');
    loadVaultRecords();
  } else {
    if (elements.navBtnTest) elements.navBtnTest.classList.add('active');
    if (elements.navBtnVault) elements.navBtnVault.classList.remove('active');
  }
}

/* =============================================================================
   View 1: Pre-Flight Hardware Permission Gate (Fail-Fast Pre-condition)
   ============================================================================= */
async function requestHardwarePermissions() {
  if (elements.permissionErrorAlert) {
    elements.permissionErrorAlert.classList.add('hidden');
    elements.permissionErrorAlert.textContent = '';
  }

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
    if (elements.badgeCameraStatus) {
      elements.badgeCameraStatus.textContent = 'GRANTED';
      elements.badgeCameraStatus.className = 'badge badge-granted';
    }
  } catch (err) {
    cameraOk = false;
    state.cameraGranted = false;
    if (elements.badgeCameraStatus) {
      elements.badgeCameraStatus.textContent = 'DENIED';
      elements.badgeCameraStatus.className = 'badge badge-denied';
    }
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
    if (elements.badgeGpsStatus) {
      elements.badgeGpsStatus.textContent = 'ACQUIRED';
      elements.badgeGpsStatus.className = 'badge badge-granted';
    }
    if (elements.labelGpsCoords) {
      elements.labelGpsCoords.textContent = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    }
  } catch (err) {
    gpsOk = false;
    state.gpsGranted = false;
    if (elements.badgeGpsStatus) {
      elements.badgeGpsStatus.textContent = 'DENIED';
      elements.badgeGpsStatus.className = 'badge badge-denied';
    }
    if (elements.labelGpsCoords) {
      elements.labelGpsCoords.textContent = 'GPS fix unavailable';
    }
    errors.push('GPS: ' + (err.message || 'Position unavailable or denied'));
  }

  // Hard Gate: Perform Field Test button strictly enabled ONLY when both are active
  if (cameraOk && gpsOk) {
    if (elements.btnStartTest) {
      elements.btnStartTest.disabled = false;
      elements.btnStartTest.focus();
    }
  } else {
    if (elements.btnStartTest) {
      elements.btnStartTest.disabled = true;
    }
    if (elements.permissionErrorAlert) {
      elements.permissionErrorAlert.textContent = `Authorization incomplete: ${errors.join(' | ')}`;
      elements.permissionErrorAlert.classList.remove('hidden');
    }
  }
}

/* =============================================================================
   View 2: 3-Frame Guided Capture & Chemical Reaction Protocol
   ============================================================================= */

/**
 * View 2 — Step 1 (Alignment & Instructions)
 * Opens live camera with 100x100 ROI reticle paused in Alignment Mode.
 * Displays preparation instructions and "Capture Baseline Sample (Frame 1)" button.
 */
async function openCameraAndAlign() {
  if (!state.cameraGranted || !state.gpsGranted) {
    switchView('view-permissions');
    return;
  }

  switchView('view-capture');
  if (elements.qualityGateError) elements.qualityGateError.classList.add('hidden');
  resetCaptureIndicators();
  state.isCapturing = true;
  state.frame1 = null;
  state.frame2 = null;
  state.frame3 = null;

  if (elements.captureStepPrep) elements.captureStepPrep.classList.remove('hidden');
  if (elements.captureStepReagent) elements.captureStepReagent.classList.add('hidden');
  if (elements.btnCaptureBaseline) elements.btnCaptureBaseline.disabled = false;

  try {
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
    if (elements.cameraFeed) {
      elements.cameraFeed.srcObject = stream;
      await elements.cameraFeed.play();
    }

    setCaptureStatus('Alignment Mode — Place dry sample inside reticle.', true);
  } catch (err) {
    stopCamera();
    abortCapture('Camera initialization failed: ' + (err.message || 'Stream error'));
  }
}

// Alias for backwards compatibility
const startCaptureSequence = openCameraAndAlign;

/**
 * View 2 — Step 2 (Reagent Prompt)
 * Snaps Frame 1, runs evaluateQualityGate immediately, keeps live camera running,
 * and displays prominent amber instruction box with "Reagent Added — Start 5s Reaction" button.
 */
async function onCaptureBaseline() {
  if (elements.btnCaptureBaseline) elements.btnCaptureBaseline.disabled = true;
  setCaptureStatus('Sampling Baseline Frame (Frame 1)...', true);

  const frame1 = captureFrameAndCenterROI();
  if (!frame1) {
    if (elements.btnCaptureBaseline) elements.btnCaptureBaseline.disabled = false;
    abortCapture('Failed to capture baseline image');
    return;
  }

  const qg1 = evaluateQualityGate(frame1.roiImageData);

  if (!qg1.valid) {
    if (elements.btnCaptureBaseline) elements.btnCaptureBaseline.disabled = false;
    abortCapture(`Baseline Sample: ${qg1.reason}`);
    return;
  }

  state.frame1 = frame1;
  if (elements.stepBaseline) elements.stepBaseline.classList.add('done');
  if (elements.captureStepPrep) elements.captureStepPrep.classList.add('hidden');
  if (elements.captureStepReagent) elements.captureStepReagent.classList.remove('hidden');
  setCaptureStatus('Baseline locked. Add reagent to sample.', true);
}

/**
 * View 2 — Step 3 (Automated Reaction & Redirect)
 * Immediately snaps Frame 2 (t=0s), runs uninterruptible 5.00s countdown,
 * snaps Frame 3 (t=5s), stops camera tracks, runs evaluateThreeFrameAnalysis,
 * commits to POST /api/lock, and on 201 Created redirects to /report.html?id=<case_id>.
 */
async function onStartReaction() {
  if (elements.btnStartReaction) elements.btnStartReaction.disabled = true;
  if (elements.captureStepReagent) elements.captureStepReagent.classList.add('hidden');

  // 1. Immediately snap Frame 2 (t = 0s)
  setCaptureStatus('Sampling Reaction Baseline (Frame 2, t=0s)...', true);
  if (elements.stepReaction) elements.stepReaction.classList.add('active');
  const frame2 = captureFrameAndCenterROI();
  state.frame2 = frame2;

  // 2. Uninterruptible 5.00s countdown
  setCaptureStatus('Reaction incubation active (5.00s)...', true);
  await runCountdown(REACTION_DELAY_MS);

  // 3. Snap Frame 3 (t = 5s)
  setCaptureStatus('Sampling Reacted Frame (Frame 3, t=5s)...', true);
  const frame3 = captureFrameAndCenterROI();
  state.frame3 = frame3;

  if (elements.stepReaction) {
    elements.stepReaction.classList.remove('active');
    elements.stepReaction.classList.add('done');
  }
  if (elements.stepReacted) {
    elements.stepReacted.classList.add('done');
  }

  // Stop camera hardware tracks immediately
  stopCamera();
  setCaptureStatus('', false);
  state.isCapturing = false;

  // 4. Run evaluateThreeFrameAnalysis
  const fnEval = (typeof evaluateThreeFrameAnalysis === 'function')
    ? evaluateThreeFrameAnalysis
    : (typeof window !== 'undefined' && window.ColorMath && typeof window.ColorMath.evaluateThreeFrameAnalysis === 'function')
      ? window.ColorMath.evaluateThreeFrameAnalysis
      : (typeof window !== 'undefined' && window.evaluateThreeFrameAnalysis)
        || (typeof globalThis !== 'undefined' && globalThis.evaluateThreeFrameAnalysis);

  if (typeof fnEval !== 'function') {
    abortCapture('Internal evaluation module unavailable');
    return;
  }

  const analysis = fnEval(
    state.frame1.roiImageData,
    frame2.roiImageData,
    frame3.roiImageData
  );

  if (!analysis.valid) {
    abortCapture(analysis.reason);
    return;
  }

  // 5. Send POST /api/lock and redirect on 201 Created
  await processAndLockEvidence(state.frame1, frame2, frame3, analysis);
}

/**
 * Extracts resized video frame (max width 480px, Base64 JPEG 0.8) and center 100x100 ROI.
 */
function captureFrameAndCenterROI() {
  const canvas = elements.captureCanvas;
  const video = elements.cameraFeed;
  if (!canvas || !video) return null;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
      if (elements.timerDisplay) {
        elements.timerDisplay.textContent = (remaining / 1000).toFixed(2) + 's';
      }

      if (remaining <= 0) {
        clearInterval(interval);
        if (elements.timerDisplay) {
          elements.timerDisplay.textContent = '0.00s';
        }
        resolve();
      }
    }, 40);
  });
}

function setCaptureStatus(text, visible) {
  if (elements.captureStatusText) {
    elements.captureStatusText.textContent = text;
  }
  if (elements.captureStatusOverlay) {
    if (visible) {
      elements.captureStatusOverlay.classList.remove('hidden');
    } else {
      elements.captureStatusOverlay.classList.add('hidden');
    }
  }
}

function resetCaptureIndicators() {
  if (elements.stepBaseline) elements.stepBaseline.className = 'step-indicator';
  if (elements.stepReaction) elements.stepReaction.className = 'step-indicator';
  if (elements.stepReacted) elements.stepReacted.className = 'step-indicator';
  if (elements.timerDisplay) {
    elements.timerDisplay.textContent = (REACTION_DELAY_MS / 1000).toFixed(2) + 's';
  }
}

function stopCamera() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }
  if (elements.cameraFeed) {
    elements.cameraFeed.srcObject = null;
  }
  state.isCapturing = false;
}

function abortCapture(reason) {
  stopCamera();
  if (elements.qualityGateErrorText) {
    elements.qualityGateErrorText.textContent = `INVALID CAPTURE: ${reason} — RETRY TEST`;
  }
  if (elements.qualityGateError) {
    elements.qualityGateError.classList.remove('hidden');
  }
  setCaptureStatus('', false);
  if (elements.captureStepPrep) elements.captureStepPrep.classList.add('hidden');
  if (elements.captureStepReagent) elements.captureStepReagent.classList.add('hidden');
}

/* =============================================================================
   View 3: Local Mathematical Analysis & Lock-Before-Display Protocol
   ============================================================================= */
async function processAndLockEvidence(frame1, frame2, frame3, analysis) {
  switchView('view-analysis');

  // Lock-Before-Display: Show locking spinner, do NOT display result yet
  if (elements.lockingSpinner) elements.lockingSpinner.classList.remove('hidden');
  if (elements.lockedReportContainer) elements.lockedReportContainer.classList.add('hidden');

  try {
    const payload = {
      frame_1: frame1.base64Jpeg,
      frame_2: frame2.base64Jpeg,
      frame_3: frame3.base64Jpeg,
      delta_e_pre: parseFloat(analysis.delta_e_pre.toFixed(4)),
      delta_e: parseFloat(analysis.delta_e.toFixed(4)),
      matched_result: analysis.matched_result || analysis.matchedResult,
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

    // On 201 Created: Redirect to /report.html?id=<case_id>
    window.location.href = `/report.html?id=${encodeURIComponent(lockedRecord.case_id)}`;

  } catch (err) {
    if (elements.lockingSpinner) elements.lockingSpinner.classList.add('hidden');
    alert('Cryptographic Lock Failed: ' + err.message + '\nEvidence was NOT committed to the permanent vault.');
    switchView('view-permissions');
  }
}

function renderLockedReport(record) {
  if (elements.lockingSpinner) elements.lockingSpinner.classList.add('hidden');
  if (elements.lockedReportContainer) elements.lockedReportContainer.classList.remove('hidden');

  if (elements.reportCaseId) elements.reportCaseId.textContent = record.case_id;
  if (elements.reportTimestamp) elements.reportTimestamp.textContent = new Date(record.server_timestamp).toUTCString();
  if (elements.imgBaseline) elements.imgBaseline.src = record.frame_1;
  if (elements.imgReacted) elements.imgReacted.src = record.frame_2;
  if (elements.reportDeltaE) elements.reportDeltaE.textContent = Number(record.delta_e).toFixed(4);
  if (elements.reportGps) elements.reportGps.textContent = `${Number(record.gps_lat).toFixed(6)}, ${Number(record.gps_lng).toFixed(6)}`;
  if (elements.reportMatchedResult) elements.reportMatchedResult.textContent = record.matched_result;
  if (elements.reportSha256) elements.reportSha256.textContent = record.sha256_hash;
}

/* =============================================================================
   View 4: Read-Only Evidence Vault & Live Tamper Verifier (Stacked Mobile Cards)
   ============================================================================= */
async function loadVaultRecords() {
  if (elements.vaultRecordsBody) {
    elements.vaultRecordsBody.innerHTML = '<div class="vault-empty-state">Fetching locked evidence records...</div>';
  }
  if (elements.tamperVerificationBanner) {
    elements.tamperVerificationBanner.classList.add('hidden');
  }
  if (elements.vaultCaseDetail) {
    elements.vaultCaseDetail.classList.add('hidden');
  }

  try {
    const res = await fetch('/api/evidence');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const records = await res.json();

    if (!records || records.length === 0) {
      if (elements.vaultRecordsBody) {
        elements.vaultRecordsBody.innerHTML = '<div class="vault-empty-state">No evidence records committed to the vault yet.</div>';
      }
      return;
    }

    if (elements.vaultRecordsBody) {
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
              <span class="card-field-label">Pre-Shift (&Delta;E&#8321;&#8594;&#8322;)</span>
              <span class="telemetry-value highlight">${rec.delta_e_pre !== undefined ? Number(rec.delta_e_pre).toFixed(4) : '0.0000'}</span>
            </div>
            <div class="telemetry-cell">
              <span class="card-field-label">Reaction Shift (&Delta;E&#8322;&#8594;&#8323;)</span>
              <span class="telemetry-value highlight">${Number(rec.delta_e).toFixed(4)}</span>
            </div>
            <div class="telemetry-cell">
              <span class="card-field-label">GPS Coordinate Fix</span>
              <span class="telemetry-value">${Number(rec.gps_lat).toFixed(6)}, ${Number(rec.gps_lng).toFixed(6)}</span>
            </div>
          </div>

          <div class="vault-card-actions">
            <button class="btn btn-secondary btn-sm btn-verify" data-case-id="${escapeHtml(rec.case_id)}" type="button">
              <svg class="btn-svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Verify Integrity</span>
            </button>
            <a href="/report.html?id=${encodeURIComponent(rec.case_id)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm btn-view-report">
              <span>View Official Report &nearr;</span>
            </a>
          </div>
        `;
        elements.vaultRecordsBody.appendChild(card);
      });

      // Attach click listeners for integrity verification
      elements.vaultRecordsBody.querySelectorAll('.btn-verify').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          verifyRecordIntegrity(btn.dataset.caseId);
        });
      });
    }

  } catch (err) {
    if (elements.vaultRecordsBody) {
      elements.vaultRecordsBody.innerHTML = `<div class="alert alert-danger">Failed to load vault records: ${err.message}</div>`;
    }
  }
}

async function verifyRecordIntegrity(caseId) {
  try {
    if (elements.tamperVerificationBanner) {
      elements.tamperVerificationBanner.classList.add('hidden');
    }
    const res = await fetch(`/api/evidence/${encodeURIComponent(caseId)}/verify`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();

    if (elements.tamperVerificationBanner) {
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

      elements.tamperVerificationBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Populate Inspection Detail Panel if full record was returned
    if (result.record) {
      if (elements.vaultDetailCaseId) elements.vaultDetailCaseId.textContent = result.record.case_id;
      if (elements.vaultDetailFrame1) elements.vaultDetailFrame1.src = result.record.frame_1;
      if (elements.vaultDetailFrame2) elements.vaultDetailFrame2.src = result.record.frame_2;
      if (elements.vaultDetailDeltaE) elements.vaultDetailDeltaE.textContent = Number(result.record.delta_e).toFixed(4);
      if (elements.vaultDetailGps) elements.vaultDetailGps.textContent = `${Number(result.record.gps_lat).toFixed(6)}, ${Number(result.record.gps_lng).toFixed(6)}`;
      if (elements.vaultDetailResult) elements.vaultDetailResult.textContent = result.record.matched_result;
      if (elements.vaultCaseDetail) elements.vaultCaseDetail.classList.remove('hidden');
    }

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

let isInitialized = false;
function initEventListeners() {
  if (isInitialized) return;
  isInitialized = true;

  // Navigation Events
  addSafeListener(elements.navBtnTest, 'click', () => switchView('view-permissions'));
  addSafeListener(elements.navBtnVault, 'click', () => switchView('view-vault'));

  // View 1 Events
  addSafeListener(elements.btnRequestPerms, 'click', requestHardwarePermissions);
  addSafeListener(elements.btnStartTest, 'click', openCameraAndAlign);

  // View 2 Events
  addSafeListener(elements.btnCaptureBaseline, 'click', onCaptureBaseline);
  addSafeListener(elements.btnStartReaction, 'click', onStartReaction);
  addSafeListener(elements.btnRetryCapture, 'click', () => {
    if (elements.qualityGateError) elements.qualityGateError.classList.add('hidden');
    openCameraAndAlign();
  });

  // View 3 Events
  addSafeListener(elements.btnNextTest, 'click', () => {
    switchView('view-permissions');
  });
  addSafeListener(elements.btnViewInVault, 'click', () => {
    switchView('view-vault');
  });

  // View 4 Events
  addSafeListener(elements.btnRefreshVault, 'click', loadVaultRecords);
  addSafeListener(elements.btnCloseVaultDetail, 'click', () => {
    if (elements.vaultCaseDetail) elements.vaultCaseDetail.classList.add('hidden');
  });

  if (elements.btnStartTest) {
    elements.btnStartTest.disabled = true;
  }
}

// Attach listeners immediately or wait for DOMContentLoaded if parsing
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventListeners);
  } else {
    initEventListeners();
  }
}

// Export state and handlers for debugging/inspection
export {
  state,
  switchView,
  requestHardwarePermissions,
  openCameraAndAlign,
  onCaptureBaseline,
  onStartReaction,
  processAndLockEvidence,
  loadVaultRecords,
  verifyRecordIntegrity
};
