// ═══════════════════════════════════════════════════════════════════
//  ManiPay — Mock API (mode démo, sans backend)
//  Intercepte tous les appels réseau vers l'API ManiPay et simule le
//  backend en mémoire/localStorage, avec les mêmes règles métier que
//  le backend réel (frais, commissions, RBAC, codes d'erreur...).
//
//  Ce fichier doit être chargé AVANT le script applicatif de chaque
//  page (il patche window.fetch dès son exécution).
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var DB_KEY = 'manipay_mock_db_v2';
  var ORIG_FETCH = window.fetch.bind(window);

  // ───────────────────────── Utilitaires ─────────────────────────────
  function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function nowIso() { return new Date().toISOString(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function round(n) { return Math.round(n); }
  function genRef(prefix) {
    var ts = Date.now().toString(36).toUpperCase();
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return prefix + '-' + ts + rand;
  }

  // ───────────────────── Règles métier (fidèles au backend) ──────────
  var TAUX = {
    DEPOT_AGENT: 0.002,
    RETRAIT_T1: 0.009,
    RETRAIT_T2: 0.008,
    RETRAIT_T3: 0.007,
    SEUIL1: 100000,
    SEUIL2: 500000,
    COMMISSION_AGENT_RETRAIT: 0.35,
    PARRAINAGE: 0.10,
    PAIEMENT_MARCHAND: 0.008,
  };
  function getTauxRetrait(montant) {
    if (montant <= TAUX.SEUIL1) return TAUX.RETRAIT_T1;
    if (montant <= TAUX.SEUIL2) return TAUX.RETRAIT_T2;
    return TAUX.RETRAIT_T3;
  }
  function calculerFrais(type, montant) {
    switch (type) {
      case 'retrait': return round(montant * getTauxRetrait(montant));
      case 'paiement_marchand': return round(montant * TAUX.PAIEMENT_MARCHAND);
      default: return 0;
    }
  }
  function calculerCommissionAgent(type, montant) {
    if (type === 'depot') return round(montant * TAUX.DEPOT_AGENT);
    if (type === 'retrait') return round(calculerFrais('retrait', montant) * TAUX.COMMISSION_AGENT_RETRAIT);
    return 0;
  }
  var TYPES_VISIBLES = {
    client: ['transfert', 'paiement_marchand', 'commission', 'bonus_reseau', 'tontine_versement', 'tontine_reception', 'tontine_caution_paiement', 'virement_gains'],
    agent: ['depot', 'retrait', 'transfert', 'commission', 'virement_gains'],
    business: ['paiement_marchand', 'commission'],
    mini_master: ['depot', 'retrait', 'transfert', 'commission', 'bonus_reseau', 'virement_gains'],
    master: ['depot', 'retrait', 'transfert', 'commission', 'bonus_reseau', 'virement_gains'],
    superviseur: null,
    admin: null,
  };
  var PLAFONDS_KYC = { KYC1: 20000, KYC2: 50000, KYC3: 100000 };
  function getPlafondParrainage(role, kycNiveau) {
    if (role !== 'client') return 500000;
    return PLAFONDS_KYC[kycNiveau] || 0;
  }
  // Paliers Tontine — chaque montant est unique tous cadences confondues
  // (le front n'envoie que le montant à l'inscription, pas la catégorie).
  var TONTINE_PALIERS = [
    { categorie: 'hebdo', montant: 5000, versementParTour: 5250, commission: 250, gainParTour: 25000 },
    { categorie: 'hebdo', montant: 10000, versementParTour: 10500, commission: 500, gainParTour: 50000 },
    { categorie: 'bihebdo', montant: 15000, versementParTour: 15750, commission: 750, gainParTour: 75000 },
    { categorie: 'mensuel', montant: 25000, versementParTour: 26250, commission: 1250, gainParTour: 125000 },
    { categorie: 'mensuel', montant: 50000, versementParTour: 52500, commission: 2500, gainParTour: 250000 },
  ];
  function findPalierByMontant(m) { return TONTINE_PALIERS.find(function (p) { return p.montant === Number(m); }); }
  var TONTINE_CADENCE_JOURS = { hebdo: 7, bihebdo: 14, mensuel: 30 };

  // ───────────────────────── Semences (seed) ─────────────────────────
  function buildSeed() {
    var users = [
      mkUser('u_admin', '+2250700000001', 'Admin', 'AFRIM', 'admin', 'agent_valide', 'ADM-0001', null, null),
      mkUser('u_sup', '+2250700000002', 'Superviseur', 'Koné', 'superviseur', 'agent_valide', 'SUP-0001', null, null),
      mkUser('u_master', '+2250700000010', 'Ouédraogo', 'Karim', 'master', 'agent_valide', 'MST-0001', 'u_admin', null),
      mkUser('u_mm', '+2250700000020', 'Coulibaly', 'Jean', 'mini_master', 'agent_valide', 'MM-N001', 'u_master', 'Nord Abidjan'),
      mkUser('u_agent1', '+2250700000030', 'Coulibaly', 'Seydou', 'agent', 'agent_valide', 'AGT-ABJ-01', 'u_mm', 'Abobo Centre'),
      mkUser('u_agent2', '+2250700000031', 'Diallo', 'Seydou', 'agent', 'agent_valide', 'AGT-ABJ-02', 'u_mm', 'Abobo Marché'),
      mkUser('u_agent3', '+2250700000032', 'Ouattara', 'Salif', 'agent', 'agent_valide', 'AGT-ABJ-03', 'u_mm', 'Yopougon'),
      mkUser('u_client1', '+2250705001001', 'Koné', 'Aminata', 'client', 'KYC2', 'AMKO-1001', 'u_agent1', null),
      mkUser('u_client2', '+2250705001002', 'Koffi', 'Jean', 'client', 'KYC1', 'JEKO-1002', 'u_agent1', null),
      mkUser('u_client3', '+2250705001003', 'Traoré', 'Adja', 'client', 'KYC2', 'ADTR-1003', 'u_agent2', null),
      mkUser('u_client4', '+2250705001004', 'Bamba', 'Salif', 'client', 'KYC3', 'SABA-1004', 'u_agent1', null),
      mkUser('u_client5', '+2250705001005', 'Diallo', 'Ibrahim', 'client', 'KYC1', 'IBDI-1005', 'u_agent3', null),
      mkUser('u_biz1', '+2250706001001', 'Koné Salif', 'Réseau Supermarchés SA', 'business', 'business', 'MRC-1001', 'u_agent1', null),
      mkUser('u_biz2', '+2250706001002', 'Pharmacie Djè', 'Pharmacie du Centre', 'business', 'business', 'MRC-2045', 'u_agent1', null),
      // Participants supplémentaires (démo Tontine) — complètent un groupe déjà actif
      mkUser('u_tf1', '+2250709990001', 'Ouattara', 'Yaya', 'client', 'KYC3', 'YAOU-9001', 'u_agent2', null),
      mkUser('u_tf2', '+2250709990002', 'Cissé', 'Mariam', 'client', 'KYC3', 'MACI-9002', 'u_agent2', null),
      mkUser('u_tf3', '+2250709990003', 'Bamba', 'Fatou', 'client', 'KYC3', 'FABA-9003', 'u_agent3', null),
      mkUser('u_tf4', '+2250709990004', 'Koné', 'Ibrahim', 'client', 'KYC3', 'IBKO-9004', 'u_agent3', null),
    ];
    // Client 1 relevé en KYC3 (au lieu de KYC2 dans le seed backend original) pour
    // pouvoir montrer d'emblée l'écran "en attente de cautions" en mode démo.
    users.find(function (u) { return u.id === 'u_client1'; }).kycNiveau = 'KYC3';

    var soldes = {
      u_admin: 0, u_sup: 0, u_master: 10000000, u_mm: 5000000,
      u_agent1: 2500000, u_agent2: 2000000, u_agent3: 1800000,
      u_client1: 345750, u_client2: 125000, u_client3: 78500, u_client4: 512000, u_client5: 25000,
      u_biz1: 1284500, u_biz2: 380000,
    };
    var plafonds = {
      u_admin: 9999999, u_sup: 500000, u_master: 2000000, u_mm: 1000000,
      u_agent1: 500000, u_agent2: 500000, u_agent3: 500000,
      u_client1: 50000, u_client2: 20000, u_client3: 50000, u_client4: 100000, u_client5: 20000,
      u_biz1: 500000, u_biz2: 500000,
    };

    var comptes = users.map(function (u) {
      return {
        id: 'c_' + u.id, utilisateurId: u.id, typeCompte: u.role,
        solde: soldes[u.id] || 0, soldeGel: 0,
        plafondMensuel: plafonds[u.id] || 0, gainsMoisCourant: 0,
        statut: 'actif', dateOuverture: nowIso(), updatedAt: nowIso(),
      };
    });

    var transactions = [
      {
        id: 't_seed1', reference: 'DEP-SEED001', type: 'depot', statut: 'complete', initiateurRole: 'agent',
        compteSourceId: 'c_u_agent1', compteDestId: 'c_u_client1', montant: 100000, frais: 0,
        agentId: 'u_agent1', description: null,
        dateCreation: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        dateCompletion: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 't_seed2', reference: 'TRF-SEED001', type: 'transfert', statut: 'complete', initiateurRole: 'client',
        compteSourceId: 'c_u_client1', compteDestId: 'c_u_agent1', montant: 20000, frais: 0,
        agentId: null, description: null,
        dateCreation: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        dateCompletion: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      },
    ];

    // ── Semence Tontine (démo enrichie) ────────────────────────────────
    // Client1 (KYC3, relevé plus haut) : en attente de cautions, avec un
    // mix réaliste de statuts (accepté/en attente/refusé) pour montrer
    // l'écran de suivi des invitations dès la connexion.
    var pC1 = { id: 'tp_client1', utilisateurId: 'u_client1', statut: 'attente_cautions', montant: 10000, categorie: 'hebdo', position: null, signaturePhysiqueFaite: false, scanUrl: null, groupeId: null };
    var tontineParticipants = [pC1];
    var tontineCautions = [
      { id: 'tc_1', participantId: pC1.id, ordre: 1, garantNom: 'Seydou Diallo', garantTelephone: '+2250700000031', statut: 'accepte', signaturePhysiqueFaite: false, dateInvitation: nowIso(), dateSignature: nowIso() },
      { id: 'tc_2', participantId: pC1.id, ordre: 2, garantNom: 'Jean Koffi', garantTelephone: '+2250705001002', statut: 'invite', signaturePhysiqueFaite: false, dateInvitation: nowIso(), dateSignature: null },
      { id: 'tc_3', participantId: pC1.id, ordre: 3, garantNom: 'Adja Traoré', garantTelephone: '+2250705001003', statut: 'refuse', signaturePhysiqueFaite: false, dateInvitation: nowIso(), dateSignature: null },
      { id: 'tc_4', participantId: pC1.id, ordre: 4, garantNom: 'Ibrahim Diallo', garantTelephone: '+2250705001005', statut: 'accepte', signaturePhysiqueFaite: false, dateInvitation: nowIso(), dateSignature: nowIso() },
    ];

    // Client4 (KYC3) + 4 participants filler : groupe déjà actif (en_cours),
    // tour 3 = client4 bénéficiaire, sa propre cotisation encore à régler
    // (pour montrer le bouton "Payer ma cotisation maintenant").
    var pC4 = { id: 'tp_client4', utilisateurId: 'u_client4', statut: 'inscrit', montant: 25000, categorie: 'mensuel', position: 3, signaturePhysiqueFaite: true, scanUrl: 'logo-principal-512.png', groupeId: 'grp_demo1' };
    var pF1 = { id: 'tp_f1', utilisateurId: 'u_tf1', statut: 'inscrit', montant: 25000, categorie: 'mensuel', position: 1, signaturePhysiqueFaite: true, scanUrl: 'logo-principal-512.png', groupeId: 'grp_demo1' };
    var pF2 = { id: 'tp_f2', utilisateurId: 'u_tf2', statut: 'inscrit', montant: 25000, categorie: 'mensuel', position: 2, signaturePhysiqueFaite: true, scanUrl: 'logo-principal-512.png', groupeId: 'grp_demo1' };
    var pF3 = { id: 'tp_f3', utilisateurId: 'u_tf3', statut: 'inscrit', montant: 25000, categorie: 'mensuel', position: 4, signaturePhysiqueFaite: true, scanUrl: 'logo-principal-512.png', groupeId: 'grp_demo1' };
    var pF4 = { id: 'tp_f4', utilisateurId: 'u_tf4', statut: 'inscrit', montant: 25000, categorie: 'mensuel', position: 5, signaturePhysiqueFaite: true, scanUrl: 'logo-principal-512.png', groupeId: 'grp_demo1' };
    tontineParticipants.push(pC4, pF1, pF2, pF3, pF4);

    function mkAcceptedCautions(prefix, participantId, noms) {
      return noms.map(function (n, i) {
        return { id: prefix + '_c' + (i + 1), participantId: participantId, ordre: i + 1, garantNom: n.nom, garantTelephone: n.tel, statut: 'accepte', signaturePhysiqueFaite: true, dateInvitation: nowIso(), dateSignature: nowIso() };
      });
    }
    tontineCautions = tontineCautions.concat(
      mkAcceptedCautions('tcc4', pC4.id, [{ nom: 'Yaya Ouattara', tel: '+2250709990001' }, { nom: 'Mariam Cissé', tel: '+2250709990002' }, { nom: 'Fatou Bamba', tel: '+2250709990003' }, { nom: 'Ibrahim Koné', tel: '+2250709990004' }]),
      mkAcceptedCautions('tcf1', pF1.id, [{ nom: 'Seydou Coulibaly', tel: '+2250700000030' }, { nom: 'Seydou Diallo', tel: '+2250700000031' }, { nom: 'Salif Ouattara', tel: '+2250700000032' }, { nom: 'Aminata Koné', tel: '+2250705001001' }]),
      mkAcceptedCautions('tcf2', pF2.id, [{ nom: 'Seydou Coulibaly', tel: '+2250700000030' }, { nom: 'Jean Koffi', tel: '+2250705001002' }, { nom: 'Adja Traoré', tel: '+2250705001003' }, { nom: 'Salif Bamba', tel: '+2250705001004' }]),
      mkAcceptedCautions('tcf3', pF3.id, [{ nom: 'Salif Ouattara', tel: '+2250700000032' }, { nom: 'Ibrahim Diallo', tel: '+2250705001005' }, { nom: 'Seydou Diallo', tel: '+2250700000031' }, { nom: 'Aminata Koné', tel: '+2250705001001' }]),
      mkAcceptedCautions('tcf4', pF4.id, [{ nom: 'Jean Koffi', tel: '+2250705001002' }, { nom: 'Salif Bamba', tel: '+2250705001004' }, { nom: 'Salif Ouattara', tel: '+2250700000032' }, { nom: 'Seydou Coulibaly', tel: '+2250700000030' }])
    );

    var membresDemo1 = [pF1.id, pF2.id, pC4.id, pF3.id, pF4.id];
    var versementsTous = function (statut) { return membresDemo1.map(function (pid) { return { participantId: pid, statut: statut, couleur: statut === 'preleve' ? 'vert' : 'orange', payeParCautionId: null }; }); };
    var grpDemo1 = {
      id: 'grp_demo1', numero: 1, categorie: 'mensuel', montant: 25000, statut: 'en_cours', membres: membresDemo1,
      tours: [
        { id: 'tour_d1_1', numeroTour: 1, participantId: pF1.id, datePrevue: new Date(Date.now() - 60 * 86400000).toISOString(), statut: 'verse', versements: versementsTous('preleve') },
        { id: 'tour_d1_2', numeroTour: 2, participantId: pF2.id, datePrevue: new Date(Date.now() - 30 * 86400000).toISOString(), statut: 'verse', versements: versementsTous('preleve') },
        { id: 'tour_d1_3', numeroTour: 3, participantId: pC4.id, datePrevue: new Date(Date.now() + 5 * 86400000).toISOString(), statut: 'a_venir', versements: [pF1.id, pF2.id, pF3.id, pF4.id].map(function (pid) { return { participantId: pid, statut: 'preleve', couleur: 'vert', payeParCautionId: null }; }).concat([{ participantId: pC4.id, statut: 'a_prelever', couleur: 'orange', payeParCautionId: null }]) },
        { id: 'tour_d1_4', numeroTour: 4, participantId: pF3.id, datePrevue: new Date(Date.now() + 35 * 86400000).toISOString(), statut: 'a_venir', versements: versementsTous('a_prelever') },
        { id: 'tour_d1_5', numeroTour: 5, participantId: pF4.id, datePrevue: new Date(Date.now() + 65 * 86400000).toISOString(), statut: 'a_venir', versements: versementsTous('a_prelever') },
      ],
    };
    var tontineGroupes = [grpDemo1];

    var tontineKycDocs = ['u_client1', 'u_client4'].reduce(function (acc, uid2) {
      acc.push({ id: 'kd_' + uid2 + '_dom', utilisateurId: uid2, typeDocument: 'justificatif_domicile', urlFichier: 'logo-principal-512.png', hashFichier: 'seed', statut: 'approuve', commentaire: null, verifieParId: 'u_sup', dateSoumission: nowIso(), dateVerification: nowIso() });
      acc.push({ id: 'kd_' + uid2 + '_ton', utilisateurId: uid2, typeDocument: 'document_tontine', urlFichier: 'logo-principal-512.png', hashFichier: 'seed', statut: 'approuve', commentaire: null, verifieParId: 'u_sup', dateSoumission: nowIso(), dateVerification: nowIso() });
      return acc;
    }, []);

    var ticketsSeed = [
      { id: 'tk_seed1', reference: 'TKT-SEED001', sujet: 'Transfert non reçu', description: "Le client dit avoir envoyé 20 000 FCFA qui ne sont jamais arrivés.", statut: 'ouvert', service: 'support_client', priorite: 'urgente', clientId: 'u_client2', transactionId: null, dateCreation: new Date(Date.now() - 5 * 3600000).toISOString(), dateResolution: null },
      { id: 'tk_seed2', reference: 'TKT-SEED002', sujet: 'Erreur affichage solde', description: 'Le solde affiché ne se met pas à jour après un dépôt.', statut: 'en_cours', service: 'support_tech', priorite: 'normale', clientId: 'u_client3', transactionId: null, dateCreation: new Date(Date.now() - 26 * 3600000).toISOString(), dateResolution: null },
    ];
    var alertesSeed = [
      { id: 'al_seed1', titre: 'Pic de retraits suspects', description: '5 tentatives de retrait refusées en 10 minutes sur la même zone.', gravite: 'critique', statut: 'ouverte', service: 'support_tech', auteur: 'systeme', created_at: new Date(Date.now() - 3 * 3600000).toISOString(), traite_par: null },
      { id: 'al_seed2', titre: 'Volume mensuel élevé', description: 'Un agent dépasse 90% de son plafond mensuel.', gravite: 'moyenne', statut: 'ouverte', service: 'superviseur', auteur: 'systeme', created_at: new Date(Date.now() - 20 * 3600000).toISOString(), traite_par: null },
    ];

    return {
      users: users, comptes: comptes, transactions: transactions,
      commissions: [], kycDocuments: tontineKycDocs, tickets: ticketsSeed, alertes: alertesSeed, gels: [],
      notifications: [], logsAudit: [], refreshTokens: [],
      tontine: { groupes: tontineGroupes, participants: tontineParticipants, cautions: tontineCautions },
      seq: 1,
    };
  }
  function mkUser(id, tel, nom, prenom, role, kyc, code, parrainId, zone) {
    return {
      id: id, telephone: tel, nom: nom, prenom: prenom, role: role,
      kycNiveau: kyc, kycNiveauDemande: null, statut: 'actif', codeParrainage: code, parrainId: parrainId,
      zone: zone, deviceToken: null, tentativesPin: 0, derniereConnexion: null,
      codeDocuments: null, codeDocAttempts: 0,
      pin: '1234', createdAt: nowIso(), updatedAt: nowIso(), nomCommercial: null,
    };
  }

  // ───────────────────────── Persistance ─────────────────────────────
  var DB = loadDB();
  function loadDB() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    var db = buildSeed();
    saveDB(db);
    return db;
  }
  function saveDB() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) {}
  }

  // ───────────────────── Helpers de recherche ────────────────────────
  function findUser(id) { return DB.users.find(function (u) { return u.id === id; }); }
  function findUserByTel(tel) { return DB.users.find(function (u) { return u.telephone === tel; }); }
  function findCompteByUser(userId) { return DB.comptes.find(function (c) { return c.utilisateurId === userId && c.statut === 'actif'; }); }
  function findCompte(id) { return DB.comptes.find(function (c) { return c.id === id; }); }
  function tontineParticipant(userId) { return DB.tontine.participants.find(function (p) { return p.utilisateurId === userId; }); }
  function tontineParticipantById(id) { return DB.tontine.participants.find(function (p) { return p.id === id; }); }
  function tontineGroupe(id) { return DB.tontine.groupes.find(function (g) { return g.id === id; }); }
  function tontineCautionsOf(participantId) { return DB.tontine.cautions.filter(function (c) { return c.participantId === participantId; }); }
  function docApprouve(userId, type) { return DB.kycDocuments.some(function (d) { return d.utilisateurId === userId && d.typeDocument === type && d.statut === 'approuve'; }); }
  function tontineAssignToGroupe(p) {
    var g = DB.tontine.groupes.find(function (g) { return g.categorie === p.categorie && g.montant === p.montant && g.statut === 'formation' && g.membres.length < 5; });
    if (!g) {
      var num = DB.tontine.groupes.filter(function (x) { return x.categorie === p.categorie; }).length + 1;
      g = { id: uid('grp'), numero: num, categorie: p.categorie, montant: p.montant, statut: 'formation', membres: [], tours: [] };
      DB.tontine.groupes.push(g);
    }
    g.membres.push(p.id); p.groupeId = g.id;
    if (g.membres.length === 5) {
      var ordreTirage = g.membres.slice().sort(function () { return Math.random() - 0.5; });
      ordreTirage.forEach(function (pid, idx) { var pp = tontineParticipantById(pid); if (pp) pp.position = idx + 1; });
      g.statut = 'attente_signatures';
      var cadenceJours = TONTINE_CADENCE_JOURS[p.categorie] || 30;
      g.tours = ordreTirage.map(function (pid, idx) {
        var d = new Date(); d.setDate(d.getDate() + cadenceJours * (idx + 1));
        return {
          id: uid('tour'), numeroTour: idx + 1, participantId: pid, datePrevue: d.toISOString(), statut: 'a_venir',
          versements: g.membres.map(function (mid) { return { participantId: mid, statut: 'a_prelever', couleur: 'orange', payeParCautionId: null }; }),
        };
      });
    }
  }
  function tontineCheckActivation(g) {
    if (!g || g.statut !== 'attente_signatures') return;
    var allDone = g.membres.every(function (pid) {
      var p = tontineParticipantById(pid);
      if (!p || !p.signaturePhysiqueFaite) return false;
      var cs = tontineCautionsOf(pid);
      return cs.length === 4 && cs.every(function (c) { return c.signaturePhysiqueFaite; });
    });
    if (allDone) g.statut = 'en_cours';
    return allDone;
  }
  function tontineAdvanceAfterCautions(participantId) {
    var p = tontineParticipantById(participantId);
    if (!p || p.statut !== 'attente_cautions') return;
    var cauts = tontineCautionsOf(p.id);
    if (cauts.length < 4 || !cauts.every(function (c) { return c.statut === 'accepte'; })) return;
    p.statut = 'inscrit';
    tontineAssignToGroupe(p);
  }
  function userPublic(u, includeComptes) {
    if (!u) return null;
    var out = {
      id: u.id, telephone: u.telephone, nom: u.nom, prenom: u.prenom, role: u.role,
      kycNiveau: u.kycNiveau, kycNiveauDemande: u.kycNiveauDemande || null, statut: u.statut, codeParrainage: u.codeParrainage,
      zone: u.zone, nomCommercial: u.nomCommercial || null,
      derniereConnexion: u.derniereConnexion, createdAt: u.createdAt,
    };
    if (includeComptes) {
      out.comptes = DB.comptes.filter(function (c) { return c.utilisateurId === u.id; })
        .map(function (c) { return { id: c.id, solde: c.solde, typeCompte: c.typeCompte, statut: c.statut, plafondMensuel: c.plafondMensuel, gainsMoisCourant: c.gainsMoisCourant }; });
    }
    return out;
  }
  function txPublic(t) {
    var cs = t.compteSourceId ? findCompte(t.compteSourceId) : null;
    var cd = t.compteDestId ? findCompte(t.compteDestId) : null;
    var us = cs ? findUser(cs.utilisateurId) : null;
    var ud = cd ? findUser(cd.utilisateurId) : null;
    var agent = t.agentId ? findUser(t.agentId) : null;
    var coms = DB.commissions.filter(function (c) { return c.transactionId === t.id; });
    return {
      id: t.id, reference: t.reference, type: t.type, statut: t.statut,
      initiateurRole: t.initiateurRole, montant: t.montant, frais: t.frais,
      description: t.description || null,
      compteSourceId: t.compteSourceId, compteDestId: t.compteDestId,
      compteSource: cs ? { id: cs.id, utilisateur: us ? { nom: us.nom, prenom: us.prenom, telephone: us.telephone } : null } : null,
      compteDest: cd ? { id: cd.id, utilisateur: ud ? { nom: ud.nom, prenom: ud.prenom, telephone: ud.telephone } : null } : null,
      agent: agent ? { nom: agent.nom, prenom: agent.prenom, telephone: agent.telephone } : null,
      commissions: coms,
      dateCreation: t.dateCreation, dateCompletion: t.dateCompletion || null,
    };
  }

  // ───────────────────── Enveloppes de réponse ───────────────────────
  function ok(data, message, status) {
    return { status: status || 200, body: { success: true, message: message || 'Succès', data: data, timestamp: nowIso() } };
  }
  function paginated(data, page, limit, total) {
    return { status: 200, body: { success: true, data: data, meta: { page: page, limit: limit, total: total, totalPages: Math.max(1, Math.ceil(total / limit)) }, timestamp: nowIso() } };
  }
  function fail(status, code, message, details) {
    var body = { success: false, code: code, message: message, timestamp: nowIso() };
    if (details) body.details = details;
    return { status: status, body: body };
  }
  function paginate(list, query) {
    var page = parseInt(query.page || '1', 10) || 1;
    var limit = Math.min(parseInt(query.limit || '20', 10) || 20, 1000);
    var total = list.length;
    var start = (page - 1) * limit;
    return paginated(list.slice(start, start + limit), page, limit, total);
  }

  // ───────────────────────── Authentification ────────────────────────
  function makeTokens(user) {
    var access = 'mock.' + user.id + '.' + Math.random().toString(36).slice(2);
    var refresh = 'mockrefresh.' + user.id + '.' + Math.random().toString(36).slice(2);
    DB.refreshTokens.push({ token: refresh, utilisateurId: user.id, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
    return { accessToken: access, refreshToken: refresh };
  }
  function userFromAuthHeader(headers) {
    var auth = headers && (headers['authorization'] || headers['Authorization']);
    if (!auth) return null;
    var token = String(auth).replace(/^Bearer\s+/i, '');
    var m = /^mock\.([^.]+)\./.exec(token);
    if (!m) return null;
    return findUser(m[1]) || null;
  }

  function handleLogin(body) {
    var user = findUserByTel(body.telephone);
    if (!user) return fail(401, 'AP-AUTH-002', 'Numéro ou PIN incorrect');
    if (user.statut === 'bloque') return fail(403, 'AP-AUTH-003', 'Compte bloqué. Contactez le support AFRIM PAY.');
    if (user.statut === 'en_attente') return fail(403, 'AP-AUTH-007', 'Compte en attente de validation KYC.');
    if (user.tentativesPin >= 5) {
      user.statut = 'bloque'; saveDB();
      return fail(403, 'AP-AUTH-008', 'Compte bloqué après 5 tentatives de PIN incorrectes. Contactez le support.');
    }
    if (String(body.pin) !== String(user.pin)) {
      user.tentativesPin++; saveDB();
      var restantes = 5 - user.tentativesPin;
      return fail(401, 'AP-AUTH-002', 'PIN incorrect. ' + restantes + ' tentative(s) restante(s).');
    }
    user.tentativesPin = 0; user.derniereConnexion = nowIso(); saveDB();
    var tok = makeTokens(user);
    return ok({ accessToken: tok.accessToken, refreshToken: tok.refreshToken, user: userPublic(user, true) }, 'Connexion réussie');
  }
  function handleRefresh(body) {
    var stored = DB.refreshTokens.find(function (r) { return r.token === body.refreshToken; });
    if (!stored) return fail(401, 'AP-AUTH-006', 'Refresh token expiré ou révoqué');
    var user = findUser(stored.utilisateurId);
    if (!user) return fail(401, 'AP-AUTH-005', 'Token invalide');
    DB.refreshTokens = DB.refreshTokens.filter(function (r) { return r !== stored; });
    var tok = makeTokens(user); saveDB();
    return ok({ accessToken: tok.accessToken, refreshToken: tok.refreshToken }, 'Token renouvelé');
  }
  function handleLogout(user, body) {
    if (body && body.refreshToken) DB.refreshTokens = DB.refreshTokens.filter(function (r) { return r.token !== body.refreshToken; });
    saveDB();
    return ok(null, 'Déconnexion réussie');
  }
  function genCodeParrainage(nom, prenom) {
    var base = ((prenom || '').slice(0, 2) + (nom || '').slice(0, 2)).toUpperCase();
    var code;
    do { code = base + '-' + Math.floor(1000 + Math.random() * 9000); }
    while (DB.users.some(function (u) { return u.codeParrainage === code; }));
    return code;
  }
  function handleRegister(currentU, body) {
    if (findUserByTel(body.telephone)) return fail(409, 'AP-USR-001', 'Ce numéro de téléphone est déjà enregistré.');
    var parrainId = currentU.id;
    if (body.parrainCode) {
      var p = DB.users.find(function (u) { return u.codeParrainage === body.parrainCode; });
      if (p) parrainId = p.id;
    }
    var role = body.role || 'client';
    var u = mkUser(uid('u'), body.telephone, body.nom, body.prenom, role,
      body.kycNiveau || 'en_attente', genCodeParrainage(body.nom, body.prenom), parrainId, body.zone || null);
    u.pin = body.pin || '1234';
    u.statut = (role === 'admin' || role === 'superviseur') ? 'actif' : 'en_attente';
    DB.users.push(u);
    var plafond = getPlafondParrainage(role, body.kycNiveau);
    DB.comptes.push({ id: 'c_' + u.id, utilisateurId: u.id, typeCompte: role, solde: 0, soldeGel: 0, plafondMensuel: plafond, gainsMoisCourant: 0, statut: 'actif', dateOuverture: nowIso(), updatedAt: nowIso() });
    saveDB();
    return ok(userPublic(u, false), 'Compte créé avec succès. En attente de validation.', 201);
  }
  function handleChangePin(user, body) {
    if (!body.ancienPin || !body.nouveauPin) return fail(422, 'AP-VAL-001', 'ancienPin et nouveauPin requis');
    if (String(body.ancienPin) !== String(user.pin)) return fail(401, 'AP-AUTH-002', 'Ancien PIN incorrect');
    user.pin = String(body.nouveauPin); saveDB();
    return ok(null, 'PIN modifié. Veuillez vous reconnecter.');
  }

  // ═════════════════════════ Table des routes ════════════════════════
  // Chaque entrée : { method, pattern (RegExp avec groupes nommés via ordre), handler }
  // handler(ctx) -> {status, body}   ctx = {user, params, query, body, path}
  var ROUTES = [];
  function route(method, pattern, handler) { ROUTES.push({ method: method, pattern: pattern, handler: handler }); }
  function AUTH_REQUIRED(handler) {
    return function (ctx) {
      if (!ctx.user) return fail(401, 'AP-AUTH-001', 'Token d\'authentification manquant');
      if (ctx.user.statut === 'bloque') return fail(403, 'AP-AUTH-003', 'Compte bloqué. Contactez le support AFRIM PAY.');
      if (ctx.user.statut === 'gele') return fail(403, 'AP-AUTH-004', 'Compte temporairement gelé.');
      return handler(ctx);
    };
  }
  function ROLES(roles, handler) {
    return function (ctx) {
      if (roles.indexOf(ctx.user.role) === -1) return fail(403, 'AP-RBAC-001', 'Accès refusé. Rôle(s) requis : ' + roles.join(', ') + '. Votre rôle : ' + ctx.user.role);
      return handler(ctx);
    };
  }

  // ── Auth ──
  route('POST', /^\/auth\/login$/, function (ctx) { return handleLogin(ctx.body); });
  route('POST', /^\/auth\/refresh$/, function (ctx) { return handleRefresh(ctx.body); });
  route('POST', /^\/auth\/logout$/, AUTH_REQUIRED(function (ctx) { return handleLogout(ctx.user, ctx.body); }));
  route('POST', /^\/auth\/register$/, AUTH_REQUIRED(ROLES(['agent', 'mini_master', 'master', 'business', 'admin'], function (ctx) { return handleRegister(ctx.user, ctx.body); })));
  route('POST', /^\/auth\/change-pin$/, AUTH_REQUIRED(function (ctx) { return handleChangePin(ctx.user, ctx.body); }));
  // Le frontend appelle en réalité /users/change-pin (pas /auth/change-pin).
  route('POST', /^\/users\/change-pin$/, AUTH_REQUIRED(function (ctx) { return handleChangePin(ctx.user, ctx.body); }));
  // Recouvrement / vérification d'appareil : pas de backend de référence — on accepte
  // systématiquement en mode démo pour ne jamais bloquer l'exploration.
  route('POST', /^\/auth\/login-recovery$/, function (ctx) {
    var user = findUserByTel(ctx.body.telephone);
    if (!user) return fail(404, 'AP-AUTH-002', 'Numéro introuvable');
    var tok = makeTokens(user); saveDB();
    return ok({ accessToken: tok.accessToken, refreshToken: tok.refreshToken, user: userPublic(user, true) }, 'Connexion de secours acceptée (mode démo)');
  });
  route('POST', /^\/auth\/login\/verify-device$/, function (ctx) {
    var user = findUserByTel(ctx.body.telephone) || ctx.user;
    if (!user) return fail(401, 'AP-AUTH-002', 'Utilisateur introuvable');
    var tok = makeTokens(user); saveDB();
    return ok({ accessToken: tok.accessToken, refreshToken: tok.refreshToken, user: userPublic(user, true), verified: true }, 'Appareil vérifié (mode démo)');
  });

  // ── Users ──
  route('GET', /^\/users\/me$/, AUTH_REQUIRED(function (ctx) {
    var u = findUser(ctx.user.id);
    var out = userPublic(u, true);
    var parrain = u.parrainId ? findUser(u.parrainId) : null;
    out.parrain = parrain ? { nom: parrain.nom, prenom: parrain.prenom, telephone: parrain.telephone, codeParrainage: parrain.codeParrainage } : null;
    out._count = { filleuls: DB.users.filter(function (x) { return x.parrainId === u.id; }).length };
    return ok(out);
  }));
  route('PATCH', /^\/users\/me\/nom-commercial$/, AUTH_REQUIRED(function (ctx) {
    var v = ('nomCommercial' in ctx.body) ? ctx.body.nomCommercial : ctx.body.nom;
    ctx.user.nomCommercial = v || null;
    saveDB();
    return ok(userPublic(ctx.user, false), 'Nom commercial mis à jour');
  }));
  // Lookup générique par téléphone (n'importe quel rôle — utilisé aussi pour le
  // scan QR générique à l'accueil agent, malgré son nom).
  route('GET', /^\/users\/lookup-client$/, AUTH_REQUIRED(function (ctx) {
    var u = findUserByTel(ctx.query.telephone);
    if (!u) return fail(404, 'AP-USR-002', 'Client introuvable');
    var c = findCompteByUser(u.id);
    return ok({ id: u.id, nom: u.nom, prenom: u.prenom, telephone: u.telephone, role: u.role, kycNiveau: u.kycNiveau, solde: c ? c.solde : 0 });
  }));
  route('GET', /^\/users\/lookup-pro$/, AUTH_REQUIRED(function (ctx) {
    var u = findUserByTel(ctx.query.telephone);
    if (!u || ['agent', 'mini_master', 'master', 'superviseur'].indexOf(u.role) === -1) return fail(404, 'AP-USR-002', 'Professionnel introuvable');
    return ok({ id: u.id, nom: u.nom, prenom: u.prenom, telephone: u.telephone, role: u.role, nomCommercial: u.nomCommercial || null });
  }));
  route('GET', /^\/users\/verifier-destinataire$/, AUTH_REQUIRED(function (ctx) {
    var u = findUserByTel(ctx.query.telephone);
    if (!u) return fail(404, 'AP-USR-002', 'Destinataire introuvable');
    return ok({ id: u.id, nom: u.nom, prenom: u.prenom, telephone: u.telephone, role: u.role });
  }));
  route('GET', /^\/business\/lookup$/, AUTH_REQUIRED(function (ctx) {
    var m = DB.users.find(function (u) { return u.role === 'business' && u.codeParrainage === ctx.query.code; });
    if (!m) return fail(404, 'AP-TXN-005', 'Marchand introuvable : ' + ctx.query.code);
    return ok({ id: m.id, nom: m.nomCommercial || (m.prenom + ' ' + m.nom), code: m.codeParrainage });
  }));
  route('GET', /^\/users\/([^/]+)\/referrals$/, AUTH_REQUIRED(function (ctx) {
    var targetId = ctx.params[0];
    if (targetId !== ctx.user.id && ['superviseur', 'admin'].indexOf(ctx.user.role) === -1) return fail(403, 'AP-RBAC-004', 'Accès non autorisé');
    var filleuls = DB.users.filter(function (u) { return u.parrainId === targetId; })
      .map(function (u) { return { id: u.id, nom: u.nom, prenom: u.prenom, telephone: u.telephone, role: u.role, kycNiveau: u.kycNiveau, createdAt: u.createdAt }; });
    var totalGains = DB.commissions.filter(function (c) { return c.beneficiaireId === targetId; }).reduce(function (s, c) { return s + c.montant; }, 0);
    return ok({ filleuls: filleuls, totalGains: totalGains });
  }));
  route('GET', /^\/users$/, AUTH_REQUIRED(function (ctx) {
    var list = DB.users.slice();
    if (ctx.query.role) list = list.filter(function (u) { return u.role === ctx.query.role; });
    if (ctx.query.statut) list = list.filter(function (u) { return u.statut === ctx.query.statut; });
    if (ctx.query.telephone) list = list.filter(function (u) { return u.telephone.indexOf(ctx.query.telephone) !== -1; });
    if (ctx.query.parrainId) list = list.filter(function (u) { return u.parrainId === ctx.query.parrainId; });
    var q = ctx.query.q || ctx.query.search;
    if (q) {
      q = q.toLowerCase();
      list = list.filter(function (u) { return (u.nom + ' ' + u.prenom + ' ' + u.telephone).toLowerCase().indexOf(q) !== -1; });
    }
    var out = list.map(function (u) {
      var p = userPublic(u, true);
      return p;
    });
    return paginate(out, ctx.query);
  }));
  route('GET', /^\/users\/([^/]+)$/, AUTH_REQUIRED(function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    var out = userPublic(u, true);
    out.filleuls = DB.users.filter(function (x) { return x.parrainId === u.id; }).map(function (x) { return { id: x.id, nom: x.nom, prenom: x.prenom, telephone: x.telephone, createdAt: x.createdAt }; });
    var parrain = u.parrainId ? findUser(u.parrainId) : null;
    out.parrain = parrain ? { nom: parrain.nom, prenom: parrain.prenom, telephone: parrain.telephone } : null;
    return ok(out);
  }));
  route('PATCH', /^\/users\/([^/]+)\/status$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    var valid = ['actif', 'bloque', 'gele', 'suspendu'];
    if (valid.indexOf(ctx.body.statut) === -1) return fail(422, 'AP-VAL-001', 'Statut invalide. Valeurs : ' + valid.join(', '));
    u.statut = ctx.body.statut; saveDB();
    return ok({ id: u.id, statut: u.statut }, 'Statut mis à jour : ' + u.statut);
  })));
  route('PATCH', /^\/users\/([^/]+)\/suspend$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    u.statut = 'suspendu'; saveDB();
    return ok({ id: u.id, statut: u.statut }, 'Compte suspendu');
  })));
  route('POST', /^\/users\/([^/]+)\/debloquer$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    u.statut = 'actif'; u.tentativesPin = 0; saveDB();
    return ok({ id: u.id, statut: u.statut }, 'Compte débloqué');
  })));
  route('POST', /^\/users\/([^/]+)\/reinitialiser-appareils$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    u.deviceToken = null; saveDB();
    return ok({ id: u.id }, 'Appareils réinitialisés');
  })));
  route('POST', /^\/users\/([^/]+)\/reset-pin$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    u.pin = '1234'; u.tentativesPin = 0; saveDB();
    return ok({ id: u.id }, 'PIN réinitialisé à 1234');
  })));

  // ── Accounts ──
  route('GET', /^\/accounts\/me$/, AUTH_REQUIRED(function (ctx) {
    var c = findCompteByUser(ctx.user.id);
    if (!c) return fail(404, 'AP-TXN-001', 'Aucun compte actif');
    return ok(c);
  }));
  route('GET', /^\/accounts\/([^/]+)$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var c = findCompte(ctx.params[0]);
    if (!c) return fail(404, 'AP-TXN-001', 'Compte introuvable');
    var u = findUser(c.utilisateurId);
    var out = clone(c); out.utilisateur = u ? { nom: u.nom, prenom: u.prenom, telephone: u.telephone, role: u.role } : null;
    return ok(out);
  })));
  route('POST', /^\/accounts\/transfer-gains$/, AUTH_REQUIRED(function (ctx) {
    var c = findCompteByUser(ctx.user.id);
    var montant = Number(ctx.body.montant || c.gainsMoisCourant || 0);
    if (montant <= 0) return fail(422, 'AP-TXN-004', 'Aucun gain à transférer');
    c.solde += montant; c.gainsMoisCourant = Math.max(0, c.gainsMoisCourant - montant);
    DB.transactions.push({ id: uid('t'), reference: genRef('VIR'), type: 'virement_gains', statut: 'complete', initiateurRole: ctx.user.role === 'client' ? 'client' : 'agent', compteSourceId: null, compteDestId: c.id, montant: montant, frais: 0, agentId: null, description: 'Virement des gains de parrainage', dateCreation: nowIso(), dateCompletion: nowIso() });
    saveDB();
    return ok({ montant: montant, nouveauSolde: c.solde }, 'Gains transférés vers le solde principal');
  }));
  route('POST', /^\/accounts\/transfer-commissions$/, AUTH_REQUIRED(function (ctx) {
    var c = findCompteByUser(ctx.user.id);
    var enAttente = DB.commissions.filter(function (cm) { return cm.beneficiaireId === ctx.user.id && cm.statut === 'en_attente'; });
    var montant = enAttente.reduce(function (s, cm) { return s + cm.montant; }, 0);
    enAttente.forEach(function (cm) { cm.statut = 'verse'; cm.dateVersement = nowIso(); });
    c.solde += montant;
    DB.transactions.push({ id: uid('t'), reference: genRef('VIR'), type: 'virement_gains', statut: 'complete', initiateurRole: 'agent', compteSourceId: null, compteDestId: c.id, montant: montant, frais: 0, agentId: null, description: 'Virement des commissions', dateCreation: nowIso(), dateCompletion: nowIso() });
    saveDB();
    return ok({ montant: montant, nouveauSolde: c.solde }, 'Commissions transférées vers le solde principal');
  }));

  // ── Transactions ──
  function getCompteByTel(tel) {
    var user = findUserByTel(tel);
    if (!user) return { error: fail(404, 'AP-TXN-007', 'Utilisateur introuvable : ' + tel) };
    var compte = findCompteByUser(user.id);
    if (!compte) return { error: fail(422, 'AP-TXN-002', 'Aucun compte actif trouvé') };
    return { user: user, compte: compte };
  }
  function creerCommissions(tx) {
    var created = [];
    if (tx.type === 'depot' && tx.agentId) {
      var m1 = round(tx.montant * TAUX.DEPOT_AGENT);
      if (m1 > 0) created.push({ id: uid('com'), transactionId: tx.id, beneficiaireId: tx.agentId, typeCommission: 'depot_agent', montant: m1, taux: TAUX.DEPOT_AGENT, statut: 'en_attente', dateCalcul: nowIso(), dateVersement: null });
    }
    if (tx.type === 'retrait' && tx.agentId) {
      var fr = calculerFrais('retrait', tx.montant);
      var m2 = round(fr * TAUX.COMMISSION_AGENT_RETRAIT);
      if (m2 > 0) created.push({ id: uid('com'), transactionId: tx.id, beneficiaireId: tx.agentId, typeCommission: 'retrait_agent', montant: m2, taux: TAUX.COMMISSION_AGENT_RETRAIT, statut: 'en_attente', dateCalcul: nowIso(), dateVersement: null });
    }
    if (tx.frais > 0 && tx.compteSourceId) {
      var cs = findCompte(tx.compteSourceId);
      var us = cs ? findUser(cs.utilisateurId) : null;
      if (us && us.parrainId) {
        var parrain = findUser(us.parrainId);
        var compteParrain = parrain ? findCompteByUser(parrain.id) : null;
        var m3 = round(tx.frais * TAUX.PARRAINAGE);
        if (compteParrain && m3 > 0 && (compteParrain.gainsMoisCourant + m3) <= compteParrain.plafondMensuel) {
          created.push({ id: uid('com'), transactionId: tx.id, beneficiaireId: parrain.id, typeCommission: 'parrainage_direct', montant: m3, taux: TAUX.PARRAINAGE, statut: 'en_attente', dateCalcul: nowIso(), dateVersement: null });
          compteParrain.gainsMoisCourant += m3;
        }
      }
    }
    created.forEach(function (c) { DB.commissions.push(c); });
    return created;
  }

  function findPendingOtpForCompte(compteId) {
    var t = DB.transactions.find(function (t) { return t.statut === 'en_attente' && t.otpMeta && t.compteSourceId === compteId; });
    if (t && new Date(t.otpMeta.expiresAt) < new Date()) { t.statut = 'expire'; t.otpMeta = null; saveDB(); return null; }
    return t || null;
  }
  route('GET', /^\/transactions\/otp\/pending$/, AUTH_REQUIRED(function (ctx) {
    var compte = findCompteByUser(ctx.user.id);
    var t = compte && findPendingOtpForCompte(compte.id);
    if (!t) return ok({ pending: false });
    var demandeur = t.agentId ? findUser(t.agentId) : (function () { var cd = findCompte(t.compteDestId); return cd ? findUser(cd.utilisateurId) : null; })();
    return ok({
      pending: true, type: t.type === 'retrait' ? 'retrait' : 'encaissement',
      demandeurNom: demandeur ? (demandeur.nomCommercial || (demandeur.prenom + ' ' + demandeur.nom)) : 'Un professionnel',
      montant: t.montant, otp: t.otpMeta.code, expiresAt: t.otpMeta.expiresAt,
    });
  }));
  route('POST', /^\/transactions\/otp\/refuser$/, AUTH_REQUIRED(function (ctx) {
    var compte = findCompteByUser(ctx.user.id);
    var t = compte && findPendingOtpForCompte(compte.id);
    if (t) { t.statut = 'annule'; t.otpMeta = null; saveDB(); }
    return ok(null, 'Demande refusée');
  }));

  route('GET', /^\/transactions\/preview\/deposit$/, AUTH_REQUIRED(ROLES(['agent', 'mini_master', 'master', 'admin'], function (ctx) {
    var r = getCompteByTel(ctx.query.telephone); if (r.error) return r.error;
    var montant = parseInt(ctx.query.montant, 10);
    return ok({ montant: montant, fraisClient: 0, gainAgent: calculerCommissionAgent('depot', montant), client: { nom: r.user.nom, prenom: r.user.prenom, telephone: r.user.telephone, role: r.user.role } });
  })));
  route('GET', /^\/transactions\/preview\/withdraw$/, AUTH_REQUIRED(ROLES(['agent', 'mini_master', 'master', 'admin'], function (ctx) {
    var r = getCompteByTel(ctx.query.telephone); if (r.error) return r.error;
    var montant = parseInt(ctx.query.montant, 10);
    var frais = calculerFrais('retrait', montant);
    var soldeApres = r.compte.solde - montant;
    return ok({ montant: montant, frais: frais, montantNet: montant - frais, gainAgent: calculerCommissionAgent('retrait', montant), soldeClientActuel: r.compte.solde, soldeClientApres: soldeApres, soldeInsuffisant: soldeApres < 0, client: { nom: r.user.nom, prenom: r.user.prenom, telephone: r.user.telephone } });
  })));

  route('POST', /^\/transactions\/deposit$/, AUTH_REQUIRED(ROLES(['agent', 'mini_master', 'master', 'admin'], function (ctx) {
    var r = getCompteByTel(ctx.body.telephone); if (r.error) return r.error;
    var compteAgent = findCompteByUser(ctx.user.id);
    if (!compteAgent) return fail(422, 'AP-TXN-002', 'Compte agent inactif');
    var montant = Number(ctx.body.montant);
    if (compteAgent.solde < montant) return fail(422, 'AP-TXN-003', 'Liquidité agent insuffisante');
    var tx = { id: uid('t'), reference: genRef('DEP'), type: 'depot', statut: 'complete', initiateurRole: 'agent', compteSourceId: compteAgent.id, compteDestId: r.compte.id, montant: montant, frais: 0, agentId: ctx.user.id, description: null, dateCreation: nowIso(), dateCompletion: nowIso() };
    DB.transactions.push(tx);
    compteAgent.solde -= montant; r.compte.solde += montant;
    creerCommissions(tx); saveDB();
    return ok({ transactionId: tx.id, reference: tx.reference, montant: montant, fraisClient: 0, gainAgent: calculerCommissionAgent('depot', montant), client: { nom: r.user.nom, prenom: r.user.prenom, telephone: r.user.telephone }, dateCompletion: tx.dateCompletion }, 'Dépôt effectué avec succès', 201);
  })));

  function genOtpCode() { return String(round(1000 + Math.random() * 9000)); }
  route('POST', /^\/transactions\/withdraw\/request$/, AUTH_REQUIRED(ROLES(['agent', 'mini_master', 'master', 'admin'], function (ctx) {
    var r = getCompteByTel(ctx.body.telephone); if (r.error) return r.error;
    var montant = Number(ctx.body.montant);
    if (r.compte.solde < montant) return fail(422, 'AP-TXN-003', 'Solde client insuffisant. Solde : ' + r.compte.solde.toLocaleString('fr-FR') + ' FCFA');
    var compteAgent = findCompteByUser(ctx.user.id);
    var frais = calculerFrais('retrait', montant);
    var code = genOtpCode();
    var expiresAt = new Date(Date.now() + 3 * 60000).toISOString();
    var tx = { id: uid('t'), reference: genRef('RET'), type: 'retrait', statut: 'en_attente', initiateurRole: 'agent', compteSourceId: r.compte.id, compteDestId: compteAgent.id, montant: montant, frais: frais, agentId: ctx.user.id, description: null, dateCreation: nowIso(), dateCompletion: null, otpMeta: { code: code, expiresAt: expiresAt } };
    DB.transactions.push(tx);
    var agentUser = findUser(ctx.user.id);
    addNotification(r.user.id, 'transaction', 'Code de retrait', 'Code de retrait demandé par ' + agentUser.prenom + ' ' + agentUser.nom + ' — ' + montant.toLocaleString('fr-FR') + ' FCFA', { type: 'retrait_otp', otp: code, demandeurNom: agentUser.prenom + ' ' + agentUser.nom, montant: montant });
    saveDB();
    return ok({ montant: montant, frais: frais, total: montant, expiresAt: expiresAt }, 'Code envoyé au client. En attente de confirmation.', 201);
  })));
  route('POST', /^\/transactions\/withdraw\/confirm$/, AUTH_REQUIRED(function (ctx) {
    var r = getCompteByTel(ctx.body.telephone); if (r.error) return r.error;
    var t = findPendingOtpForCompte(r.compte.id);
    if (!t || t.type !== 'retrait') return fail(404, 'AP-TXN-001', 'Aucune demande de retrait en attente pour ce client');
    if (String(ctx.body.otp) !== t.otpMeta.code) return fail(401, 'AP-TXN-004', 'Code incorrect');
    t.statut = 'confirme'; saveDB();
    var docs = DB.kycDocuments.filter(function (d) { return d.utilisateurId === r.user.id && d.urlFichier && ['cni_recto', 'cni_verso', 'selfie', 'selfie_inscription'].indexOf(d.typeDocument) !== -1; });
    var urls = docs.map(function (d) { return d.urlFichier; });
    var type = docs.some(function (d) { return d.typeDocument.indexOf('cni') === 0; }) ? 'cni' : 'selfie';
    if (!urls.length) { urls = ['logo-principal-512.png']; }
    return ok({ montant: t.montant, frais: t.frais, total: t.montant, photoVerification: { type: type, urls: urls } }, 'Code vérifié');
  }));
  route('POST', /^\/transactions\/withdraw\/valider$/, AUTH_REQUIRED(function (ctx) {
    var r = getCompteByTel(ctx.body.telephone); if (r.error) return r.error;
    var t = DB.transactions.find(function (t) { return t.type === 'retrait' && t.statut === 'confirme' && t.compteSourceId === r.compte.id; });
    if (!t) return fail(404, 'AP-TXN-001', 'Aucun retrait confirmé en attente de validation');
    var compteClient = findCompte(t.compteSourceId);
    var compteAgent = findCompte(t.compteDestId);
    var montantNet = t.montant - t.frais;
    compteClient.solde -= t.montant; compteAgent.solde += montantNet;
    t.statut = 'complete'; t.dateCompletion = nowIso(); t.otpMeta = null;
    creerCommissions(t); saveDB();
    return ok({ montant: t.montant, gainAgent: calculerCommissionAgent('retrait', t.montant), reference: t.reference }, 'Retrait effectué avec succès');
  }));

  route('POST', /^\/transactions\/collect\/request$/, AUTH_REQUIRED(ROLES(['business', 'admin'], function (ctx) {
    var r = getCompteByTel(ctx.body.telephone); if (r.error) return r.error;
    var montant = Number(ctx.body.montant);
    var compteBiz = findCompteByUser(ctx.user.id);
    var frais = calculerFrais('paiement_marchand', montant);
    var code = genOtpCode();
    var expiresAt = new Date(Date.now() + 3 * 60000).toISOString();
    var tx = { id: uid('t'), reference: genRef('COL'), type: 'paiement_marchand', statut: 'en_attente', initiateurRole: 'business', compteSourceId: r.compte.id, compteDestId: compteBiz.id, montant: montant, frais: frais, agentId: null, description: null, dateCreation: nowIso(), dateCompletion: null, otpMeta: { code: code, expiresAt: expiresAt } };
    DB.transactions.push(tx);
    var bizUser = findUser(ctx.user.id);
    var bizNom = bizUser.nomCommercial || (bizUser.prenom + ' ' + bizUser.nom);
    addNotification(r.user.id, 'transaction', "Code d'encaissement", 'Code demandé par ' + bizNom + ' — ' + montant.toLocaleString('fr-FR') + ' FCFA', { type: 'encaissement_otp', otp: code, demandeurNom: bizNom, montant: montant });
    saveDB();
    return ok({ clientNom: r.user.prenom + ' ' + r.user.nom, expiresAt: expiresAt }, 'Code envoyé au client', 201);
  })));
  route('POST', /^\/transactions\/collect\/confirm$/, AUTH_REQUIRED(function (ctx) {
    var r = getCompteByTel(ctx.body.telephone); if (r.error) return r.error;
    var t = findPendingOtpForCompte(r.compte.id);
    if (!t || t.type !== 'paiement_marchand') return fail(404, 'AP-TXN-001', 'Aucune demande en attente pour ce client');
    if (String(ctx.body.otp) !== t.otpMeta.code) return fail(401, 'AP-TXN-004', 'Code incorrect');
    var compteClient = findCompte(t.compteSourceId);
    var compteBiz = findCompte(t.compteDestId);
    var montantMarchand = t.montant - t.frais;
    compteClient.solde -= t.montant; compteBiz.solde += montantMarchand;
    t.statut = 'complete'; t.dateCompletion = nowIso(); t.otpMeta = null;
    creerCommissions(t); saveDB();
    return ok({ totalDebitClient: t.montant, fraisBusiness: t.frais, clientNom: r.user.prenom + ' ' + r.user.nom, reference: t.reference }, 'Encaissement effectué avec succès');
  }));

  route('POST', /^\/transactions\/transfer$/, AUTH_REQUIRED(function (ctx) {
    if (ctx.user.telephone === ctx.body.telephone) return fail(422, 'AP-TXN-008', 'Impossible de vous transférer à vous-même');
    var compteSource = findCompteByUser(ctx.user.id);
    if (!compteSource) return fail(422, 'AP-TXN-002', 'Compte source inactif');
    var r = getCompteByTel(ctx.body.telephone); if (r.error) return r.error;
    var montant = Number(ctx.body.montant);
    if (compteSource.solde < montant) return fail(422, 'AP-TXN-003', 'Solde insuffisant');
    var tx = { id: uid('t'), reference: genRef('TRF'), type: 'transfert', statut: 'complete', initiateurRole: ctx.user.role === 'client' ? 'client' : 'agent', compteSourceId: compteSource.id, compteDestId: r.compte.id, montant: montant, frais: 0, agentId: null, description: ctx.body.motif || null, dateCreation: nowIso(), dateCompletion: nowIso() };
    DB.transactions.push(tx);
    compteSource.solde -= montant; r.compte.solde += montant;
    creerCommissions(tx); saveDB();
    return ok({ transactionId: tx.id, reference: tx.reference, montant: montant, frais: 0, destinataire: { nom: r.user.nom, prenom: r.user.prenom, telephone: r.user.telephone }, dateCompletion: tx.dateCompletion }, 'Transfert effectué avec succès', 201);
  }));
  route('POST', /^\/transactions\/([^/]+)\/annuler$/, AUTH_REQUIRED(function (ctx) {
    var t = DB.transactions.find(function (t) { return t.id === ctx.params[0]; });
    if (!t) return fail(404, 'AP-TXN-001', 'Transaction introuvable');
    var compte = findCompteByUser(ctx.user.id);
    if (t.type !== 'transfert' || t.statut !== 'complete' || !compte || t.compteSourceId !== compte.id) return fail(409, 'AP-TXN-006', 'Cette transaction ne peut pas être annulée');
    var cd = findCompte(t.compteDestId);
    if (cd) cd.solde -= t.montant;
    compte.solde += t.montant;
    t.statut = 'annule'; saveDB();
    return ok({ message: 'Transfert annulé, fonds restitués.' });
  }));

  route('POST', /^\/transactions\/pay$/, AUTH_REQUIRED(function (ctx) {
    var comptePayeur = findCompteByUser(ctx.user.id);
    if (!comptePayeur) return fail(422, 'AP-TXN-002', 'Compte inactif');
    var marchand = DB.users.find(function (u) { return u.role === 'business' && u.codeParrainage === ctx.body.merchantCode; });
    if (!marchand) return fail(404, 'AP-TXN-005', 'Marchand introuvable : ' + ctx.body.merchantCode);
    var compteMarchand = findCompteByUser(marchand.id);
    var montant = Number(ctx.body.montant);
    if (comptePayeur.solde < montant) return fail(422, 'AP-TXN-003', 'Solde insuffisant');
    var frais = calculerFrais('paiement_marchand', montant);
    var montantMarchand = montant - frais;
    var tx = { id: uid('t'), reference: genRef('PAY'), type: 'paiement_marchand', statut: 'complete', initiateurRole: 'client', compteSourceId: comptePayeur.id, compteDestId: compteMarchand.id, montant: montant, frais: frais, agentId: null, description: null, dateCreation: nowIso(), dateCompletion: nowIso() };
    DB.transactions.push(tx);
    comptePayeur.solde -= montant; compteMarchand.solde += montantMarchand;
    creerCommissions(tx); saveDB();
    return ok({ transactionId: tx.id, reference: tx.reference, montant: montant, frais: frais, montantMarchand: montantMarchand, marchand: { nom: (marchand.nomCommercial || (marchand.prenom + ' ' + marchand.nom)), code: ctx.body.merchantCode }, dateCompletion: tx.dateCompletion }, 'Paiement effectué avec succès', 201);
  }));

  route('GET', /^\/transactions\/([^/]+)$/, AUTH_REQUIRED(function (ctx) {
    var t = DB.transactions.find(function (t) { return t.id === ctx.params[0]; });
    if (!t) return fail(404, 'AP-TXN-001', 'Transaction introuvable');
    return ok(txPublic(t));
  }));
  route('GET', /^\/transactions$/, AUTH_REQUIRED(function (ctx) {
    var role = ctx.user.role;
    var typesAutorises = TYPES_VISIBLES[role];
    if (ctx.query.type && typesAutorises && typesAutorises.indexOf(ctx.query.type) === -1) return paginate([], ctx.query);
    var compte = findCompteByUser(ctx.user.id);
    var list = DB.transactions.filter(function (t) {
      if (ctx.query.type && t.type !== ctx.query.type) return false;
      if (ctx.query.statut && t.statut !== ctx.query.statut) return false;
      if (typesAutorises && typesAutorises.indexOf(t.type) === -1) return false;
      if (['admin', 'superviseur'].indexOf(role) === -1) {
        var own = compte && (t.compteSourceId === compte.id || t.compteDestId === compte.id || (role === 'agent' && t.agentId === ctx.user.id));
        if (!own) return false;
      }
      return true;
    }).sort(function (a, b) { return new Date(b.dateCreation) - new Date(a.dateCreation); });
    return paginate(list.map(txPublic), ctx.query);
  }));

  // ── Commissions ──
  route('GET', /^\/commissions\/summary$/, AUTH_REQUIRED(function (ctx) {
    var debut = new Date(); debut.setDate(1); debut.setHours(0, 0, 0, 0);
    var mine = ['admin', 'superviseur'].indexOf(ctx.user.role) === -1;
    var list = DB.commissions.filter(function (c) { return c.statut === 'verse' && (!mine || c.beneficiaireId === ctx.user.id); });
    var mois = list.filter(function (c) { return new Date(c.dateCalcul) >= debut; });
    return ok({ totalHistorique: list.reduce(function (s, c) { return s + c.montant; }, 0), totalMois: mois.reduce(function (s, c) { return s + c.montant; }, 0) });
  }));
  route('GET', /^\/commissions$/, AUTH_REQUIRED(function (ctx) {
    var mine = ['admin', 'superviseur'].indexOf(ctx.user.role) === -1;
    var list = DB.commissions.filter(function (c) { return !mine || c.beneficiaireId === ctx.user.id; });
    if (ctx.query.type) list = list.filter(function (c) { return c.typeCommission === ctx.query.type; });
    list = list.slice().sort(function (a, b) { return new Date(b.dateCalcul) - new Date(a.dateCalcul); });
    var out = list.map(function (c) {
      var t = DB.transactions.find(function (t) { return t.id === c.transactionId; });
      var o = clone(c); o.transaction = t ? { reference: t.reference, type: t.type, montant: t.montant } : null;
      return o;
    });
    return paginate(out, ctx.query);
  }));

  // ── Network ──
  route('GET', /^\/network\/agents$/, AUTH_REQUIRED(ROLES(['mini_master', 'master', 'superviseur', 'admin'], function (ctx) {
    var list = DB.users.filter(function (u) { return u.role === 'agent' && (['admin', 'superviseur'].indexOf(ctx.user.role) !== -1 || u.parrainId === ctx.user.id); });
    var out = list.map(function (u) { var c = findCompteByUser(u.id); return { id: u.id, nom: u.nom, prenom: u.prenom, telephone: u.telephone, zone: u.zone, statut: u.statut, createdAt: u.createdAt, comptes: c ? [{ solde: c.solde }] : [] }; });
    return paginate(out, ctx.query);
  })));
  route('GET', /^\/network\/my$/, AUTH_REQUIRED(ROLES(['mini_master', 'master', 'admin'], function (ctx) {
    var agents = DB.users.filter(function (u) { return u.parrainId === ctx.user.id && u.role === 'agent'; });
    var out = agents.map(function (u) { var c = findCompteByUser(u.id); return { id: u.id, nom: u.nom, prenom: u.prenom, telephone: u.telephone, zone: u.zone, statut: u.statut, comptes: c ? [{ solde: c.solde, gainsMoisCourant: c.gainsMoisCourant }] : [] }; });
    return ok({ agents: out, totalAgents: out.length });
  })));

  // ── Stats ──
  route('GET', /^\/stats\/dashboard$/, AUTH_REQUIRED(function (ctx) {
    var role = ctx.user.role, id = ctx.user.id;
    var debut = new Date(); debut.setDate(1); debut.setHours(0, 0, 0, 0);
    var compte = findCompteByUser(id);
    if (['admin', 'superviseur'].indexOf(role) !== -1) {
      var completes = DB.transactions.filter(function (t) { return t.statut === 'complete'; });
      var moisTx = completes.filter(function (t) { return new Date(t.dateCreation) >= debut; });
      return ok({ role: role, totalUtilisateurs: DB.users.length, txTotal: completes.length, txJour: moisTx.length, transactionsMois: moisTx.length, totalCommissions: DB.commissions.reduce(function (s, c) { return s + c.montant; }, 0), alertesActives: DB.alertes.filter(function (a) { return a.statut === 'ouverte'; }).length, ticketsOuverts: DB.tickets.filter(function (t) { return ['ouvert', 'en_cours'].indexOf(t.statut) !== -1; }).length, volumeMois: moisTx.reduce(function (s, t) { return s + t.montant; }, 0), fraisMois: moisTx.reduce(function (s, t) { return s + t.frais; }, 0) });
    }
    if (['agent', 'mini_master', 'master'].indexOf(role) !== -1) {
      var depots = DB.transactions.filter(function (t) { return t.agentId === id && t.type === 'depot' && t.statut === 'complete' && new Date(t.dateCreation) >= debut; });
      var retraits = DB.transactions.filter(function (t) { return t.agentId === id && t.type === 'retrait' && t.statut === 'complete' && new Date(t.dateCreation) >= debut; });
      var coms = DB.commissions.filter(function (c) { return c.beneficiaireId === id && new Date(c.dateCalcul) >= debut; });
      return ok({ role: role, solde: compte ? compte.solde : 0, depotsMois: { count: depots.length, volume: depots.reduce(function (s, t) { return s + t.montant; }, 0) }, retraitsMois: { count: retraits.length, volume: retraits.reduce(function (s, t) { return s + t.montant; }, 0) }, gainsMois: coms.reduce(function (s, c) { return s + c.montant; }, 0) });
    }
    var txCount = DB.transactions.filter(function (t) { return (t.compteSourceId === (compte && compte.id) || t.compteDestId === (compte && compte.id)) && new Date(t.dateCreation) >= debut; }).length;
    return ok({ role: role, solde: compte ? compte.solde : 0, txMois: txCount });
  }));

  // ── Notifications ──
  // Forme de réponse : {notifications:[...], nonLues:N} — les 3 apps lisent
  // indifféremment r.data.notifications/r.data.nonLues (ou repli r.notifications).
  function notifPublic(n) {
    return { id: n.id, type: n.type, titre: n.titre, message: n.message, lu: n.statut === 'lu', createdAt: n.createdAt, data: n.data || null };
  }
  route('GET', /^\/notifications$/, AUTH_REQUIRED(function (ctx) {
    var mine = DB.notifications.filter(function (n) { return n.utilisateurId === ctx.user.id; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var limit = parseInt(ctx.query.limit || '50', 10);
    var nonLues = mine.filter(function (n) { return n.statut !== 'lu'; }).length;
    return ok({ notifications: mine.slice(0, limit).map(notifPublic), nonLues: nonLues });
  }));
  route('PATCH', /^\/notifications\/tout-lire$/, AUTH_REQUIRED(function (ctx) {
    DB.notifications.forEach(function (n) { if (n.utilisateurId === ctx.user.id) n.statut = 'lu'; });
    saveDB(); return ok(null, 'Toutes les notifications marquées comme lues');
  }));
  route('PATCH', /^\/notifications\/([^/]+)\/lu$/, AUTH_REQUIRED(function (ctx) {
    var n = DB.notifications.find(function (n) { return n.id === ctx.params[0] && n.utilisateurId === ctx.user.id; });
    if (n) { n.statut = 'lu'; n.dateLecture = nowIso(); saveDB(); }
    return ok(n ? notifPublic(n) : null);
  }));
  function addNotification(userId, type, titre, message, dataObj) {
    var n = { id: uid('notif'), utilisateurId: userId, type: type, titre: titre, message: message, canal: 'in_app', statut: 'en_attente', referenceId: null, data: dataObj ? JSON.stringify(dataObj) : null, createdAt: nowIso(), dateLecture: null };
    DB.notifications.push(n);
    return n;
  }

  // ── Tickets (contrat back-office : liste plate, filtres service/statut/limit/q) ──
  function ticketPublic(t) {
    var c = findUser(t.clientId);
    var o = clone(t);
    o.client = c ? { prenom: c.prenom, nom: c.nom, telephone: c.telephone } : null;
    o.telephone = c ? c.telephone : null;
    return o;
  }
  route('GET', /^\/tickets$/, AUTH_REQUIRED(function (ctx) {
    var priv = ['superviseur', 'admin'].indexOf(ctx.user.role) !== -1;
    var list = DB.tickets.filter(function (t) { return priv || t.clientId === ctx.user.id; });
    if (ctx.query.statut) list = list.filter(function (t) { return t.statut === ctx.query.statut; });
    if (ctx.query.service) list = list.filter(function (t) { return t.service === ctx.query.service; });
    if (ctx.query.q) { var q = ctx.query.q.toLowerCase(); list = list.filter(function (t) { return (t.reference + ' ' + t.sujet).toLowerCase().indexOf(q) !== -1; }); }
    list = list.slice().sort(function (a, b) { return new Date(b.dateCreation) - new Date(a.dateCreation); });
    var limit = parseInt(ctx.query.limit || '50', 10);
    var out = list.slice(0, limit).map(ticketPublic);
    return { status: 200, body: { success: true, data: out, total: list.length, count: out.length, timestamp: nowIso() } };
  }));
  route('POST', /^\/tickets$/, AUTH_REQUIRED(function (ctx) {
    if (!ctx.body.sujet || !ctx.body.description) return fail(422, 'AP-VAL-001', 'sujet et description requis');
    var clientId = ctx.user.id;
    if (ctx.body.telephone) { var cu = findUserByTel(ctx.body.telephone); if (cu) clientId = cu.id; }
    var t = { id: uid('tkt'), reference: genRef('TKT'), clientId: clientId, transactionId: ctx.body.transactionId || null, sujet: ctx.body.sujet, description: ctx.body.description, priorite: ctx.body.priorite || 'normale', statut: 'ouvert', service: ctx.body.service || 'support_client', dateCreation: nowIso(), dateResolution: null };
    DB.tickets.push(t); saveDB();
    return ok(ticketPublic(t), 'Ticket créé', 201);
  }));
  route('PATCH', /^\/tickets\/([^/]+)\/status$/, AUTH_REQUIRED(function (ctx) {
    var t = DB.tickets.find(function (t) { return t.id === ctx.params[0]; });
    if (!t) return fail(404, 'AP-TXN-001', 'Ticket introuvable');
    t.statut = ctx.body.statut;
    if (ctx.body.statut === 'resolu') t.dateResolution = nowIso();
    saveDB(); return ok(ticketPublic(t));
  }));
  route('DELETE', /^\/tickets\/([^/]+)$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    DB.tickets = DB.tickets.filter(function (t) { return t.id !== ctx.params[0]; }); saveDB();
    return ok(null, 'Ticket supprimé');
  })));

  // ── Alertes (contrat back-office : {alertes,total}, filtres service/statut/gravite/limit) ──
  route('GET', /^\/alerts\/counts$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var counts = {};
    DB.alertes.forEach(function (a) { counts[a.statut] = (counts[a.statut] || 0) + 1; });
    return ok({ counts: counts });
  })));
  route('GET', /^\/alerts$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var list = DB.alertes.slice();
    if (ctx.query.statut) list = list.filter(function (a) { return a.statut === ctx.query.statut; });
    if (ctx.query.gravite) list = list.filter(function (a) { return a.gravite === ctx.query.gravite; });
    if (ctx.query.service) list = list.filter(function (a) { return a.service === ctx.query.service; });
    list = list.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var limit = parseInt(ctx.query.limit || '50', 10);
    return ok({ alertes: list.slice(0, limit), total: list.length });
  })));
  route('POST', /^\/alerts$/, AUTH_REQUIRED(function (ctx) {
    var a = { id: uid('al'), titre: ctx.body.titre, description: ctx.body.description || '', gravite: ctx.body.gravite || 'moyenne', statut: 'ouverte', service: ctx.body.service || 'admin', auteur: ctx.user.prenom + ' ' + ctx.user.nom, created_at: nowIso(), traite_par: null };
    DB.alertes.push(a); saveDB();
    return ok(a, 'Alerte créée', 201);
  }));
  route('PATCH', /^\/alerts\/([^/]+)$/, AUTH_REQUIRED(function (ctx) {
    var a = DB.alertes.find(function (a) { return a.id === ctx.params[0]; });
    if (!a) return fail(404, 'AP-TXN-001', 'Alerte introuvable');
    if (ctx.body.statut) a.statut = ctx.body.statut;
    if (ctx.body.traite_par) a.traite_par = ctx.body.traite_par;
    saveDB(); return ok(a);
  }));
  route('DELETE', /^\/alerts\/([^/]+)$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    DB.alertes = DB.alertes.filter(function (a) { return a.id !== ctx.params[0]; }); saveDB();
    return ok(null, 'Alerte supprimée');
  })));

  // ── KYC ──
  route('GET', /^\/kyc\/documents$/, AUTH_REQUIRED(function (ctx) {
    var userId = ctx.query.userId || ctx.user.id;
    if (userId !== ctx.user.id && ['agent', 'business', 'mini_master', 'master', 'superviseur', 'admin'].indexOf(ctx.user.role) === -1) return fail(403, 'AP-RBAC-004', 'Accès non autorisé');
    return ok(DB.kycDocuments.filter(function (d) { return d.utilisateurId === userId; }));
  }));
  route('POST', /^\/kyc\/documents$/, AUTH_REQUIRED(function (ctx) {
    // userId dans le body = le compte concerné (peut être un client inscrit par un agent).
    var targetId = ctx.body.userId || ctx.user.id;
    var d = { id: uid('kyc'), utilisateurId: targetId, typeDocument: ctx.body.typeDocument || ctx.body.type, urlFichier: ctx.body.urlFichier || ctx.body.url || '', hashFichier: uid('hash'), statut: 'soumis', commentaire: null, verifieParId: null, dateSoumission: nowIso(), dateVerification: null };
    DB.kycDocuments.push(d); saveDB();
    return ok(d, 'Document envoyé, en attente de vérification', 201);
  }));
  route('POST', /^\/kyc\/request$/, AUTH_REQUIRED(function (ctx) {
    var targetId = ctx.body.userId || ctx.user.id;
    var u = findUser(targetId);
    var niveau = ctx.body.niveauDemande || ctx.body.niveau || ctx.body.kycNiveau;
    if (u) { u.kycNiveauDemande = niveau; u.statut = 'en_attente'; saveDB(); }
    return ok({ userId: targetId, niveauDemande: niveau }, 'Demande envoyée. Un agent va vérifier vos documents.', 201);
  }));
  // Endpoints propres au client : code de consultation des documents d'identité
  route('GET', /^\/users\/me\/code-documents-status$/, AUTH_REQUIRED(function (ctx) {
    return ok({ configure: !!ctx.user.codeDocuments });
  }));
  route('POST', /^\/users\/me\/code-documents$/, AUTH_REQUIRED(function (ctx) {
    if (String(ctx.body.pinActuel) !== String(ctx.user.pin)) return fail(401, 'AP-AUTH-002', 'PIN actuel incorrect');
    if (String(ctx.body.nouveauCode) === String(ctx.user.pin)) return fail(422, 'AP-VAL-001', 'Choisissez un code différent de votre PIN de connexion');
    ctx.user.codeDocuments = String(ctx.body.nouveauCode); ctx.user.codeDocAttempts = 0; saveDB();
    return ok(null, 'Code de consultation enregistré');
  }));
  route('POST', /^\/users\/me\/documents-identite$/, AUTH_REQUIRED(function (ctx) {
    if (ctx.user.codeDocAttempts >= 5) return fail(429, 'AP-AUTH-009', 'Trop de tentatives incorrectes. Contactez le support.');
    if (!ctx.user.codeDocuments || String(ctx.body.code) !== String(ctx.user.codeDocuments)) {
      ctx.user.codeDocAttempts++; saveDB();
      return fail(401, 'AP-AUTH-002', 'Code incorrect');
    }
    ctx.user.codeDocAttempts = 0; saveDB();
    var docs = DB.kycDocuments.filter(function (d) { return d.utilisateurId === ctx.user.id && d.urlFichier; });
    var urls = docs.map(function (d) { return d.urlFichier; });
    if (!urls.length) urls = ['logo-principal-512.png'];
    return ok({ photoVerification: { type: 'cni', urls: urls } });
  }));
  route('POST', /^\/users\/me\/verifier-pin$/, AUTH_REQUIRED(function (ctx) {
    if (String(ctx.body.pin) !== String(ctx.user.pin)) return fail(401, 'AP-AUTH-002', 'PIN incorrect');
    return ok({ valid: true });
  }));
  route('POST', /^\/kyc\/([^/]+)\/validate$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    u.kycNiveau = ctx.body.kycNiveau; u.statut = 'actif'; u.kycNiveauDemande = null;
    DB.kycDocuments.filter(function (d) { return d.utilisateurId === u.id && d.statut === 'soumis'; }).forEach(function (d) { d.statut = 'approuve'; d.verifieParId = ctx.user.id; d.dateVerification = nowIso(); });
    saveDB(); return ok({ id: u.id, kycNiveau: u.kycNiveau, statut: u.statut }, 'KYC validé avec succès');
  })));
  route('PATCH', /^\/kyc\/([^/]+)\/reject$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (u) { u.kycNiveauDemande = null; if (u.statut === 'en_attente') u.statut = 'actif'; }
    DB.kycDocuments.filter(function (d) { return d.utilisateurId === ctx.params[0] && d.statut === 'soumis'; }).forEach(function (d) { d.statut = 'rejete'; d.commentaire = ctx.body.raison || 'Documents non conformes'; d.verifieParId = ctx.user.id; d.dateVerification = nowIso(); });
    saveDB(); return ok(u ? { id: u.id } : null, 'Documents rejetés');
  })));
  // Route réellement utilisée par le back-office pour valider/activer un KYC.
  route('PATCH', /^\/users\/([^/]+)\/kyc$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    u.kycNiveau = ctx.body.kycNiveau; u.kycNiveauDemande = null; u.statut = 'actif';
    DB.kycDocuments.filter(function (d) { return d.utilisateurId === u.id && d.statut === 'soumis'; }).forEach(function (d) { d.statut = 'approuve'; d.verifieParId = ctx.user.id; d.dateVerification = nowIso(); });
    saveDB(); return ok({ id: u.id, kycNiveau: u.kycNiveau, statut: u.statut }, 'Niveau KYC mis à jour');
  })));

  // ── Tontine (client) ──
  route('GET', /^\/tontine\/eligibilite$/, AUTH_REQUIRED(function (ctx) {
    var u = ctx.user;
    var manque = { kyc3: u.kycNiveau !== 'KYC3', justificatifDomicile: !docApprouve(u.id, 'justificatif_domicile'), documentTontine: !docApprouve(u.id, 'document_tontine') };
    var eligible = !manque.kyc3 && !manque.justificatifDomicile && !manque.documentTontine;
    return ok({ eligible: eligible, manque: eligible ? {} : manque });
  }));
  route('GET', /^\/tontine\/mon-statut$/, AUTH_REQUIRED(function (ctx) {
    var p = tontineParticipant(ctx.user.id);
    if (!p) return ok({ participant: null });
    var cautions = tontineCautionsOf(p.id).sort(function (a, b) { return a.ordre - b.ordre; });
    var out = {
      participant: { id: p.id, statut: p.statut, montant: p.montant, categorie: p.categorie, position: p.position || null, signaturePhysiqueFaite: !!p.signaturePhysiqueFaite },
      cautions: cautions.map(function (c) { return { id: c.id, ordre: c.ordre, garantNom: c.garantNom, garantTelephone: c.garantTelephone, statut: c.statut, signaturePhysiqueFaite: !!c.signaturePhysiqueFaite }; }),
    };
    var g = p.groupeId ? tontineGroupe(p.groupeId) : null;
    if (g) {
      out.groupe = { numero: g.numero, categorie: g.categorie, montant: g.montant, statut: g.statut };
      out.membres = g.membres.map(function (id) { return { id: id }; });
      if (g.statut === 'en_cours' && g.tours && g.tours.length) {
        out.tours = g.tours.map(function (t) {
          var isMe = t.participantId === p.id;
          var benefU = isMe ? null : (function () { var bp = tontineParticipantById(t.participantId); return bp ? findUser(bp.utilisateurId) : null; })();
          var o = { numeroTour: t.numeroTour, beneficiaireId: t.participantId, beneficiairePrenom: isMe ? 'Vous' : (benefU ? benefU.prenom : ''), beneficiaireNom: isMe ? '' : (benefU ? benefU.nom : ''), datePrevue: t.datePrevue, statut: t.statut };
          if (isMe) { var mv = t.versements.find(function (v) { return v.participantId === p.id; }); o.monVersementStatut = mv ? mv.statut : 'a_prelever'; }
          return o;
        });
      }
    }
    return ok(out);
  }));
  route('GET', /^\/tontine\/paliers$/, AUTH_REQUIRED(function (ctx) { return ok(TONTINE_PALIERS); }));
  route('POST', /^\/tontine\/inscription$/, AUTH_REQUIRED(function (ctx) {
    if (tontineParticipant(ctx.user.id)) return fail(409, 'AP-TXN-006', 'Vous êtes déjà inscrit à la Tontine');
    var pal = findPalierByMontant(ctx.body.montant);
    if (!pal) return fail(422, 'AP-VAL-001', 'Palier invalide');
    if (ctx.user.kycNiveau !== 'KYC3' || !docApprouve(ctx.user.id, 'justificatif_domicile') || !docApprouve(ctx.user.id, 'document_tontine')) {
      return fail(403, 'AP-RBAC-002', "Vous n'êtes pas encore éligible à la Tontine");
    }
    var p = { id: uid('tp'), utilisateurId: ctx.user.id, statut: 'attente_cautions', montant: pal.montant, categorie: pal.categorie, position: null, signaturePhysiqueFaite: false, scanUrl: null, groupeId: null };
    DB.tontine.participants.push(p); saveDB();
    return ok({ id: p.id }, 'Inscription enregistrée', 201);
  }));
  route('GET', /^\/tontine\/cautions\/recues$/, AUTH_REQUIRED(function (ctx) {
    var list = DB.tontine.cautions.filter(function (c) { return c.garantTelephone === ctx.user.telephone && c.statut === 'invite'; });
    return ok(list.map(function (c) {
      var p = tontineParticipantById(c.participantId); var demandeur = p ? findUser(p.utilisateurId) : null;
      return { id: c.id, demandeurPrenom: demandeur ? demandeur.prenom : '', demandeurNom: demandeur ? demandeur.nom : '', demandeurTelephone: demandeur ? demandeur.telephone : '', montant: p ? p.montant : 0, categorie: p ? p.categorie : null };
    }));
  }));
  route('GET', /^\/tontine\/cautions\/signees$/, AUTH_REQUIRED(function (ctx) {
    var list = DB.tontine.cautions.filter(function (c) { return c.garantTelephone === ctx.user.telephone && c.statut === 'accepte'; });
    return ok(list.map(function (c) {
      var p = tontineParticipantById(c.participantId); var demandeur = p ? findUser(p.utilisateurId) : null;
      return { id: c.id, participantId: c.participantId, demandeurPrenom: demandeur ? demandeur.prenom : '', demandeurNom: demandeur ? demandeur.nom : '', demandeurTelephone: demandeur ? demandeur.telephone : '', montant: p ? p.montant : 0, dateSignature: c.dateSignature };
    }));
  }));
  route('POST', /^\/tontine\/cautions\/inviter$/, AUTH_REQUIRED(function (ctx) {
    var p = tontineParticipant(ctx.user.id);
    if (!p) return fail(404, 'AP-TXN-001', 'Aucune inscription en cours');
    var garants = (ctx.body.garants || []).slice(0, 4);
    if (garants.length < 4) return fail(422, 'AP-VAL-001', 'Les 4 numéros de téléphone sont obligatoires');
    garants.forEach(function (g, i) {
      DB.tontine.cautions.push({ id: uid('caut'), participantId: p.id, ordre: i + 1, garantNom: g.nom || null, garantTelephone: g.telephone, statut: 'invite', signaturePhysiqueFaite: false, scanUrl: null, dateInvitation: nowIso(), dateSignature: null });
    });
    saveDB(); return ok(null, 'Invitations envoyées', 201);
  }));
  route('POST', /^\/tontine\/cautions\/([^/]+)\/repondre$/, AUTH_REQUIRED(function (ctx) {
    var c = DB.tontine.cautions.find(function (c) { return c.id === ctx.params[0]; });
    if (!c) return fail(404, 'AP-TXN-001', 'Invitation introuvable');
    if (ctx.body.accepte) {
      if (String(ctx.body.pin) !== String(ctx.user.pin)) return fail(401, 'AP-AUTH-002', 'PIN incorrect');
      c.statut = 'accepte'; c.dateSignature = nowIso();
      tontineAdvanceAfterCautions(c.participantId);
    } else {
      c.statut = 'refuse';
    }
    saveDB(); return ok(null, ctx.body.accepte ? 'Engagement signé' : 'Invitation refusée');
  }));
  route('POST', /^\/tontine\/cautions\/([^/]+)\/remplacer$/, AUTH_REQUIRED(function (ctx) {
    var c = DB.tontine.cautions.find(function (c) { return c.id === ctx.params[0]; });
    if (!c) return fail(404, 'AP-TXN-001', 'Caution introuvable');
    c.garantTelephone = ctx.body.telephone; c.garantNom = ctx.body.nom || null; c.statut = 'invite'; c.signaturePhysiqueFaite = false; c.dateSignature = null; c.dateInvitation = nowIso();
    saveDB(); return ok(null, 'Nouvelle invitation envoyée');
  }));
  route('POST', /^\/tontine\/cotiser-maintenant$/, AUTH_REQUIRED(function (ctx) {
    var p = tontineParticipant(ctx.user.id);
    if (!p || !p.groupeId) return fail(404, 'AP-TXN-001', 'Aucune tontine active');
    var g = tontineGroupe(p.groupeId);
    if (!g) return fail(404, 'AP-TXN-001', 'Groupe introuvable');
    var tour = g.tours.find(function (t) { return t.statut === 'a_venir'; });
    if (!tour) return fail(422, 'AP-TXN-006', 'Aucun tour à venir');
    var vers = tour.versements.find(function (v) { return v.participantId === p.id; });
    if (!vers || vers.statut === 'preleve') return fail(409, 'AP-TXN-006', 'Cotisation déjà réglée');
    var pal = findPalierByMontant(p.montant);
    var montantDu = pal ? pal.versementParTour : round(p.montant * 1.05);
    var compte = findCompteByUser(ctx.user.id);
    if (!compte || compte.solde < montantDu) return fail(422, 'AP-TXN-003', 'Solde insuffisant pour régler la cotisation');
    compte.solde -= montantDu; vers.statut = 'preleve'; vers.couleur = 'vert';
    DB.transactions.push({ id: uid('t'), reference: genRef('TTV'), type: 'tontine_versement', statut: 'complete', initiateurRole: 'client', compteSourceId: compte.id, compteDestId: null, montant: montantDu, frais: 0, agentId: null, description: 'Cotisation Tontine tour ' + tour.numeroTour, dateCreation: nowIso(), dateCompletion: nowIso() });
    if (tour.versements.every(function (v) { return v.statut === 'preleve'; })) {
      tour.statut = 'verse';
      var benefP = tontineParticipantById(tour.participantId);
      var compteBenef = benefP ? findCompteByUser(benefP.utilisateurId) : null;
      if (compteBenef) {
        var gain = pal ? pal.gainParTour : p.montant * 5;
        compteBenef.solde += gain;
        DB.transactions.push({ id: uid('t'), reference: genRef('TTR'), type: 'tontine_reception', statut: 'complete', initiateurRole: 'systeme', compteSourceId: null, compteDestId: compteBenef.id, montant: gain, frais: 0, agentId: null, description: 'Réception Tontine tour ' + tour.numeroTour, dateCreation: nowIso(), dateCompletion: nowIso() });
      }
    }
    saveDB();
    return ok({ message: 'Cotisation réglée avec succès.' });
  }));

  // ── Tontine (back-office) — s'appuie sur le même état que le module client ──
  function tontineGroupePublic(g) {
    var nbDef = 0; // pas de simulation de défaillance par défaut dans ce mock
    return { id: g.id, categorie: g.categorie, numero: g.numero, statut: g.statut, montant: g.montant, nbMembres: g.membres.length, nbDefaillances: nbDef };
  }
  route('GET', /^\/admin\/tontine\/groupes$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    return ok(DB.tontine.groupes.map(tontineGroupePublic));
  })));
  route('GET', /^\/admin\/tontine\/groupes-formation$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var list = DB.tontine.groupes.filter(function (g) { return g.statut === 'formation'; });
    return ok(list.map(function (g) { return { id: g.id, categorie: g.categorie, numero: g.numero, montant: g.montant, nbMembres: g.membres.length }; }));
  })));
  route('GET', /^\/admin\/tontine\/groupe\/([^/]+)$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var g = tontineGroupe(ctx.params[0]);
    if (!g) return fail(404, 'AP-TXN-001', 'Groupe introuvable');
    var membres = g.membres.map(function (pid) {
      var p = tontineParticipantById(pid); var u = p ? findUser(p.utilisateurId) : null;
      return {
        id: pid, position: p ? p.position : null, prenom: u ? u.prenom : '', nom: u ? u.nom : '', telephone: u ? u.telephone : '',
        couleurActuelle: 'vert',
        cautions: tontineCautionsOf(pid).map(function (c) { return { id: c.id, ordre: c.ordre, statut: c.statut, garantPrenomCompte: null, garantNomCompte: null, garantNomSaisi: c.garantNom, garantTelephone: c.garantTelephone, dateSignature: c.dateSignature, dateInvitation: c.dateInvitation }; }),
      };
    });
    var tours = (g.tours || []).map(function (t) {
      var benefP = tontineParticipantById(t.participantId); var benefU = benefP ? findUser(benefP.utilisateurId) : null;
      return {
        id: t.id, numeroTour: t.numeroTour, beneficiairePrenom: benefU ? benefU.prenom : '', beneficiaireNom: benefU ? benefU.nom : '',
        statut: t.statut, datePrevue: t.datePrevue, montantTotal: g.montant * g.membres.length,
        versements: t.versements.map(function (v) {
          var vp = tontineParticipantById(v.participantId); var vu = vp ? findUser(vp.utilisateurId) : null;
          return { participantPrenom: vu ? vu.prenom : '', participantNom: vu ? vu.nom : '', couleur: v.couleur, payeParCautionId: v.payeParCautionId, statut: v.statut };
        }),
      };
    });
    return ok({ groupe: { id: g.id, categorie: g.categorie, numero: g.numero, montant: g.montant, statut: g.statut }, membres: membres, tours: tours });
  })));
  route('GET', /^\/admin\/tontine\/groupe\/([^/]+)\/signatures$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var g = tontineGroupe(ctx.params[0]);
    if (!g) return fail(404, 'AP-TXN-001', 'Groupe introuvable');
    var membres = g.membres.map(function (pid) {
      var p = tontineParticipantById(pid); var u = p ? findUser(p.utilisateurId) : null;
      return {
        id: pid, position: p ? p.position : null, prenom: u ? u.prenom : '', nom: u ? u.nom : '', telephone: u ? u.telephone : '',
        signatureFaite: !!(p && p.signaturePhysiqueFaite), scanUrl: p ? p.scanUrl : null,
        cautions: tontineCautionsOf(pid).map(function (c) { return { id: c.id, ordre: c.ordre, garantPrenomCompte: null, garantNomCompte: null, garantNomSaisi: c.garantNom, garantTelephone: c.garantTelephone, signatureFaite: !!c.signaturePhysiqueFaite, scanUrl: c.scanUrl }; }),
      };
    });
    return ok({ groupe: { categorie: g.categorie, numero: g.numero, montant: g.montant }, membres: membres });
  })));
  route('POST', /^\/admin\/tontine\/signature-physique$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var groupeConcerne = null;
    if (ctx.body.type === 'participant') {
      var p = tontineParticipantById(ctx.body.id);
      if (!p) return fail(404, 'AP-TXN-001', 'Participant introuvable');
      p.signaturePhysiqueFaite = true; p.scanUrl = ctx.body.scanUrl || p.scanUrl;
      groupeConcerne = p.groupeId ? tontineGroupe(p.groupeId) : null;
    } else {
      var c = DB.tontine.cautions.find(function (c) { return c.id === ctx.body.id; });
      if (!c) return fail(404, 'AP-TXN-001', 'Caution introuvable');
      c.signaturePhysiqueFaite = true; c.scanUrl = ctx.body.scanUrl || c.scanUrl;
      var pp = tontineParticipantById(c.participantId);
      groupeConcerne = pp && pp.groupeId ? tontineGroupe(pp.groupeId) : null;
    }
    var activee = groupeConcerne ? tontineCheckActivation(groupeConcerne) : false;
    saveDB();
    return ok({ groupeActive: !!activee });
  })));
  route('GET', /^\/admin\/tontine\/participants-non-groupes$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var list = DB.tontine.participants.filter(function (p) { return !p.groupeId; });
    return ok(list.map(function (p) {
      var u = findUser(p.utilisateurId);
      return { id: p.id, prenom: u ? u.prenom : '', nom: u ? u.nom : '', statut: p.statut, telephone: u ? u.telephone : '', categorie: p.categorie, montant: p.montant, dateInscription: nowIso(), cautions: tontineCautionsOf(p.id).map(function (c) { return { ordre: c.ordre, statut: c.statut, garantPrenomCompte: null, garantNomCompte: null, garantNomSaisi: c.garantNom, garantTelephone: c.garantTelephone, dateSignature: c.dateSignature, dateInvitation: c.dateInvitation }; }) };
    }));
  })));
  route('GET', /^\/admin\/tontine\/participants-attente-formation$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var list = DB.tontine.participants.filter(function (p) { var g = p.groupeId ? tontineGroupe(p.groupeId) : null; return g && g.statut === 'formation'; });
    return ok(list.map(function (p) {
      var u = findUser(p.utilisateurId); var g = tontineGroupe(p.groupeId);
      return { id: p.id, prenom: u ? u.prenom : '', nom: u ? u.nom : '', nbMembres: g.membres.length, telephone: u ? u.telephone : '', categorie: p.categorie, montant: p.montant, dateInscription: nowIso() };
    }));
  })));
  route('POST', /^\/admin\/tontine\/participants\/([^/]+)\/basculer$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var p = tontineParticipantById(ctx.params[0]);
    if (!p) return fail(404, 'AP-TXN-001', 'Participant introuvable');
    var pal = findPalierByMontant(ctx.body.montant);
    if (!pal) return fail(422, 'AP-VAL-001', 'Montant de palier invalide');
    if (p.groupeId) { var oldG = tontineGroupe(p.groupeId); if (oldG) oldG.membres = oldG.membres.filter(function (id) { return id !== p.id; }); }
    p.montant = pal.montant; p.categorie = pal.categorie; p.groupeId = null; p.position = null;
    tontineCautionsOf(p.id).forEach(function (c) { c.statut = 'invite'; c.signaturePhysiqueFaite = false; c.dateSignature = null; c.dateInvitation = nowIso(); });
    tontineAssignToGroupe(p);
    saveDB();
    return ok(null, 'Participant basculé et cautions réinvitées');
  })));
  route('GET', /^\/admin\/tontine\/participants-rouge$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) { return ok([]); })));
  route('GET', /^\/admin\/tontine\/bannis$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) { return ok([]); })));
  route('GET', /^\/admin\/tontine\/defaillances$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) { return ok([]); })));
  route('GET', /^\/admin\/tontine\/recherche$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var q = (ctx.query.q || '').toLowerCase();
    var list = DB.tontine.groupes.filter(function (g) {
      if (!q) return true;
      if (String(g.numero).indexOf(q) !== -1 || String(g.montant).indexOf(q) !== -1) return true;
      return g.membres.some(function (pid) {
        var p = tontineParticipantById(pid); var u = p ? findUser(p.utilisateurId) : null;
        if (!u) return false;
        return (u.nom + ' ' + u.prenom + ' ' + u.telephone).toLowerCase().indexOf(q) !== -1;
      });
    });
    return ok(list.map(tontineGroupePublic));
  })));
  route('GET', /^\/admin\/tontine\/stats$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var groupes = DB.tontine.groupes;
    var byStatut = {};
    groupes.forEach(function (g) { byStatut[g.statut] = (byStatut[g.statut] || 0) + 1; });
    var parPalier = TONTINE_PALIERS.map(function (pal) {
      var gs = groupes.filter(function (g) { return g.categorie === pal.categorie && g.montant === pal.montant; });
      var nbParticipants = gs.reduce(function (s, g) { return s + g.membres.length; }, 0);
      return { categorie: pal.categorie, montant: pal.montant, nbGroupes: gs.length, nbEnFormation: gs.filter(function (g) { return g.statut === 'formation'; }).length, nbParticipants: nbParticipants, soldeReserve: nbParticipants * pal.montant };
    });
    var totalParticipants = DB.tontine.participants.length;
    var commissionTotale = DB.transactions.filter(function (t) { return t.type === 'tontine_versement'; }).reduce(function (s, t) { var pal = null; return s; }, 0);
    return ok({
      totalParticipants: totalParticipants, tauxDefaillancePct: 0, defaillancesEnCours: 0,
      versementsTotalTraites: DB.transactions.filter(function (t) { return t.type === 'tontine_versement'; }).length,
      dureeMoyenneFormationJours: null,
      groupesParStatut: Object.keys(byStatut).map(function (s) { return { statut: s, n: byStatut[s] }; }),
      commissionTotale: 0, commissionSoldeActuel: 0,
      soldeReserveTotal: parPalier.reduce(function (s, p) { return s + p.soldeReserve; }, 0),
      parPalier: parPalier,
    });
  })));
  route('GET', /^\/tontine\/participants\/([^/]+)\/verifier$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var p = tontineParticipantById(ctx.params[0]);
    if (!p) return fail(404, 'AP-TXN-001', 'Participant introuvable');
    var u = findUser(p.utilisateurId);
    var cautions = tontineCautionsOf(p.id);
    return ok({
      participant: { prenom: u.prenom, nom: u.nom, telephone: u.telephone, categorie: p.categorie, montant: p.montant },
      empreinteRecalculee: p.id.toUpperCase().slice(0, 12),
      toutesSignees: cautions.length === 4 && cautions.every(function (c) { return c.statut === 'accepte'; }) && p.signaturePhysiqueFaite,
      cautions: cautions.map(function (c) { return { ordre: c.ordre, nom: c.garantNom, telephone: c.garantTelephone, statut: c.statut, dateSignature: c.dateSignature }; }),
    });
  })));
  route('GET', /^\/admin\/tontine\/tours-versables$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var out = [];
    DB.tontine.groupes.forEach(function (g) {
      (g.tours || []).forEach(function (t) {
        if (t.statut === 'a_venir' && t.versements.every(function (v) { return v.statut === 'preleve'; })) {
          var benefU = (function () { var bp = tontineParticipantById(t.participantId); return bp ? findUser(bp.utilisateurId) : null; })();
          out.push({ id: t.id, categorie: g.categorie, groupeNumero: g.numero, numeroTour: t.numeroTour, beneficiairePrenom: benefU ? benefU.prenom : '', beneficiaireNom: benefU ? benefU.nom : '', datePrevue: t.datePrevue, montantTotal: g.montant * g.membres.length });
        }
      });
    });
    return ok(out);
  })));
  route('POST', /^\/admin\/tontine\/tours\/([^/]+)\/verser-maintenant$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var g = null, t = null;
    DB.tontine.groupes.forEach(function (grp) { (grp.tours || []).forEach(function (tr) { if (tr.id === ctx.params[0]) { g = grp; t = tr; } }); });
    if (!t) return fail(404, 'AP-TXN-001', 'Tour introuvable');
    var benefP = tontineParticipantById(t.participantId);
    var benefU = benefP ? findUser(benefP.utilisateurId) : null;
    var compteBenef = benefP ? findCompteByUser(benefP.utilisateurId) : null;
    var pal = findPalierByMontant(g.montant);
    var gain = pal ? pal.gainParTour : g.montant * g.membres.length;
    if (compteBenef) {
      compteBenef.solde += gain;
      DB.transactions.push({ id: uid('t'), reference: genRef('TTR'), type: 'tontine_reception', statut: 'complete', initiateurRole: 'systeme', compteSourceId: null, compteDestId: compteBenef.id, montant: gain, frais: 0, agentId: null, description: 'Réception Tontine tour ' + t.numeroTour + ' (versement anticipé)', dateCreation: nowIso(), dateCompletion: nowIso() });
    }
    t.statut = 'verse'; saveDB();
    return ok({ message: 'Versement de ' + gain.toLocaleString('fr-FR') + ' F effectué à ' + (benefU ? benefU.prenom + ' ' + benefU.nom : 'le bénéficiaire') + '.' });
  })));
  route('GET', /^\/admin\/tontine\/avances$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) { return ok({ totalEnAttenteRecouvrement: 0 }); })));
  route('GET', /^\/admin\/tontine\/avances\/historique$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) { return ok([]); })));
  route('GET', /^\/admin\/tontine\/comptes-systeme$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var out = TONTINE_PALIERS.map(function (pal, i) {
      var gs = DB.tontine.groupes.filter(function (g) { return g.categorie === pal.categorie && g.montant === pal.montant; });
      var solde = gs.reduce(function (s, g) { return s + g.membres.length; }, 0) * pal.montant;
      return { id: 'cptres_' + i, prenom: 'Système', nom: 'Réserve ' + pal.categorie + ' ' + pal.montant, typeCompte: 'reserve_tontine', solde: solde };
    });
    var commissionSolde = DB.transactions.filter(function (t) { return t.type === 'tontine_versement'; }).reduce(function (s, t) { return s + round(t.montant * 0.0476); }, 0); // ~ commission incluse dans le versement (5%/1.05)
    out.push({ id: 'cptcom', prenom: 'Système', nom: 'Commission Tontine', typeCompte: 'commission_tontine', solde: commissionSolde });
    out.push({ id: 'cptav', prenom: 'Système', nom: 'Avances Tontine', typeCompte: 'avance_tontine', solde: 0 });
    return ok(out);
  })));
  route('POST', /^\/admin\/tontine\/comptes-systeme\/([^/]+)\/virer$/, AUTH_REQUIRED(ROLES(['admin'], function (ctx) {
    return ok({ message: 'Virement de ' + Number(ctx.body.montant || 0).toLocaleString('fr-FR') + ' F envoyé au ' + (ctx.body.telephoneDestinataire || '') + '.' });
  })));
  route('POST', /^\/admin\/tontine\/commission\/virer$/, AUTH_REQUIRED(ROLES(['admin'], function (ctx) {
    return ok({ message: 'Virement de ' + Number(ctx.body.montant || 0).toLocaleString('fr-FR') + ' F effectué vers votre compte personnel.' });
  })));
  route('GET', /^\/tontine\/participants\/([^/]+)\/attestation$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var p = tontineParticipantById(ctx.params[0]);
    if (!p) return fail(404, 'AP-TXN-001', 'Participant introuvable');
    var u = findUser(p.utilisateurId);
    var cautions = tontineCautionsOf(p.id);
    if (cautions.length < 4 || !cautions.every(function (c) { return c.statut === 'accepte'; })) return fail(422, 'AP-TXN-006', 'Les 4 cautions ne sont pas toutes signées');
    var texte = 'ATTESTATION MANIPAY TONTINE\n\nParticipant : ' + u.prenom + ' ' + u.nom + ' (' + u.telephone + ')\nPalier : ' + p.categorie + ' — ' + p.montant.toLocaleString('fr-FR') + ' FCFA\n\nCautions signées :\n' + cautions.map(function (c) { return '  ' + c.ordre + '. ' + (c.garantNom || c.garantTelephone) + ' — signé le ' + (c.dateSignature || '—'); }).join('\n') + '\n\nDocument généré en mode démo (mock-api.js).';
    return { status: 200, __blob: true, contentType: 'text/plain;charset=utf-8', content: texte };
  })));

  // ── Admin ──
  function statutsAlertes(pred) { return DB.alertes.filter(pred).length; }
  route('GET', /^\/admin\/overview$/, AUTH_REQUIRED(ROLES(['admin', 'superviseur'], function (ctx) {
    var totalCommissions = DB.commissions.reduce(function (s, c) { return s + c.montant; }, 0);
    return ok({ users: DB.users.length, txns: DB.transactions.length, totalCommissions: totalCommissions, alertes: statutsAlertes(function (a) { return a.statut === 'ouverte'; }) });
  })));
  route('GET', /^\/admin\/logs$/, AUTH_REQUIRED(ROLES(['admin', 'superviseur'], function (ctx) {
    var list = DB.logsAudit.slice().sort(function (a, b) { return new Date(b.dateAction) - new Date(a.dateAction); });
    return ok(list.map(function (l) { var u = l.utilisateurId ? findUser(l.utilisateurId) : null; var o = clone(l); o.utilisateur = u ? { nom: u.nom, prenom: u.prenom, telephone: u.telephone, role: u.role } : null; return o; }));
  })));
  route('GET', /^\/admin\/users\/search$/, AUTH_REQUIRED(function (ctx) {
    var q = (ctx.query.q || '').replace(/\s+/g, '');
    var list = DB.users.filter(function (u) { return u.telephone.indexOf(q) !== -1; });
    return ok({ users: list.map(function (u) { return { id: u.id, prenom: u.prenom, nom: u.nom, role: u.role }; }) });
  }));
  route('GET', /^\/admin\/users\/([^/]+)\/code-documents-status$/, AUTH_REQUIRED(function (ctx) {
    var u = findUser(ctx.params[0]);
    return ok({ configure: !!(u && u.codeDocuments), bloque: !!(u && u.codeDocAttempts >= 5) });
  }));
  route('POST', /^\/admin\/users\/([^/]+)\/code-documents\/debloquer$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]); if (u) { u.codeDocAttempts = 0; saveDB(); }
    return ok(null, 'Verrou levé');
  })));
  route('POST', /^\/admin\/users\/([^/]+)\/code-documents\/reset$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUser(ctx.params[0]); if (u) { u.codeDocuments = null; u.codeDocAttempts = 0; saveDB(); }
    return ok(null, 'Code réinitialisé');
  })));
  // Profil / suspension / suppression (back-office)
  route('PATCH', /^\/users\/([^/]+)\/profile$/, AUTH_REQUIRED(function (ctx) {
    var u = findUser(ctx.params[0]);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    if (ctx.body.prenom) u.prenom = ctx.body.prenom;
    if (ctx.body.nom) u.nom = ctx.body.nom;
    if (ctx.body.telephone) u.telephone = ctx.body.telephone;
    saveDB(); return ok(userPublic(u, false), 'Profil mis à jour');
  }));
  route('DELETE', /^\/users\/([^/]+)$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    DB.users = DB.users.filter(function (u) { return u.id !== ctx.params[0]; });
    DB.comptes = DB.comptes.filter(function (c) { return c.utilisateurId !== ctx.params[0]; });
    saveDB(); return ok(null, 'Compte supprimé');
  })));
  route('GET', /^\/users\/([^/]+)\/network-stats$/, AUTH_REQUIRED(function (ctx) {
    var u = findUser(ctx.params[0]); var compte = u ? findCompteByUser(u.id) : null;
    var mine = compte ? DB.transactions.filter(function (t) { return t.compteSourceId === compte.id || t.compteDestId === compte.id; }) : [];
    function agg(pred) { var f = mine.filter(pred); return { n: f.length, vol: f.reduce(function (s, t) { return s + t.montant; }, 0) }; }
    var depots = agg(function (t) { return t.type === 'depot' && t.compteDestId === compte.id; });
    var retraits = agg(function (t) { return t.type === 'retrait' && t.compteSourceId === compte.id; });
    var trfEnv = agg(function (t) { return t.type === 'transfert' && t.compteSourceId === compte.id; });
    var trfRec = agg(function (t) { return t.type === 'transfert' && t.compteDestId === compte.id; });
    return ok({ solde: compte ? compte.solde : 0, nbDepots: depots.n, volDepots: depots.vol, nbRetraits: retraits.n, volRetraits: retraits.vol, nbTrfEnv: trfEnv.n, volTrfEnv: trfEnv.vol, nbTrfRec: trfRec.n, volTrfRec: trfRec.vol });
  }));
  route('GET', /^\/users\/([^/]+)\/transactions$/, AUTH_REQUIRED(function (ctx) {
    var u = findUser(ctx.params[0]); var compte = u ? findCompteByUser(u.id) : null;
    var list = compte ? DB.transactions.filter(function (t) { return t.compteSourceId === compte.id || t.compteDestId === compte.id; }) : [];
    list = list.slice().sort(function (a, b) { return new Date(b.dateCreation) - new Date(a.dateCreation); });
    var limit = parseInt(ctx.query.limit || '50', 10);
    return ok(list.slice(0, limit).map(txPublic));
  }));
  route('GET', /^\/superviseurs$/, AUTH_REQUIRED(ROLES(['admin', 'superviseur'], function (ctx) {
    var sups = DB.users.filter(function (u) { return u.role === 'superviseur'; });
    return ok(sups.map(function (s) { return { id: s.id, prenom: s.prenom, nom: s.nom, telephone: s.telephone, statut: s.statut, type: 'general', masters: [] }; }));
  })));
  // ── Sécurité (mode démo : pas de suivi dédié appareils/refus, on renvoie
  // des agrégats simples dérivés des données existantes) ──
  route('GET', /^\/securite\/profil$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var u = findUserByTel(ctx.query.telephone);
    if (!u) return fail(404, 'AP-USR-002', 'Aucun compte trouvé pour ce numéro.');
    var compte = findCompteByUser(u.id);
    var mine = compte ? DB.transactions.filter(function (t) { return t.compteSourceId === compte.id || t.compteDestId === compte.id; }) : [];
    function vol(type, side) { return mine.filter(function (t) { return t.type === type && t[side] === compte.id; }).reduce(function (s, t) { return s + t.montant; }, 0); }
    return ok({
      identite: { prenom: u.prenom, nom: u.nom, nomCommercial: u.nomCommercial || null, telephone: u.telephone, role: u.role, statut: u.statut, kycNiveau: u.kycNiveau, createdAt: u.createdAt, codeParrainage: u.codeParrainage },
      nbAppareils: 1, nbFilleuls: DB.users.filter(function (x) { return x.parrainId === u.id; }).length,
      refusCommeClient: { n: 0 }, refusCommeOperateur: { n: 0 },
      volumes: { depot: vol('depot', 'compteDestId'), retrait: vol('retrait', 'compteSourceId'), transfert: vol('transfert', 'compteSourceId'), paiementEnvoye: vol('paiement_marchand', 'compteSourceId'), paiementRecu: vol('paiement_marchand', 'compteDestId') },
    });
  })));
  route('GET', /^\/securite\/refus-stats$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    return ok({ clients: [], totalClients: 0, hasMoreClients: false, operateurs: [], totalOperateurs: 0, hasMoreOperateurs: false });
  })));
  route('GET', /^\/securite\/appareils-stats$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    return ok({ comptes: [], totalComptes: 0, hasMore: false });
  })));
  // ── Notifications (back-office) ──
  route('GET', /^\/notifications\/unread-count$/, AUTH_REQUIRED(function (ctx) {
    return ok({ count: DB.notifications.filter(function (n) { return n.utilisateurId === ctx.user.id && n.statut !== 'lu'; }).length });
  }));
  route('GET', /^\/notifications\/user\/([^/]+)$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var list = DB.notifications.filter(function (n) { return n.utilisateurId === ctx.params[0]; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return { status: 200, body: { success: true, notifications: list.map(notifPublic), timestamp: nowIso() } };
  })));
  route('GET', /^\/notifications\/all$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var list = DB.notifications.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (ctx.query.type) list = list.filter(function (n) { return n.type === ctx.query.type; });
    if (ctx.query.lu) list = list.filter(function (n) { return (n.statut === 'lu') === (ctx.query.lu === 'true'); });
    var offset = parseInt(ctx.query.offset || '0', 10), limit = parseInt(ctx.query.limit || '30', 10);
    var out = list.slice(offset, offset + limit).map(function (n) {
      var u = findUser(n.utilisateurId); var o = notifPublic(n);
      o.prenom = u ? u.prenom : ''; o.nom = u ? u.nom : ''; o.telephone = u ? u.telephone : ''; o.role = u ? u.role : '';
      return o;
    });
    return ok({ notifications: out, total: list.length });
  })));
  route('POST', /^\/notifications\/direct$/, AUTH_REQUIRED(function (ctx) {
    if (!ctx.body.userId || !ctx.body.titre || !ctx.body.message) return fail(422, 'AP-VAL-001', 'userId, titre et message requis');
    addNotification(ctx.body.userId, ctx.body.type || 'systeme', ctx.body.titre, ctx.body.message, null); saveDB();
    return ok(null, 'Notification envoyée', 201);
  }));
  route('POST', /^\/notifications\/masse$/, AUTH_REQUIRED(function (ctx) {
    var roles = ctx.body.roles || [];
    var cibles = DB.users.filter(function (u) { return roles.indexOf(u.role) !== -1; });
    cibles.forEach(function (u) { addNotification(u.id, 'systeme', ctx.body.titre, ctx.body.message, null); });
    saveDB(); return ok({ total: cibles.length }, 'Campagne envoyée', 201);
  }));
  route('POST', /^\/notifications\/multi$/, AUTH_REQUIRED(function (ctx) {
    var ids = ctx.body.userIds || [];
    if (ctx.body.telephones) { ctx.body.telephones.forEach(function (tel) { var u = findUserByTel(tel); if (u) ids.push(u.id); }); }
    ids.forEach(function (id) { addNotification(id, 'systeme', ctx.body.titre, ctx.body.message, null); });
    saveDB(); return ok({ total: ids.length }, 'Notifications envoyées', 201);
  }));
  route('DELETE', /^\/notifications\/bulk$/, AUTH_REQUIRED(function (ctx) {
    if (ctx.body.ids) { DB.notifications = DB.notifications.filter(function (n) { return ctx.body.ids.indexOf(n.id) === -1; }); }
    else if (ctx.body.partout) { DB.notifications = DB.notifications.filter(function (n) { return !(n.titre === ctx.body.titre && n.message === ctx.body.message); }); }
    saveDB(); return ok(null, 'Notifications supprimées');
  }));
  route('DELETE', /^\/notifications\/user\/([^/]+)$/, AUTH_REQUIRED(function (ctx) {
    DB.notifications = DB.notifications.filter(function (n) { return n.utilisateurId !== ctx.params[0]; }); saveDB();
    return ok(null, 'Notifications supprimées');
  }));
  route('DELETE', /^\/notifications\/([^/]+)$/, AUTH_REQUIRED(function (ctx) {
    DB.notifications = DB.notifications.filter(function (n) { return n.id !== ctx.params[0]; }); saveDB();
    return ok(null, 'Notification supprimée');
  }));
  route('GET', /^\/notif-campagnes$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) { return ok({ campagnes: [] }); })));
  // ── Tech (aucune erreur en mode démo) ──
  route('GET', /^\/tech\/logs$/, AUTH_REQUIRED(ROLES(['admin', 'superviseur'], function (ctx) { return ok([]); })));
  route('GET', /^\/tech\/history$/, AUTH_REQUIRED(ROLES(['admin', 'superviseur'], function (ctx) { return ok([]); })));
  route('GET', /^\/health$/, function (ctx) {
    return { status: 200, body: { db: true, notifications: true, sms: true, email: true, storage: true } };
  });
  // ── Rattachements (dérivés du lien parrainId déjà présent sur chaque compte) ──
  route('GET', /^\/admin\/rattachements$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var out = [];
    DB.users.forEach(function (u) {
      if (!u.parrainId) return;
      var p = findUser(u.parrainId); if (!p) return;
      out.push({ parrainId: p.id, parrainPrenom: p.prenom, parrainNom: p.nom, parrainTelephone: p.telephone, parrainRole: p.role, filleulId: u.id, filleulPrenom: u.prenom, filleulNom: u.nom, filleulTelephone: u.telephone, filleulKyc: u.kycNiveau, statut: 'valide', dateEntree: u.createdAt });
    });
    return ok({ rattachements: out });
  })));
  route('GET', /^\/admin\/rattachements\/non-rattaches$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) { return ok({ utilisateurs: [] }); })));
  route('POST', /^\/admin\/rattachements\/rattacher$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var f = findUser(ctx.body.filleulId);
    if (!f) return fail(404, 'AP-USR-002', 'Filleul introuvable');
    if (f.parrainId && f.parrainId !== ctx.body.parrainId && !ctx.body.force) {
      var ancien = findUser(f.parrainId);
      return { status: 409, body: { success: false, warning: true, message: 'Ce filleul est déjà rattaché à un autre parrain' + (ancien ? ' (' + ancien.prenom + ' ' + ancien.nom + ')' : '') + '.', timestamp: nowIso() } };
    }
    f.parrainId = ctx.body.parrainId; saveDB();
    return { status: 200, body: { success: true, message: 'Rattachement effectué', timestamp: nowIso() } };
  })));
  route('POST', /^\/admin\/rattachements\/detacher$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var f = findUser(ctx.body.filleulId); if (f) { f.parrainId = null; saveDB(); }
    return ok(null, 'Filleul détaché');
  })));
  // ── Segmentation (filtre générique sur les critères les plus courants) ──
  route('POST', /^\/admin\/segmentation$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var b = ctx.body;
    var list = DB.users.filter(function (u) {
      if (b.roles && b.roles.length && b.roles.indexOf(u.role) === -1) return false;
      if (b.kycNiveaux && b.kycNiveaux.length && b.kycNiveaux.indexOf(u.kycNiveau) === -1) return false;
      if (b.statuts && b.statuts.length && b.statuts.indexOf(u.statut) === -1) return false;
      if (b.zones && b.zones.length && b.zones.indexOf(u.zone) === -1) return false;
      var compte = findCompteByUser(u.id);
      if (b.soldeMin != null && (!compte || compte.solde < b.soldeMin)) return false;
      if (b.soldeMax != null && compte && compte.solde > b.soldeMax) return false;
      return true;
    });
    var out = list.map(function (u) {
      var compte = findCompteByUser(u.id);
      return { id: u.id, role: u.role, prenom: u.prenom, nom: u.nom, telephone: u.telephone, nbFilleuls: DB.users.filter(function (x) { return x.parrainId === u.id; }).length, volumes: { depot: 0, retrait: 0, transfert: 0, paiementEnvoye: 0, paiementRecu: 0 }, solde: compte ? compte.solde : 0, gainsParrainage: DB.commissions.filter(function (c) { return c.beneficiaireId === u.id; }).reduce(function (s, c) { return s + c.montant; }, 0), tontine: { participe: !!tontineParticipant(u.id), couleur: 'vert', categorie: null, banni: false } };
    });
    return ok({ utilisateurs: out });
  })));
  // ── Stats détaillées / analytics (simplifiées, dérivées des données existantes) ──
  route('GET', /^\/stats\/detailed$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var role = ctx.query.role || 'agent';
    var users = DB.users.filter(function (u) { return u.role === role; });
    var out = users.map(function (u) {
      var compte = findCompteByUser(u.id);
      return { id: u.id, prenom: u.prenom, nom: u.nom, telephone: u.telephone, zone: u.zone, statut: u.statut, stats: { depot_effectue: { n: 0, vol: 0 }, retrait_effectue: { n: 0, vol: 0 }, transfert_envoye: { n: 0, vol: 0 }, transfert_recu: { n: 0, vol: 0 } } };
    });
    return ok({ total_users: users.length, total_actifs: users.filter(function (u) { return u.statut === 'actif'; }).length, totaux: { depot_effectue: { n: 0, vol: 0 }, retrait_effectue: { n: 0, vol: 0 }, transfert_envoye: { n: 0, vol: 0 }, transfert_recu: { n: 0, vol: 0 } }, courbe: [], users: out });
  })));
  route('GET', /^\/flux\/analytics$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    function agg(type) { var f = DB.transactions.filter(function (t) { return t.type === type && t.statut === 'complete'; }); var vol = f.reduce(function (s, t) { return s + t.montant; }, 0); return { n: f.length, vol: vol, avg: f.length ? round(vol / f.length) : 0, evol_vol: 0 }; }
    return ok({ courbe: [], transferts: [], depots: { tous: agg('depot'), master: { n: 0, vol: 0, avg: 0, evol_vol: 0 }, mini_master: { n: 0, vol: 0, avg: 0, evol_vol: 0 }, agent: agg('depot') }, retraits: { tous: agg('retrait'), master: { n: 0, vol: 0, avg: 0, evol_vol: 0 }, mini_master: { n: 0, vol: 0, avg: 0, evol_vol: 0 }, agent: agg('retrait') }, paiements: agg('paiement_marchand'), business2business: { n: 0, vol: 0, avg: 0, evol_vol: 0 } });
  })));
  route('GET', /^\/admin\/gains-systeme$/, AUTH_REQUIRED(ROLES(['admin'], function (ctx) {
    var gainsRetrait = DB.commissions.filter(function (c) { return c.typeCommission === 'retrait_agent'; });
    return ok({
      maniPay: {
        pnl: { gains_retrait: gainsRetrait.reduce(function (s, c) { return s + c.montant; }, 0), gains_retrait_nb: gainsRetrait.length, gains_paiement: 0, gains_paiement_nb: 0, commissions_journalieres: 0, commissions_journalieres_nb: 0, commissions_parrainage: DB.commissions.filter(function (c) { return c.typeCommission === 'parrainage_direct'; }).reduce(function (s, c) { return s + c.montant; }, 0), commissions_parrainage_nb: 0, commissions_reseau: 0, commissions_reseau_nb: 0 },
        totalVirements: 0, periodes: { aujourdhui: { total: 0, nb: 0, vs: null }, semaine: { total: 0, nb: 0, vs: null }, mois: { total: 0, nb: 0, vs: null }, annee: { total: 0, nb: 0, vs: null }, total: { total: 0, nb: 0 } },
        parType: [], virements: [], courbe: [],
      },
      utilisateurs: { periodes: { aujourdhui: { total: 0, nb: 0, vs: null }, semaine: { total: 0, nb: 0, vs: null }, mois: { total: 0, nb: 0, vs: null }, annee: { total: 0, nb: 0, vs: null }, total: { total: 0, nb: 0 } }, courbeParRole: [], parRoleType: [], courbeParRoleType: [] },
    });
  })));
  route('GET', /^\/admin\/inscriptions$/, AUTH_REQUIRED(ROLES(['admin', 'superviseur'], function (ctx) {
    var counts = { master: 0, mini_master: 0, agent: 0, client: 0 };
    DB.users.forEach(function (u) { if (counts[u.role] != null) counts[u.role]++; });
    var list = DB.users.slice();
    if (ctx.query.role) list = list.filter(function (u) { return u.role === ctx.query.role; });
    list = list.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return ok({ counts: counts, inscriptions: list.map(function (u) { var p = u.parrainId ? findUser(u.parrainId) : null; return { id: u.id, prenom: u.prenom, nom: u.nom, role: u.role, telephone: u.telephone, parrainPrenom: p ? p.prenom : null, parrainNom: p ? p.nom : null, createdAt: u.createdAt }; }) });
  })));
  // ── Transactions (actions admin) ──
  route('PATCH', /^\/transactions\/([^/]+)\/status$/, AUTH_REQUIRED(ROLES(['admin', 'superviseur'], function (ctx) {
    var t = DB.transactions.find(function (t) { return t.id === ctx.params[0]; });
    if (!t) return fail(404, 'AP-TXN-001', 'Transaction introuvable');
    t.statut = ctx.body.statut === 'completee' ? 'complete' : ctx.body.statut; saveDB();
    return ok(txPublic(t), 'Transaction mise à jour');
  })));
  route('GET', /^\/admin\/transactions\/remboursables$/, AUTH_REQUIRED(ROLES(['superviseur', 'admin'], function (ctx) {
    var jours = Math.min(parseInt(ctx.query.jours || '7', 10), 999);
    var seuil = new Date(Date.now() - jours * 86400000);
    var list = DB.transactions.filter(function (t) { return ['depot', 'transfert'].indexOf(t.type) !== -1 && t.statut === 'complete' && new Date(t.dateCreation) >= seuil; });
    return ok(list.map(function (t) {
      var cs = t.compteSourceId ? findCompte(t.compteSourceId) : null, cd = t.compteDestId ? findCompte(t.compteDestId) : null;
      var us = cs ? findUser(cs.utilisateurId) : null, ud = cd ? findUser(cd.utilisateurId) : null;
      return { id: t.id, type: t.type, reference: t.reference, montant: t.montant, dateCreation: t.dateCreation, telSrc: us ? us.telephone : null, telDst: ud ? ud.telephone : null, prenomSrc: us ? us.prenom : null, nomSrc: us ? us.nom : null, prenomDst: ud ? ud.prenom : null, nomDst: ud ? ud.nom : null, rembourse: t.statut === 'rembourse' };
    }));
  })));
  route('POST', /^\/admin\/transactions\/([^/]+)\/rembourser$/, AUTH_REQUIRED(function (ctx) {
    var t = DB.transactions.find(function (t) { return t.id === ctx.params[0]; });
    if (!t) return fail(404, 'AP-TXN-001', 'Transaction introuvable');
    var cs = findCompte(t.compteSourceId), cd = t.compteDestId ? findCompte(t.compteDestId) : null;
    if (cs) cs.solde += t.montant; if (cd) cd.solde -= t.montant;
    t.statut = 'rembourse';
    DB.transactions.push({ id: uid('t'), reference: genRef('REM'), type: 'remboursement', statut: 'complete', initiateurRole: 'systeme', compteSourceId: t.compteDestId, compteDestId: t.compteSourceId, montant: t.montant, frais: 0, agentId: null, description: ctx.body.motif || 'Remboursement', dateCreation: nowIso(), dateCompletion: nowIso() });
    saveDB();
    return ok({ message: 'Remboursement effectué', reference: t.reference });
  }));
  route('POST', /^\/transactions\/refund$/, AUTH_REQUIRED(function (ctx) {
    var u = findUser(ctx.body.userId);
    if (!u) return fail(404, 'AP-USR-002', 'Utilisateur introuvable');
    var compte = findCompteByUser(u.id);
    var t = ctx.body.transactionId ? DB.transactions.find(function (t) { return t.id === ctx.body.transactionId; }) :
      DB.transactions.filter(function (t) { return t.type === 'transfert' && (t.compteSourceId === (compte && compte.id) || t.compteDestId === (compte && compte.id)) && t.statut === 'complete'; }).sort(function (a, b) { return new Date(b.dateCreation) - new Date(a.dateCreation); })[0];
    if (!t) return fail(404, 'AP-TXN-001', 'Aucune transaction remboursable trouvée');
    var cs = findCompte(t.compteSourceId), cd = t.compteDestId ? findCompte(t.compteDestId) : null;
    if (cs) cs.solde += t.montant; if (cd) cd.solde -= t.montant;
    t.statut = 'rembourse';
    var ref = genRef('REM');
    DB.transactions.push({ id: uid('t'), reference: ref, type: 'remboursement', statut: 'complete', initiateurRole: 'systeme', compteSourceId: t.compteDestId, compteDestId: t.compteSourceId, montant: t.montant, frais: 0, agentId: null, description: 'Remboursement', dateCreation: nowIso(), dateCompletion: nowIso() });
    saveDB();
    return ok({ reference: ref }, 'Remboursement effectué');
  }));
  route('POST', /^\/admin\/manipay\/virer$/, AUTH_REQUIRED(ROLES(['admin'], function (ctx) {
    return ok({ message: 'Virement de ' + Number(ctx.body.montant || 0).toLocaleString('fr-FR') + ' F effectué vers votre compte personnel.' });
  })));

  // ═════════════════════ Repli générique ═════════════════════════════
  // Pour tout endpoint non explicitement simulé ci-dessus (notamment les
  // dizaines de routes très spécifiques du back-office) : on répond un
  // succès "vide" plausible plutôt que de faire planter l'écran. Ça
  // garantit qu'aucune fonctionnalité ne bloque sur "Failed to fetch",
  // même si la donnée renvoyée n'est pas toujours réaliste.
  function genericFallback(method, path, query) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[mock-api] route non explicitement simulée :', method, path);
    }
    if (method === 'GET') {
      // Beaucoup de listes du back-office suivent une convention
      // "collection filtrée par utilisateur/rôle/statut" — on renvoie les
      // entités les plus proches déjà connues quand c'est reconnaissable,
      // sinon une liste vide paginée.
      if (/\/logs$|\/history$/.test(path)) return ok([]);
      return paginate([], query || {});
    }
    return ok({}, 'Action simulée (mode démo)');
  }

  function matchRoute(method, path) {
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      if (r.method !== method) continue;
      var m = r.pattern.exec(path);
      if (m) return { handler: r.handler, params: m.slice(1) };
    }
    return null;
  }

  function dispatch(method, path, query, body, headers) {
    var user = userFromAuthHeader(headers);
    var match = matchRoute(method, path);
    if (!match) return genericFallback(method, path, query);
    var ctx = { user: user, params: match.params, query: query || {}, body: body || {}, path: path };
    try {
      return match.handler(ctx);
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error('[mock-api] erreur handler', path, e);
      return fail(500, 'AP-SYS-001', e && e.message ? e.message : 'Erreur interne (mode démo)');
    }
  }

  function parseQuery(str) {
    var q = {};
    (str || '').split('&').filter(Boolean).forEach(function (pair) {
      var kv = pair.split('=');
      q[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    });
    return q;
  }
  function headersToObject(h) {
    var out = {};
    if (!h) return out;
    if (typeof Headers !== 'undefined' && h instanceof Headers) {
      h.forEach(function (v, k) { out[k.toLowerCase()] = v; });
    } else {
      Object.keys(h).forEach(function (k) { out[k.toLowerCase()] = h[k]; });
    }
    return out;
  }

  // ───────────────────── Interception de fetch ───────────────────────
  window.fetch = function (input, init) {
    init = init || {};
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    var marker = '/api/v1';
    var idx = url.indexOf(marker);
    if (idx === -1) {
      // Pas notre API (polices, Cloudinary, jsQR, WhatsApp...) → réseau réel.
      return ORIG_FETCH(input, init);
    }
    var after = url.slice(idx + marker.length);
    var qIdx = after.indexOf('?');
    var path = qIdx === -1 ? after : after.slice(0, qIdx);
    var query = parseQuery(qIdx === -1 ? '' : after.slice(qIdx + 1));
    var method = (init.method || 'GET').toUpperCase();
    var headers = headersToObject(init.headers);
    var body = null;
    if (init.body) {
      try { body = JSON.parse(init.body); } catch (e) { body = init.body; }
    }

    return new Promise(function (resolve) {
      setTimeout(function () {
        var result;
        try { result = dispatch(method, path, query, body, headers); }
        catch (e) { result = fail(500, 'AP-SYS-001', 'Erreur interne (mode démo)'); }
        if (result.__blob) {
          resolve(new Response(new Blob([result.content], { type: result.contentType || 'text/plain' }), { status: result.status }));
        } else {
          resolve(new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } }));
        }
      }, 220); // léger délai pour un ressenti réseau réaliste
    });
  };

  // ───────────────────────── Bandeau "mode démo" ─────────────────────
  function injectBanner() {
    try {
      if (document.getElementById('__manipay_demo_banner')) return;
      var b = document.createElement('div');
      b.id = '__manipay_demo_banner';
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999999;background:#0f172a;color:#fff;font:600 11px/1.5 -apple-system,sans-serif;padding:7px 12px;text-align:center;box-shadow:0 -2px 10px rgba(0,0,0,.15)';
      b.innerHTML = '🧪 Mode démo — application connectée à des données simulées dans ce navigateur (aucun serveur réel) · '
        + '<span id="__manipay_reset_demo" style="text-decoration:underline;cursor:pointer">Réinitialiser les données</span>';
      document.body.appendChild(b);
      document.getElementById('__manipay_reset_demo').onclick = function () {
        try { localStorage.removeItem(DB_KEY); localStorage.removeItem('mani_token'); localStorage.removeItem('mani_refresh'); localStorage.removeItem('mani_user'); } catch (e) {}
        location.reload();
      };
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    injectBanner();
  }

  window.__manipayMock = { DB: DB, saveDB: saveDB, TAUX: TAUX };
})();
