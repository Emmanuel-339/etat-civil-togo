// ============================================
// database.js
// Base de données avec sql.js
// ============================================

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'naissances.db');

let db;

async function initialiserDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ Base de données chargée (naissances.db)');
  } else {
    db = new SQL.Database();
    console.log('✅ Nouvelle base de données créée (naissances.db)');
  }

  // Table utilisateurs AVEC colonne role
  db.run(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      telephone TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mot_de_passe TEXT NOT NULL,
      role TEXT DEFAULT 'parent',
      date_creation TEXT DEFAULT (datetime('now'))
    )
  `);

  // Table naissances
  db.run(`
    CREATE TABLE IF NOT EXISTS naissances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      utilisateur_id INTEGER,
      enfant_nom TEXT NOT NULL,
      enfant_prenom TEXT NOT NULL,
      enfant_sexe TEXT NOT NULL,
      date_naissance TEXT NOT NULL,
      heure_naissance TEXT,
      lieu_naissance TEXT NOT NULL,
      pays_naissance TEXT NOT NULL,
      type_etablissement TEXT,
      poids_naissance REAL,
      pere_nom TEXT NOT NULL,
      pere_prenom TEXT NOT NULL,
      pere_date_naissance TEXT,
      pere_nationalite TEXT,
      pere_profession TEXT,
      pere_telephone TEXT NOT NULL,
      pere_email TEXT,
      pere_adresse TEXT,
      mere_nom TEXT NOT NULL,
      mere_prenom TEXT NOT NULL,
      mere_date_naissance TEXT,
      mere_nationalite TEXT,
      mere_profession TEXT,
      mere_telephone TEXT NOT NULL,
      mere_email TEXT,
      mere_adresse TEXT,
      declarant TEXT,
      observations TEXT,
      statut TEXT DEFAULT 'En cours',
      date_creation TEXT DEFAULT (datetime('now'))
    )
  `);

  sauvegarder();
  return db;
}

function sauvegarder() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDB() {
  return db;
}

module.exports = { initialiserDB, sauvegarder, getDB };
