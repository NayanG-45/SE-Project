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
 * HARD PROHIBITIONS (README.md Section 3):
 * - NO mutating SQL statements (UPDATE, DELETE).
 * - Read and Insert operations only.
 * - Append-only relational store providing O(1) tamper detection.
 */

const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'narcotest.db');

let db = null;
let dbDriver = null; // 'better-sqlite3' | 'node-sqlite' | 'sqlite3'

/**
 * Initializes the SQLite database connection.
 * Priority order:
 *  1. better-sqlite3 (synchronous, preferred)
 *  2. node:sqlite DatabaseSync (Node 22/24 native synchronous SQLite)
 *  3. sqlite3 (asynchronous callback fallback)
 */
function initDatabase(customPath) {
  const targetPath = customPath || DB_PATH;

  // Strategy 1: better-sqlite3 (preferred per README.md)
  try {
    const Database = require('better-sqlite3');
    db = new Database(targetPath);
    dbDriver = 'better-sqlite3';
    db.pragma('journal_mode = WAL');
    console.log('[DB] Connected via better-sqlite3:', targetPath);
    createSchema();
    return db;
  } catch (err) {
    // Strategy 2: node:sqlite DatabaseSync (Node 22/24 native synchronous SQLite, identical method signatures)
    try {
      const { DatabaseSync } = require('node:sqlite');
      db = new DatabaseSync(targetPath);
      dbDriver = 'node-sqlite';
      db.exec('PRAGMA journal_mode = WAL;');
      console.log('[DB] Connected via native node:sqlite (synchronous):', targetPath);
      createSchema();
      return db;
    } catch (err2) {
      // Strategy 3: sqlite3 (callback fallback)
      try {
        const sqlite3 = require('sqlite3').verbose();
        db = new sqlite3.Database(targetPath);
        dbDriver = 'sqlite3';
        console.log('[DB] Connected via sqlite3 fallback:', targetPath);
        createSchema();
        return db;
      } catch (err3) {
        console.error('[DB] All SQLite drivers failed to initialize:', err3.message);
        throw err3;
      }
    }
  }
}

/**
 * Creates the immutable evidence_records table if it does not already exist.
 * Conforms strictly to README.md Section 9 schema.
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
    db.exec(schemaSql);
  } else if (dbDriver === 'sqlite3') {
    db.run(schemaSql, (err) => {
      if (err) console.error('[DB] Schema initialization failed:', err);
    });
  }
}

/**
 * Inserts a new immutable evidence record.
 * Append-only: INSERT statement only, no UPDATE or DELETE.
 *
 * @param {Object} record - Complete validated evidence record
 * @returns {Promise<Object>} The inserted record
 */
function insertEvidenceRecord(record) {
  if (!db) initDatabase();

  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO evidence_records (
        case_id, frame_1, frame_2, delta_e, matched_result,
        gps_lat, gps_lng, server_timestamp, sha256_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      String(record.case_id),
      String(record.frame_1),
      String(record.frame_2),
      Number(record.delta_e),
      String(record.matched_result),
      Number(record.gps_lat),
      Number(record.gps_lng),
      String(record.server_timestamp),
      String(record.sha256_hash)
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
 * Omits heavy Base64 frames (frame_1, frame_2) for fast summary display.
 *
 * @returns {Promise<Array<Object>>} List of evidence summaries
 */
function getAllEvidenceRecords() {
  if (!db) initDatabase();

  return new Promise((resolve, reject) => {
    const sql = `
      SELECT case_id, delta_e, matched_result, gps_lat, gps_lng, server_timestamp, sha256_hash
      FROM evidence_records
      ORDER BY server_timestamp DESC
    `;

    if (dbDriver === 'better-sqlite3' || dbDriver === 'node-sqlite') {
      try {
        const rows = db.prepare(sql).all();
        // Convert null-prototype objects to plain JS objects
        const cleanRows = rows.map(r => ({ ...r }));
        resolve(cleanRows);
      } catch (err) {
        reject(err);
      }
    } else {
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    }
  });
}

/**
 * Retrieves a single complete evidence record by case_id.
 * Includes frame_1 and frame_2 for byte-for-byte SHA-256 hash recomputation.
 *
 * @param {string} case_id
 * @returns {Promise<Object|null>} Full record or null if not found
 */
function getEvidenceRecordById(case_id) {
  if (!db) initDatabase();

  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM evidence_records WHERE case_id = ?`;

    if (dbDriver === 'better-sqlite3' || dbDriver === 'node-sqlite') {
      try {
        const row = db.prepare(sql).get(case_id);
        resolve(row ? { ...row } : null);
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
  getEvidenceRecordById,
  DB_PATH
};
