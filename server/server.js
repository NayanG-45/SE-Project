/**
 * NarcoTest Vision (NTV) — Express Backend & Cryptographic Evidence Lock Engine
 *
 * SPECIFICATION REFERENCE: README.md Section 8 & 9
 * Endpoints:
 * - POST /api/lock                (Generates case_id & timestamp, computes SHA-256 seal, commits to SQLite)
 * - GET  /api/evidence            (Retrieves evidence records in reverse chronological order)
 * - GET  /api/evidence/:id/verify (Recomputes canonical SHA-256 against stored record to verify tamper status)
 *
 * HARD PROHIBITIONS (README.md Section 3):
 * - NO PUT, PATCH, or DELETE endpoints on evidence (enforced via 405 Method Not Allowed).
 * - NO user authentication, sessions, or login screens.
 * - NO external AI/LLM API calls.
 * - NO file upload endpoints (JSON Base64 payloads only from live stream).
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const {
  initDatabase,
  insertEvidenceRecord,
  getAllEvidenceRecords,
  getEvidenceRecordById
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database schema on startup
initDatabase();

// Middleware
app.use(cors());
// 10MB payload limit to accommodate two Base64 JPEG frame strings (README.md Section 9)
app.use(express.json({ limit: '10mb' }));

/* =============================================================================
   Hard Prohibition Enforcement: Forbid Mutating Routes (README.md Section 3)
   405 Method Not Allowed on PUT, PATCH, DELETE across all /api endpoints.
   ============================================================================= */
app.use('/api', (req, res, next) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      error: 'Method Not Allowed — Evidence records are immutable and append-only.'
    });
  }
  next();
});

// Serve static frontend assets (zero build toolchain, pure Vanilla HTML/CSS/JS)
app.use(express.static(path.join(__dirname, '..', 'public')));

/**
 * 8. Cryptographic Integrity & Canonical Hashing Protocol
 * Strictly deterministic pipe-delimited canonical string to prevent formatting drift:
 * case_id|frame_1|frame_2|delta_e(4dp)|matched_result|gps_lat(6dp)|gps_lng(6dp)|server_timestamp
 *
 * @param {Object} record
 * @returns {string} SHA-256 hex digest (64 characters)
 */
function computeEvidenceHash(record) {
  const canonicalPayload = [
    String(record.case_id),
    String(record.frame_1),
    String(record.frame_2),
    Number(record.delta_e).toFixed(4),
    String(record.matched_result),
    Number(record.gps_lat).toFixed(6),
    Number(record.gps_lng).toFixed(6),
    String(record.server_timestamp)
  ].join('|');

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

/**
 * Generates an authoritative server-side Case ID.
 * Format: NTV-YYYYMMDD-XXXXXX (README.md Section 8)
 *
 * @returns {string}
 */
function generateCaseId() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NTV-${dateStr}-${randomSuffix}`;
}

/* =============================================================================
   REST API Endpoints (Append-Only Contract)
   ============================================================================= */

/**
 * POST /api/lock
 * Receives: { frame_1, frame_2, delta_e, matched_result, gps_lat, gps_lng }
 * Generates: case_id, server_timestamp, sha256_hash
 * Returns: 201 Created with full locked record
 */
app.post('/api/lock', async (req, res) => {
  try {
    const { frame_1, frame_2, delta_e, matched_result, gps_lat, gps_lng } = req.body;

    // Strict Request Body Validation
    if (!frame_1 || typeof frame_1 !== 'string' || !frame_1.trim()) {
      return res.status(400).json({ error: 'Missing or invalid frame_1 (Base64 JPEG string required)' });
    }
    if (!frame_2 || typeof frame_2 !== 'string' || !frame_2.trim()) {
      return res.status(400).json({ error: 'Missing or invalid frame_2 (Base64 JPEG string required)' });
    }
    if (delta_e === undefined || typeof delta_e !== 'number' || !Number.isFinite(delta_e)) {
      return res.status(400).json({ error: 'Missing or invalid delta_e (finite number required)' });
    }
    if (!matched_result || typeof matched_result !== 'string' || !matched_result.trim()) {
      return res.status(400).json({ error: 'Missing or invalid matched_result' });
    }
    if (gps_lat === undefined || typeof gps_lat !== 'number' || !Number.isFinite(gps_lat) || gps_lat < -90 || gps_lat > 90) {
      return res.status(400).json({ error: 'Missing or invalid gps_lat (-90 to 90 required)' });
    }
    if (gps_lng === undefined || typeof gps_lng !== 'number' || !Number.isFinite(gps_lng) || gps_lng < -180 || gps_lng > 180) {
      return res.status(400).json({ error: 'Missing or invalid gps_lng (-180 to 180 required)' });
    }

    // Authoritative Server Telemetry Generation (Never trust client clock or ID)
    const case_id = generateCaseId();
    const server_timestamp = new Date().toISOString();

    const record = {
      case_id,
      frame_1,
      frame_2,
      delta_e,
      matched_result,
      gps_lat,
      gps_lng,
      server_timestamp
    };

    // Compute Cryptographic SHA-256 Seal
    const sha256_hash = computeEvidenceHash(record);
    record.sha256_hash = sha256_hash;

    // Commit to SQLite (Append-Only)
    await insertEvidenceRecord(record);

    return res.status(201).json(record);
  } catch (err) {
    console.error('[API] POST /api/lock error:', err);
    return res.status(500).json({ error: 'Internal Server Error while locking evidence' });
  }
});

/**
 * GET /api/evidence
 * Retrieves all locked evidence records in reverse chronological order.
 */
app.get('/api/evidence', async (req, res) => {
  try {
    const records = await getAllEvidenceRecords();
    return res.status(200).json(records);
  } catch (err) {
    console.error('[API] GET /api/evidence error:', err);
    return res.status(500).json({ error: 'Failed to retrieve evidence vault records' });
  }
});

/**
 * GET /api/evidence/:id/verify
 * Fetches the stored record, re-computes its canonical SHA-256 hash, and performs
 * constant-time byte-for-byte comparison against stored sha256_hash.
 */
app.get('/api/evidence/:id/verify', async (req, res) => {
  try {
    const caseId = req.params.id;
    const storedRecord = await getEvidenceRecordById(caseId);

    if (!storedRecord) {
      return res.status(404).json({ error: `Evidence record ${caseId} not found` });
    }

    // Recompute hash using the exact canonical protocol
    const computed_hash = computeEvidenceHash(storedRecord);

    // Constant-time comparison (safe against differing buffer lengths)
    let isVerified = false;
    const computedBuf = Buffer.from(computed_hash, 'utf8');
    const storedBuf = Buffer.from(String(storedRecord.sha256_hash || ''), 'utf8');

    if (computedBuf.length === storedBuf.length) {
      isVerified = crypto.timingSafeEqual(computedBuf, storedBuf);
    }

    return res.status(200).json({
      status: isVerified ? 'VERIFIED' : 'TAMPERED',
      case_id: storedRecord.case_id,
      stored_hash: storedRecord.sha256_hash,
      computed_hash,
      record: storedRecord
    });
  } catch (err) {
    console.error('[API] GET /api/evidence/:id/verify error:', err);
    return res.status(500).json({ error: 'Failed to verify evidence record integrity' });
  }
});

// Start Server when invoked directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[NTV Server] Running at http://localhost:${PORT}`);
  });
}

module.exports = { app, computeEvidenceHash, generateCaseId };
