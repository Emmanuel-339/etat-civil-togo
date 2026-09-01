// ============================================
// server.js
// Serveur principal - État Civil Numérique
// ============================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initialiserDB, sauvegarder, getDB } = require('./database');
const { genererActeNaissance } = require('./pdf');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'etat_civil_togo_secret_2026';

// ── Middlewares ──
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));

// ── Vérifier le token JWT ──
function verifierToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ erreur: 'Token manquant. Veuillez vous connecter.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.utilisateur = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ erreur: 'Session expirée. Veuillez vous reconnecter.' });
  }
}

// ── Générer un numéro de référence unique ──
function genererReference() {
  const annee = new Date().getFullYear();
  const numero = Math.floor(100000 + Math.random() * 900000);
  return `TG-${annee}-${numero}`;
}

// ============================================
// ROUTE : Inscription
// POST /api/auth/inscription
// ============================================
app.post('/api/auth/inscription', async (req, res) => {
  try {
    const { nom, prenom, telephone, email, mot_de_passe } = req.body;
    const db = getDB();

    if (!nom || !prenom || !telephone || !email || !mot_de_passe) {
      return res.status(400).json({ erreur: 'Tous les champs sont obligatoires.' });
    }

    if (mot_de_passe.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const existant = db.exec(`SELECT id FROM utilisateurs WHERE email = '${email}'`);
    if (existant.length > 0 && existant[0].values.length > 0) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    const motDePasseHache = await bcrypt.hash(mot_de_passe, 10);

    db.run(
      `INSERT INTO utilisateurs (nom, prenom, telephone, email, mot_de_passe) VALUES (?, ?, ?, ?, ?)`,
      [nom, prenom, telephone, email, motDePasseHache]
    );

    sauvegarder();

    const result = db.exec(`SELECT id FROM utilisateurs WHERE email = '${email}'`);
    const id = result[0].values[0][0];

    res.status(201).json({ message: 'Compte créé avec succès !', utilisateur_id: id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur lors de l\'inscription.' });
  }
});

// ============================================
// ROUTE : Inscription Agent
// POST /api/auth/inscription-agent
// ============================================
app.post('/api/auth/inscription-agent', async (req, res) => {
  try {
    const { nom, prenom, telephone, email, mot_de_passe, code_agent } = req.body;
    const db = getDB();

    if (code_agent !== 'AGENT2026') {
      return res.status(403).json({ erreur: 'Code agent invalide.' });
    }

    if (!nom || !prenom || !telephone || !email || !mot_de_passe) {
      return res.status(400).json({ erreur: 'Tous les champs sont obligatoires.' });
    }

    const existant = db.exec(`SELECT id FROM utilisateurs WHERE email = '${email}'`);
    if (existant.length > 0 && existant[0].values.length > 0) {
      return res.status(409).json({ erreur: 'Email déjà utilisé.' });
    }

    const motDePasseHache = await bcrypt.hash(mot_de_passe, 10);

    db.run(
      `INSERT INTO utilisateurs (nom, prenom, telephone, email, mot_de_passe, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [nom, prenom, telephone, email, motDePasseHache, 'agent']
    );

    sauvegarder();

    res.status(201).json({ message: 'Compte agent créé avec succès !' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// ============================================
// ROUTE : Connexion
// POST /api/auth/connexion
// ============================================
app.post('/api/auth/connexion', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    const db = getDB();

    if (!email || !mot_de_passe) {
      return res.status(400).json({ erreur: 'Email et mot de passe requis.' });
    }

    const result = db.exec(`SELECT * FROM utilisateurs WHERE email = '${email}'`);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    const cols = result[0].columns;
    const vals = result[0].values[0];
    const utilisateur = {};
    cols.forEach((col, i) => utilisateur[col] = vals[i]);

    const motDePasseValide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
    if (!motDePasseValide) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, nom: utilisateur.nom, prenom: utilisateur.prenom, role: utilisateur.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Connexion réussie !',
      token,
      utilisateur: { id: utilisateur.id, nom: utilisateur.nom, prenom: utilisateur.prenom, email: utilisateur.email, role: utilisateur.role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur lors de la connexion.' });
  }
});

// ============================================
// ROUTE : Créer une déclaration de naissance
// POST /api/naissances
// ============================================
app.post('/api/naissances', verifierToken, (req, res) => {
  try {
    const data = req.body;
    const db = getDB();

    const champsObligatoires = [
      'enfant_nom', 'enfant_prenom', 'enfant_sexe',
      'date_naissance', 'lieu_naissance', 'pays_naissance',
      'pere_nom', 'pere_prenom', 'pere_telephone',
      'mere_nom', 'mere_prenom', 'mere_telephone'
    ];

    for (const champ of champsObligatoires) {
      if (!data[champ] || String(data[champ]).trim() === '') {
        return res.status(400).json({ erreur: `Le champ "${champ}" est obligatoire.` });
      }
    }

    let reference = genererReference();

    db.run(`
      INSERT INTO naissances (
        reference, utilisateur_id,
        enfant_nom, enfant_prenom, enfant_sexe, date_naissance, heure_naissance,
        lieu_naissance, pays_naissance, type_etablissement, poids_naissance,
        pere_nom, pere_prenom, pere_date_naissance, pere_nationalite, pere_profession,
        pere_telephone, pere_email, pere_adresse,
        mere_nom, mere_prenom, mere_date_naissance, mere_nationalite, mere_profession,
        mere_telephone, mere_email, mere_adresse,
        declarant, observations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reference, req.utilisateur.id,
      data.enfant_nom, data.enfant_prenom, data.enfant_sexe, data.date_naissance, data.heure_naissance || null,
      data.lieu_naissance, data.pays_naissance, data.type_etablissement || null, data.poids_naissance || null,
      data.pere_nom, data.pere_prenom, data.pere_date_naissance || null, data.pere_nationalite || null, data.pere_profession || null,
      data.pere_telephone, data.pere_email || null, data.pere_adresse || null,
      data.mere_nom, data.mere_prenom, data.mere_date_naissance || null, data.mere_nationalite || null, data.mere_profession || null,
      data.mere_telephone, data.mere_email || null, data.mere_adresse || null,
      data.declarant || null, data.observations || null
    ]);

    sauvegarder();

    res.status(201).json({
      message: 'Déclaration enregistrée avec succès !',
      reference: reference
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur lors de l\'enregistrement.' });
  }
});

// ============================================
// ROUTE : Récupérer les déclarations
// GET /api/naissances
// ============================================
app.get('/api/naissances', verifierToken, (req, res) => {
  try {
    const db = getDB();
    const result = db.exec(`
      SELECT id, reference, enfant_nom, enfant_prenom, enfant_sexe,
             date_naissance, lieu_naissance, statut, date_creation
      FROM naissances WHERE utilisateur_id = ${req.utilisateur.id}
      ORDER BY date_creation DESC
    `);

    if (result.length === 0) return res.json([]);

    const cols = result[0].columns;
    const declarations = result[0].values.map(vals => {
      const obj = {};
      cols.forEach((col, i) => obj[col] = vals[i]);
      return obj;
    });

    res.json(declarations);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// ============================================
// ROUTE : Détail d'une déclaration
// GET /api/naissances/:reference
// ============================================
app.get('/api/naissances/:reference', verifierToken, (req, res) => {
  try {
    const db = getDB();
    const result = db.exec(`
      SELECT * FROM naissances
      WHERE reference = '${req.params.reference}'
      AND utilisateur_id = ${req.utilisateur.id}
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ erreur: 'Déclaration non trouvée.' });
    }

    const cols = result[0].columns;
    const vals = result[0].values[0];
    const declaration = {};
    cols.forEach((col, i) => declaration[col] = vals[i]);

    res.json(declaration);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// ============================================
// ROUTE : Télécharger le PDF
// GET /api/naissances/:reference/pdf
// ============================================
app.get('/api/naissances/:reference/pdf', verifierToken, async (req, res) => {
  try {
    const db = getDB();
    const result = db.exec(`
      SELECT * FROM naissances WHERE reference = '${req.params.reference}'
      AND utilisateur_id = ${req.utilisateur.id}
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ erreur: 'Déclaration non trouvée.' });
    }

    const cols = result[0].columns;
    const vals = result[0].values[0];
    const declaration = {};
    cols.forEach((col, i) => declaration[col] = vals[i]);

    const pdfBuffer = await genererActeNaissance(declaration);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="acte-naissance-${declaration.reference}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la génération du PDF.' });
  }
});

// ============================================
// ROUTE : Suivi public
// GET /api/suivi/:reference
// ============================================
app.get('/api/suivi/:reference', (req, res) => {
  try {
    const db = getDB();
    const result = db.exec(`
      SELECT reference, enfant_nom, enfant_prenom, statut, date_creation
      FROM naissances WHERE reference = '${req.params.reference}'
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ erreur: 'Aucune déclaration trouvée avec ce numéro.' });
    }

    const cols = result[0].columns;
    const vals = result[0].values[0];
    const declaration = {};
    cols.forEach((col, i) => declaration[col] = vals[i]);

    res.json(declaration);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// ============================================
// ROUTE : Toutes les déclarations (agent)
// GET /api/agent/naissances
// ============================================
app.get('/api/agent/naissances', verifierToken, (req, res) => {
  try {
    if (req.utilisateur.role !== 'agent') {
      return res.status(403).json({ erreur: 'Accès réservé aux agents.' });
    }

    const db = getDB();
    const result = db.exec(`
      SELECT n.id, n.reference, n.enfant_nom, n.enfant_prenom, n.enfant_sexe,
             n.date_naissance, n.lieu_naissance, n.statut, n.date_creation,
             u.nom as declarant_nom, u.prenom as declarant_prenom
      FROM naissances n
      LEFT JOIN utilisateurs u ON n.utilisateur_id = u.id
      ORDER BY n.date_creation DESC
    `);

    if (result.length === 0) return res.json([]);

    const cols = result[0].columns;
    const declarations = result[0].values.map(vals => {
      const obj = {};
      cols.forEach((col, i) => obj[col] = vals[i]);
      return obj;
    });

    res.json(declarations);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// ============================================
// ROUTE : Changer le statut (agent)
// PUT /api/agent/naissances/:reference/statut
// ============================================
app.put('/api/agent/naissances/:reference/statut', verifierToken, async (req, res) => {
  try {
    if (req.utilisateur.role !== 'agent') {
      return res.status(403).json({ erreur: 'Accès réservé aux agents.' });
    }

    const { statut } = req.body;
    if (!['En cours', 'Validé', 'Rejeté'].includes(statut)) {
      return res.status(400).json({ erreur: 'Statut invalide.' });
    }

    const db = getDB();
    db.run(`UPDATE naissances SET statut = ? WHERE reference = ?`, [statut, req.params.reference]);
    sauvegarder();

    res.json({ message: `Statut mis à jour : ${statut}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// ── Route de test ──
app.get('/', (req, res) => {
  res.json({ message: '✅ API État Civil Numérique en ligne !', version: '1.0.0' });
});

// ── Démarrage du serveur ──
initialiserDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  });
});
