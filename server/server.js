/**
 * NarcoTest Vision (NTV) — Express Backend & Cryptographic Evidence Lock Engine
 *
 * SPECIFICATION REFERENCE: README.md Section 8 & 9
 * Endpoints:
 * - POST /api/lock               (Generates case_id & timestamp, computes SHA-256 seal, commits to SQLite)
 * - GET  /api/evidence           (Retrieves evidence records in reverse chronological order)
 * - GET  /api/evidence/:id/verify (Recomputes SHA-256 against stored canonical record to verify tamper status)
 *
 * HARD PROHIBITIONS (Section 3):
 * - NO PUT, PATCH, or DELETE endpoints on evidence.
 * - NO user authentication or session management.
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

// Initialize database schema
initDatabase();

// Middleware
app.use(cors());
// 10MB payload limit to accommodate two Base64 frame strings (README.md Section 9)
app.use(express.json({ limit: '10mb' }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '..', 'public')));

/**
 * 8. Cryptographic Integrity & Canonical Hashing Protocol
 * Strictly deterministic pipe-delimited canonical string to prevent formatting drift:
 * case_id|frame_1|frame_2|delta_e(4dp)|matched_result|gps_lat(6dp)|gps_lng(6dp)|server_timestamp
 *
 * @param {Object} record
 * @returns {string} SHA-256 hex digest
 */
function computeEvidenceHash(record) {
  // TODO: Canonical serialization per README.md Section 8
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

    // Strict Request Validation
    if (!frame_1 || typeof frame_1 !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid frame_1 (Base64 string required)' });
    }
    if (!frame_2 || typeof frame_2 !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid frame_2 (Base64 string required)' });
    }
    if (delta_e === undefined || typeof delta_e !== 'number' || !Number.isFinite(delta_e)) {
      return res.status(400).json({ error: 'Missing or invalid delta_e (finite number required)' });
    }
    if (!matched_result || typeof matched_result !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid matched_result' });
    }
    if (gps_lat === undefined || typeof gps_lat !== 'number' || !Number.isFinite(gps_lat)) {
      return res.status(400).json({ error: 'Missing or invalid gps_lat (finite number required)' });
    }
    if (gps_lng === undefined || typeof gps_lng !== 'number' || !Number.isFinite(gps_lng)) {
      return res.status(400).json({ error: 'Missing or invalid gps_lng (finite number required)' });
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

    // Compute Cryptographic Seal
    const sha256_hash = computeEvidenceHash(record);
    record.sha256_hash = sha256_hash;

    // Commit to SQLite
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
 * Fetches the stored record, re-computes its SHA-256 canonical hash, and compares.
 */
app.get('/api/evidence/:id/verify', async (req, res) => {
  try {
    const caseId = req.params.id;
    const storedRecord = await getEvidenceRecordById(caseId);

    if (!storedRecord) {
      return res.status(404).json({ error: `Evidence record ${caseId} not found` });
    }

    // Recompute hash using canonical protocol
    const computed_hash = computeEvidenceHash(storedRecord);
    const isVerified = crypto.timingSafeEqual(
      Buffer.from(computed_hash, 'utf8'),
      Buffer.from(storedRecord.sha256_hash, 'utf8')
    );

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

/* =============================================================================
   Hard Prohibition Enforcement: Forbid Mutating Routes (README.md Section 3)
   ============================================================================= */
app.all(['/api/evidence*', '/api/lock*'], (req, res, next) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      error: 'Method Not Allowed — Evidence records are immutable and append-only.'
    });
  }
  next();
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[NTV Server] Running at http://localhost:${PORT}`);
  });
}

module.exports = { app, computeEvidenceHash, generateCaseId };
