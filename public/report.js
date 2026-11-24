/**
 * NarcoTest Vision (NTV) — Official Forensic Chain-of-Custody Report Engine
 *
 * SPECIFICATION REFERENCE: README.md Section 8 & 9
 * Fetches: GET /api/evidence/:id/verify
 * Renders:
 *  - Authoritative metadata (Case ID, UTC Timestamp, GPS)
 *  - Cryptographic verification seal (Green VERIFIED / Red TAMPERED)
 *  - 3-frame photographic optical evidence strip
 *  - Quantitative colorimetric distance matrix (Delta E 1->2 and 2->3)
 *  - Deterministic clinical prose narrative summary (Zero AI / LLM)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('report-loading');
  const errorEl = document.getElementById('report-error');
  const errorMessageEl = document.getElementById('report-error-message');
  const sheetEl = document.getElementById('report-sheet');

  const urlParams = new URLSearchParams(window.location.search);
  const caseId = urlParams.get('id');

  if (!caseId || !caseId.trim()) {
    showError('Missing Case Identifier (?id=<case_id>) in query parameter.');
    return;
  }

  try {
    const res = await fetch(`/api/evidence/${encodeURIComponent(caseId.trim())}/verify`);
    
    if (!res.ok) {
      if (res.status === 404) {
        showError(`Evidence record "${escapeHtml(caseId)}" was not found in the forensic vault (HTTP 404).`);
      } else {
        showError(`Failed to retrieve case record "${escapeHtml(caseId)}" (HTTP ${res.status}).`);
      }
      return;
    }

    const verificationResult = await res.json();
    const record = verificationResult.record;

    if (!record) {
      showError('Server returned an empty or malformed evidence record.');
      return;
    }

    populateReport(record, verificationResult);

    loadingEl.classList.add('hidden');
    sheetEl.classList.remove('hidden');

  } catch (err) {
    showError(`Network connection failure or server error: ${err.message}`);
  }

  function showError(msg) {
    loadingEl.classList.add('hidden');
    sheetEl.classList.add('hidden');
    errorMessageEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }
});

/**
 * Populates all DOM elements in the standalone report sheet.
 *
 * @param {Object} record - Stored evidence record from SQLite
 * @param {Object} verificationResult - Verification payload from /verify
 */
function populateReport(record, verificationResult) {
  // 1. Header Identifiers
  document.getElementById('report-case-id').textContent = record.case_id;
  document.getElementById('report-timestamp').textContent = new Date(record.server_timestamp).toUTCString();

  // 2. Cryptographic Integrity Seal Banner
  const isVerified = verificationResult.status === 'VERIFIED';
  const integrityBanner = document.getElementById('integrity-seal-banner');
  const integrityTitle = document.getElementById('integrity-title');
  const integrityDesc = document.getElementById('integrity-desc');
  const tamperComparison = document.getElementById('tamper-hashes-comparison');

  if (isVerified) {
    integrityBanner.className = 'integrity-banner verified';
    integrityTitle.textContent = 'INTEGRITY VERIFIED (GREEN)';
    integrityDesc.textContent = `Server recomputed SHA-256 matches stored evidentiary seal byte-for-byte: ${verificationResult.stored_hash}`;
    tamperComparison.classList.add('hidden');
    tamperComparison.innerHTML = '';
  } else {
    integrityBanner.className = 'integrity-banner tampered';
    integrityTitle.textContent = 'TAMPERING DETECTED (RED ALERT)';
    integrityDesc.textContent = 'Cryptographic signature mismatch! SQLite record has been altered or corrupted post-commitment:';
    tamperComparison.classList.remove('hidden');
    tamperComparison.innerHTML = `
      <div class="tamper-hash-item">
        <strong>Stored Hash in Vault:</strong>
        <div style="word-break: break-all; color: var(--warning); margin-top: 2px;">${escapeHtml(verificationResult.stored_hash || '')}</div>
      </div>
      <div class="tamper-hash-item">
        <strong>Recomputed Canonical Hash:</strong>
        <div style="word-break: break-all; color: var(--danger); margin-top: 2px;">${escapeHtml(verificationResult.computed_hash || '')}</div>
      </div>
    `;
  }

  // 3. Classification Verdict Banner
  const verdictBanner = document.getElementById('verdict-banner');
  const verdictTitle = document.getElementById('verdict-title');
  const verdictBadge = document.getElementById('verdict-badge');
  const verdictResultText = document.getElementById('verdict-result-text');

  const resultStr = String(record.matched_result || '');
  verdictResultText.textContent = resultStr;

  if (resultStr.includes('SUSPECTED FRAMING')) {
    verdictBanner.className = 'verdict-banner verdict-framing';
    verdictTitle.textContent = 'Anomalous Reaction / Suspected Framing Alert';
    verdictBadge.textContent = 'Tampering Anomaly';
  } else if (resultStr.includes('PRESUMPTIVE POSITIVE')) {
    verdictBanner.className = 'verdict-banner verdict-positive';
    verdictTitle.textContent = 'Presumptive Positive Chemical Identification';
    verdictBadge.textContent = 'Target Match';
  } else if (resultStr.includes('NEGATIVE')) {
    verdictBanner.className = 'verdict-banner verdict-negative';
    verdictTitle.textContent = 'Presumptive Negative Determination';
    verdictBadge.textContent = 'No Reaction';
  } else {
    verdictBanner.className = 'verdict-banner verdict-inconclusive';
    verdictTitle.textContent = 'Inconclusive Color Shift';
    verdictBadge.textContent = 'Unrecognized';
  }

  // 4. 3-Frame Photographic Evidence Strip
  document.getElementById('img-frame1').src = record.frame_1;
  document.getElementById('img-frame2').src = record.frame_2;
  document.getElementById('img-frame3').src = record.frame_3;

  // 5. Quantitative Telemetry & Cryptographic Proof Table
  const deltaEPre = record.delta_e_pre !== undefined ? Number(record.delta_e_pre).toFixed(4) : '0.0000';
  const deltaE = Number(record.delta_e).toFixed(4);
  const gpsLat = Number(record.gps_lat).toFixed(6);
  const gpsLng = Number(record.gps_lng).toFixed(6);

  document.getElementById('table-delta-e-pre').textContent = deltaEPre;
  document.getElementById('table-delta-e').textContent = deltaE;
  document.getElementById('table-gps').textContent = `${gpsLat}, ${gpsLng}`;
  document.getElementById('table-timestamp').textContent = `${new Date(record.server_timestamp).toISOString()} (${new Date(record.server_timestamp).toUTCString()})`;
  document.getElementById('table-stored-hash').textContent = verificationResult.stored_hash || record.sha256_hash;
  document.getElementById('table-computed-hash').textContent = verificationResult.computed_hash;
  
  const statusEl = document.getElementById('table-integrity-status');
  if (isVerified) {
    statusEl.textContent = 'VERIFIED — BYTE-FOR-BYTE CANONICAL MATCH';
    statusEl.style.color = 'var(--success)';
  } else {
    statusEl.textContent = 'TAMPERED — CRYPTOGRAPHIC DIVERGENCE DETECTED';
    statusEl.style.color = 'var(--danger)';
  }

  // 6. Formal Narrative Text Report (Deterministic Rule-Based Clinical Prose)
  const narrativeText = generateNarrativeReport(record, verificationResult);
  document.getElementById('narrative-report-text').textContent = narrativeText;
}

/**
 * Generates a strictly deterministic, rule-based forensic narrative report in clinical prose.
 * Obeying Section 3: ZERO AI, ZERO LLM, ZERO hallucination.
 *
 * @param {Object} record - Complete evidentiary record
 * @param {Object} verificationResult - Verification metadata
 * @returns {string} Formal forensic narrative prose
 */
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
