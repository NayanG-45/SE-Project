/**
 * NarcoTest Vision (NTV) — Database Layer & Append-Only SQLite Persistence
 *
 * SPECIFICATION REFERENCE: README.md Section 8 & 9
 * Schema: evidence_records
 *  - case_id TEXT PRIMARY KEY
 *  - frame_1 TEXT NOT NULL
 *  - frame_2 TEXT NOT NULL
 *  - delta_e REAL NOT NULL
 *  - matched_result TEXT NOT NULL
 *  - gps_lat REAL NOT NULL
 *  - gps_lng REAL NOT NULL
 *  - server_timestamp TEXT NOT NULL
 *  - sha256_hash TEXT NOT NULL
 *
 * HARD PROHIBITIONS (Section 3):
 * - NO mutating SQL statements (UPDATE, DELETE).
 * - Read and Insert operations only.
 */

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'narcotest.db');

let db = null;
let dbDriver = null; // 'better-sqlite3' | 'node-sqlite' | 'sqlite3'

// Initialize Database Connection (better-sqlite3 -> node:sqlite synchronous -> sqlite3 fallback)
function initDatabase() {
  // Strategy 1: better-sqlite3 (preferred per README.md)
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    dbDriver = 'better-sqlite3';
    db.pragma('journal_mode = WAL');
    console.log('[DB] Connected via better-sqlite3:', DB_PATH);
    createSchema();
    return;
  } catch (err) {
    // Strategy 2: node:sqlite DatabaseSync (Node 22/24 native synchronous SQLite, identical API to better-sqlite3)
    try {
      const { DatabaseSync } = require('node:sqlite');
      db = new DatabaseSync(DB_PATH);
      dbDriver = 'node-sqlite';
      db.exec('PRAGMA journal_mode = WAL;');
      console.log('[DB] Connected via native node:sqlite (synchronous):', DB_PATH);
      createSchema();
      return;
    } catch (err2) {
      // Strategy 3: sqlite3 (callback fallback)
      try {
        const sqlite3 = require('sqlite3').verbose();
        db = new sqlite3.Database(DB_PATH);
        dbDriver = 'sqlite3';
        console.log('[DB] Connected via sqlite3 fallback:', DB_PATH);
        createSchema();
        return;
      } catch (err3) {
        console.error('[DB] All SQLite drivers failed to initialize:', err3.message);
        throw err3;
      }
    }
  }
}

/**
 * Creates the immutable evidence_records table if it does not already exist.
 */
function createSchema() {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS evidence_records (
      case_id TEXT PRIMARY KEY,
      frame_1 TEXT NOT NULL,
      frame_2 TEXT NOT NULL,
      delta_e REAL NOT NULL,
      matched_result TEXT NOT NULL,
      gps_lat REAL NOT NULL,
      gps_lng REAL NOT NULL,
      server_timestamp TEXT NOT NULL,
      sha256_hash TEXT NOT NULL
    );
  `;

  if (dbDriver === 'better-sqlite3' || dbDriver === 'node-sqlite') {
    // TODO: Execute table creation synchronously
    db.exec(schemaSql);
  } else if (dbDriver === 'sqlite3') {
    db.run(schemaSql, (err) => {
      if (err) console.error('[DB] Schema initialization failed:', err);
    });
  }
}

/**
 * Inserts a new immutable evidence record.
 *
 * @param {Object} record - { case_id, frame_1, frame_2, delta_e, matched_result, gps_lat, gps_lng, server_timestamp, sha256_hash }
 * @returns {Promise<Object>}
 */
function insertEvidenceRecord(record) {
  // TODO: Insert strictly append-only record into evidence_records table
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO evidence_records (
        case_id, frame_1, frame_2, delta_e, matched_result,
        gps_lat, gps_lng, server_timestamp, sha256_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      record.case_id,
      record.frame_1,
      record.frame_2,
      record.delta_e,
      record.matched_result,
      record.gps_lat,
      record.gps_lng,
      record.server_timestamp,
      record.sha256_hash
    ];

    if (dbDriver === 'better-sqlite3' || dbDriver === 'node-sqlite') {
      try {
        const stmt = db.prepare(sql);
        stmt.run(...params);
        resolve(record);
      } catch (err) {
        reject(err);
      }
    } else {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(record);
      });
    }
  });
}

/**
 * Retrieves all evidence records ordered by server_timestamp DESC.
 * (Omits massive Base64 frame payloads for fast vault rendering).
 *
 * @returns {Promise<Array<Object>>}
 */
function getAllEvidenceRecords() {
  // TODO: Query list of evidence records without full base64 frames for performance
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT case_id, delta_e, matched_result, gps_lat, gps_lng, server_timestamp, sha256_hash
      FROM evidence_records
      ORDER BY server_timestamp DESC
    `;

    if (dbDriver === 'better-sqlite3' || dbDriver === 'node-sqlite') {
      try {
        const rows = db.prepare(sql).all();
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    } else {
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }
  });
}

/**
 * Retrieves a single complete evidence record by case_id (includes frame_1 and frame_2 for hashing).
 *
 * @param {string} case_id
 * @returns {Promise<Object|null>}
 */
function getEvidenceRecordById(case_id) {
  // TODO: Retrieve full row by case_id for cryptographic integrity verification
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM evidence_records WHERE case_id = ?`;

    if (dbDriver === 'better-sqlite3' || dbDriver === 'node-sqlite') {
      try {
        const row = db.prepare(sql).get(case_id);
        resolve(row || null);
      } catch (err) {
        reject(err);
      }
    } else {
      db.get(sql, [case_id], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    }
  });
}

module.exports = {
  initDatabase,
  insertEvidenceRecord,
  getAllEvidenceRecords,
  getEvidenceRecordById
};
