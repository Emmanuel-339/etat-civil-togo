const PDFDocument = require('pdfkit');

function genererActeNaissance(declaration) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 595;
      const bleu = '#0D1B2A';
      const or = '#C9A84C';
      const gris = '#444444';

      // ── EN-TÊTE ──
      doc.rect(0, 0, W, 85).fill(bleu);

      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
         .text('RÉPUBLIQUE DU TOGO', 0, 12, { align: 'center' });
      doc.fillColor(or).font('Helvetica').fontSize(7)
         .text('Travail • Liberté • Patrie', 0, 25, { align: 'center' });
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15)
         .text('ÉTAT CIVIL NUMÉRIQUE', 0, 40, { align: 'center' });
      doc.fillColor(or).font('Helvetica').fontSize(8)
         .text('Direction Générale de l\'État Civil', 0, 60, { align: 'center' });
      doc.fillColor('#AAAAAA').font('Helvetica').fontSize(7)
         .text(`Réf : ${declaration.reference}`, 0, 73, { align: 'center' });

      // ── TITRE ──
      doc.moveTo(40, 95).lineTo(W - 40, 95).strokeColor(or).lineWidth(1.5).stroke();
      doc.fillColor(bleu).font('Helvetica-Bold').fontSize(14)
         .text('ACTE DE NAISSANCE', 0, 100, { align: 'center' });
      doc.moveTo(40, 118).lineTo(W - 40, 118).strokeColor(or).lineWidth(1.5).stroke();

      let y = 128;
      const col1 = 45;
      const col2 = 195;
      const rowH = 17;
      const tableW = W - 90;

      function sectionTitle(titre) {
        doc.rect(40, y, tableW, 18).fill(bleu);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
           .text(titre, 40, y + 5, { width: tableW, align: 'center' });
        y += 20;
      }

      function ligne(label, valeur, pair) {
        doc.rect(40, y, tableW, rowH).fill(pair ? '#F5F0E8' : '#FFFFFF');
        doc.fillColor(bleu).font('Helvetica-Bold').fontSize(8)
           .text(label + ' :', col1, y + 4, { width: 145 });
        doc.fillColor(gris).font('Helvetica').fontSize(8)
           .text(String(valeur || '—'), col2, y + 4, { width: tableW - 155 });
        y += rowH;
      }

      function formatDate(d) {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
        catch { return d; }
      }

      // ── ENFANT ──
      sectionTitle('INFORMATIONS SUR L\'ENFANT');
      ligne('Nom', declaration.enfant_nom, true);
      ligne('Prénom(s)', declaration.enfant_prenom, false);
      ligne('Sexe', declaration.enfant_sexe === 'M' ? 'Masculin' : 'Féminin', true);
      ligne('Date de naissance', formatDate(declaration.date_naissance), false);
      ligne('Heure de naissance', declaration.heure_naissance || '—', true);
      ligne('Lieu de naissance', declaration.lieu_naissance, false);
      ligne('Pays de naissance', declaration.pays_naissance, true);

      y += 6;

      // ── PÈRE ──
      sectionTitle('INFORMATIONS SUR LE PÈRE');
      ligne('Nom', declaration.pere_nom, true);
      ligne('Prénom(s)', declaration.pere_prenom, false);
      ligne('Nationalité', declaration.pere_nationalite || '—', true);
      ligne('Profession', declaration.pere_profession || '—', false);
      ligne('Téléphone', declaration.pere_telephone, true);
      ligne('Adresse', declaration.pere_adresse || '—', false);

      y += 6;

      // ── MÈRE ──
      sectionTitle('INFORMATIONS SUR LA MÈRE');
      ligne('Nom de naissance', declaration.mere_nom, true);
      ligne('Prénom(s)', declaration.mere_prenom, false);
      ligne('Nationalité', declaration.mere_nationalite || '—', true);
      ligne('Profession', declaration.mere_profession || '—', false);
      ligne('Téléphone', declaration.mere_telephone, true);
      ligne('Adresse', declaration.mere_adresse || '—', false);

      y += 6;

      // ── DÉCLARATION ──
      sectionTitle('DÉCLARATION');
      ligne('Déclarant', declaration.declarant || '—', true);
      ligne('Date de déclaration', formatDate(declaration.date_creation), false);
      ligne('Statut', declaration.statut || 'En cours', true);

      y += 12;

      // ── SIGNATURES ──
      doc.moveTo(40, y).lineTo(W - 40, y).strokeColor(or).lineWidth(1).stroke();
      y += 8;

      doc.fillColor(gris).font('Helvetica').fontSize(7)
         .text('Signatures et cachets officiels', 40, y, { width: tableW, align: 'center' });
      y += 12;

      const sigW = (tableW - 30) / 3;
      const sigH = 50;

      // 3 zones de signature
      const sigLabels = ['Signature du déclarant', 'Signature de l\'agent', 'Cachet officiel'];
      sigLabels.forEach((label, i) => {
        const sx = 40 + i * (sigW + 15);
        doc.rect(sx, y, sigW, sigH).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
        doc.fillColor(gris).font('Helvetica').fontSize(7)
           .text(label, sx, y + sigH - 13, { width: sigW, align: 'center' });
      });

      y += sigH + 12;

      // ── PIED DE PAGE ──
      doc.rect(0, 792, W, 50).fill(bleu);
      doc.fillColor(or).font('Helvetica-Bold').fontSize(7)
         .text('ÉTAT CIVIL NUMÉRIQUE — RÉPUBLIQUE DU TOGO', 0, 800, { align: 'center' });
      doc.fillColor('#888888').font('Helvetica').fontSize(6)
         .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} | Réf: ${declaration.reference} | Document officiel protégé par la loi`, 0, 813, { align: 'center' });

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { genererActeNaissance };
