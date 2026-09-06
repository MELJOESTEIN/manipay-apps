/* ManiPay — jeu d'icônes
   Tracés SVG en stroke, viewBox 0 0 24 24, épaisseur 1,7 (charte, section « Icônes »).
   Usage :  ic('envoyer')            → 20px, couleur héritée (currentColor)
            ic('envoyer', 24)        → 24px
            ic('envoyer', 24, '#fff')→ 24px, couleur forcée
   Partagé par les six applications ManiPay. */
(function (root) {
  'use strict';

  var P = {
    /* ─ Navigation et actions ─ */
    'fleche-gauche':  '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    'fleche-droite':  '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'fleche-haut':    '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    'fleche-bas':     '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    'retour':         '<path d="m9 14-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/>',
    'chevron-droite': '<path d="m9 18 6-6-6-6"/>',
    'fermer':         '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'plus':           '<path d="M12 5v14"/><path d="M5 12h14"/>',
    'effacer':        '<path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m16 9-5 6"/><path d="m11 9 5 6"/>',
    'valider':        '<path d="m4 12 5.5 5.5L20 7"/>',
    'point':          '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',

    /* ─ Argent ─ */
    'envoyer':        '<path d="M12 19V6"/><path d="m5.5 12.5 6.5-7 6.5 7"/><path d="M4 21h16"/>',
    'recevoir':       '<path d="M12 5v13"/><path d="m5.5 11.5 6.5 7 6.5-7"/><path d="M4 3h16"/>',
    'depot':          '<path d="M12 4v9"/><path d="m8.5 9.5 3.5 3.5 3.5-3.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    'retrait':        '<path d="M12 13V4"/><path d="m8.5 7.5 3.5-3.5 3.5 3.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    'transfert':      '<path d="M4 8h13"/><path d="m14 5 3 3-3 3"/><path d="M20 16H7"/><path d="m10 13-3 3 3 3"/>',
    'portefeuille':   '<path d="M3 8a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5"/><circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none"/>',
    'billet':         '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
    'carte':          '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h3"/>',
    'gains':          '<path d="M4 19h16"/><path d="M7 19v-6"/><path d="M12 19V8"/><path d="M17 19v-9"/><path d="m14.5 6 3-3 3 3"/>',
    'facture':        '<path d="M5 3.5 6.5 5 8 3.5 9.5 5 11 3.5 12.5 5 14 3.5 15.5 5 17 3.5v17L15.5 19 14 20.5 12.5 19 11 20.5 9.5 19 8 20.5 6.5 19 5 20.5Z"/><path d="M8.5 9h7"/><path d="M8.5 13h4"/>',

    /* ─ Personnes et identité ─ */
    'profil':         '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    'contacts':       '<circle cx="9.5" cy="9" r="3.2"/><path d="M3 19a6.5 6.5 0 0 1 13 0"/><path d="M17 8.2a3 3 0 0 1 0 5.6"/><path d="M18.5 19a5.5 5.5 0 0 0-2-4.3"/>',
    'piece-identite': '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5 16.5a3.8 3.8 0 0 1 7 0"/><path d="M14.5 10h4"/><path d="M14.5 14h3"/>',
    'selfie':         '<path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10.5" r="2.4"/><path d="M8.2 16.6a4.2 4.2 0 0 1 7.6 0"/>',
    'poignee-main':   '<path d="M12 3.2 5 6v5.4c0 4.2 2.8 7.6 7 9.4 4.2-1.8 7-5.2 7-9.4V6Z"/><circle cx="12" cy="10.2" r="2.1"/><path d="M8.6 16.4a3.7 3.7 0 0 1 6.8 0"/>',
    'parrainage':     '<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M18 6v6"/><path d="M15 9h6"/>',

    /* ─ Sécurité ─ */
    'cadenas':        '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15.2" r="1.3" fill="currentColor" stroke="none"/>',
    'code-secret':    '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><path d="M12 13.6v3.2"/><path d="m10.6 14.4 2.8 1.6"/><path d="m13.4 14.4-2.8 1.6"/>',
    'cle':            '<circle cx="8" cy="15.5" r="3.5"/><path d="m10.6 13 8-8"/><path d="m15.5 8 2.2 2.2"/><path d="m18.2 5.3 2.3 2.3"/>',
    'bouclier':       '<path d="M12 3.2 5 6v5.4c0 4.2 2.8 7.6 7 9.4 4.2-1.8 7-5.2 7-9.4V6Z"/>',
    'bouclier-ok':    '<path d="M12 3.2 5 6v5.4c0 4.2 2.8 7.6 7 9.4 4.2-1.8 7-5.2 7-9.4V6Z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
    'oeil':           '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    'oeil-barre':     '<path d="M4 4.5 20 19.5"/><path d="M9.6 6.3A9.4 9.4 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.3 3.9"/><path d="M6.4 8.3A16 16 0 0 0 2.5 12S6 18 12 18a9.2 9.2 0 0 0 3.2-.6"/><path d="M9.9 10.2a2.8 2.8 0 0 0 3.9 3.9"/>',

    /* ─ Statuts ─ */
    'succes':         '<circle cx="12" cy="12" r="8.8"/><path d="m8.2 12 2.6 2.6 5-5.2"/>',
    'erreur':         '<circle cx="12" cy="12" r="8.8"/><path d="m9.2 9.2 5.6 5.6"/><path d="m14.8 9.2-5.6 5.6"/>',
    'attente':        '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.2 1.9"/>',
    'alerte':         '<path d="M12 4.2 2.8 20h18.4Z"/><path d="M12 10v4"/><circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none"/>',
    'info':           '<circle cx="12" cy="12" r="8.8"/><path d="M12 11.4v5"/><circle cx="12" cy="8.2" r="1" fill="currentColor" stroke="none"/>',
    'case-vide':      '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/>',
    'case-cochee':    '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
    'annule':         '<circle cx="12" cy="12" r="8.8"/><path d="m6.5 17.5 11-11"/>',
    'rembourse':      '<path d="M20 11.5a8 8 0 1 0-2.4 5.7"/><path d="M20 6.5v5h-5"/>',

    /* ─ Communication ─ */
    'cloche':         '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z"/><path d="M13.7 19a2 2 0 0 1-3.4 0"/>',
    'message':        '<path d="M20.5 11.8a7.7 7.7 0 0 1-8.3 7.7L5 21l1.6-4.2a7.7 7.7 0 1 1 13.9-5Z"/>',
    'megaphone':      '<path d="m3.5 11 12-6v14l-12-6Z"/><path d="M3.5 9.5h-.2A1.3 1.3 0 0 0 2 10.8v.4a1.3 1.3 0 0 0 1.3 1.3h.2"/><path d="M18 8.5a4 4 0 0 1 0 7"/><path d="M7 13.5V18a1.5 1.5 0 0 0 3 0v-3.5"/>',
    'telephone':      '<path d="M6.2 3.5h3l1.5 4-1.9 1.4a12.5 12.5 0 0 0 5.3 5.3l1.4-1.9 4 1.5v3a1.8 1.8 0 0 1-2 1.8A16 16 0 0 1 4.4 5.5a1.8 1.8 0 0 1 1.8-2Z"/>',
    'support':        '<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="2.8" y="13.5" width="4" height="6" rx="2"/><rect x="17.2" y="13.5" width="4" height="6" rx="2"/><path d="M19.5 19.5a3 3 0 0 1-3 2.5h-2"/>',
    'assistant':      '<rect x="4" y="7.5" width="16" height="12" rx="4"/><path d="M12 3.5v4"/><circle cx="9.2" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13" r="1.2" fill="currentColor" stroke="none"/>',

    /* ─ Documents ─ */
    'document':       '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z"/><path d="M13.5 3v5.5H19"/>',
    'document-ecrit': '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/><path d="M13.5 3v5.5H19"/><path d="m14.5 14.5 5-5 2 2-5 5-2.6.6Z"/>',
    'presse-papier':  '<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5V3.6A1.6 1.6 0 0 1 10.6 2h2.8A1.6 1.6 0 0 1 15 3.6v.9Z"/><path d="M8.8 11h6.4"/><path d="M8.8 15h4"/>',
    'signature':      '<path d="M3 18.5c3-.5 4-6.5 6-6.5s1.5 5 3.5 5 2-3.5 4-3.5 2 1.5 4.5 1"/><path d="M14 7.5 17.5 4l2.5 2.5-3.5 3.5Z"/>',
    'graphique':      '<path d="M4 4v15a1 1 0 0 0 1 1h15"/><path d="M8 16v-4"/><path d="M12.5 16V8"/><path d="M17 16v-6"/>',

    /* ─ Lieux et objets ─ */
    'accueil':        '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5"/><path d="M10 20.5v-5.5h4v5.5"/>',
    'boutique':       '<path d="M4 9.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V9.5"/><path d="M3 9.5 4.8 4.2A1 1 0 0 1 5.8 3.5h12.4a1 1 0 0 1 1 .7L21 9.5a2.6 2.6 0 0 1-4.5 2 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5-2Z"/><path d="M9.5 20.5V14h5v6.5"/>',
    'position':       '<path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
    'institution':    '<path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5.5 9.5V18"/><path d="M9.8 9.5V18"/><path d="M14.2 9.5V18"/><path d="M18.5 9.5V18"/><path d="M3.5 20.5h17"/>',
    'diplome':        '<path d="m2.5 8.5 9.5-4.5 9.5 4.5-9.5 4.5Z"/><path d="M6.5 10.7V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5.3"/><path d="M21.5 8.5V14"/>',
    'ampoule':        '<path d="M9 17.5a6 6 0 1 1 6 0v1.2a1.3 1.3 0 0 1-1.3 1.3h-3.4A1.3 1.3 0 0 1 9 18.7Z"/><path d="M9.8 21.5h4.4"/>',
    'eclair':         '<path d="M13.5 2.5 4.5 13.8h6L10 21.5l9.5-11.3h-6.5Z"/>',
    'goutte':         '<path d="M12 3.2c3 3.6 5.5 6.4 5.5 9.4a5.5 5.5 0 1 1-11 0c0-3 2.5-5.8 5.5-9.4Z"/>',
    'route':          '<path d="M7 3.5 5 20.5"/><path d="m17 3.5 2 17"/><path d="M12 4.5v2.5"/><path d="M12 10.8v2.4"/><path d="M12 17v2.5"/>',
    'bus':            '<rect x="4" y="3.5" width="16" height="13.5" rx="2.5"/><path d="M4 11.5h16"/><path d="M7.5 21v-4"/><path d="M16.5 21v-4"/><circle cx="8" cy="14.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="14.2" r="1.1" fill="currentColor" stroke="none"/>',
    'pont':           '<path d="M2.5 17.5h19"/><path d="M4.5 17.5v-6"/><path d="M19.5 17.5v-6"/><path d="M4.5 11.5c3.5-4.5 11.5-4.5 15 0"/><path d="M9 17.5v-3.7"/><path d="M12 17.5v-4.4"/><path d="M15 17.5v-3.7"/>',
    'ancre':          '<circle cx="12" cy="5.2" r="2.2"/><path d="M12 7.4V21"/><path d="M7.5 11h9"/><path d="M4 14.5a8.2 8.2 0 0 0 16 0"/>',
    'television':     '<rect x="2.8" y="7" width="18.4" height="13" rx="2.5"/><path d="m8 3.5 4 3.5 4-3.5"/>',
    'antenne':        '<path d="M5.5 18.5 12 12"/><path d="M4 21v-4.5A6.5 6.5 0 0 1 10.5 10"/><path d="M13.6 3.4a7.5 7.5 0 0 1 7 7"/><path d="M13.2 7.2a3.8 3.8 0 0 1 3.6 3.6"/>',
    'mobile':         '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    'qr-code':        '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M13.5 13.5h3v3"/><path d="M20.5 13.5v3"/><path d="M16.5 20.5h4v-4"/>',
    'appareil-photo': '<path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h1.8l1.3-2h6.8l1.3 2h1.8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.8" r="3.4"/>',
    'porte-sortie':   '<path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M17.5 12H10"/><path d="m14.5 8.5 3.5 3.5-3.5 3.5"/>',
    'cadeau':         '<rect x="3.5" y="9" width="17" height="4" rx="1"/><path d="M5 13v6.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V13"/><path d="M12 9v11.5"/><path d="M12 9S10.5 4.5 8.2 4.5a2.2 2.2 0 0 0 0 4.5Z"/><path d="M12 9s1.5-4.5 3.8-4.5a2.2 2.2 0 0 1 0 4.5Z"/>',
    'etoile':         '<path d="m12 3.5 2.7 5.6 6.1.8-4.4 4.3 1.1 6.1-5.5-2.9-5.5 2.9 1.1-6.1L3.2 9.9l6.1-.8Z"/>',
    'celebration':    '<path d="m4 20.5 4.5-11 7 7Z"/><path d="M14.5 3.5v2.2"/><path d="m19.4 5.1-1.6 1.6"/><path d="M21 10.5h-2.2"/><path d="M11.5 8.2 9.9 6.6"/><path d="m17.8 13.6 1.6 1.6"/>',
    'tontine':        '<path d="M20.2 13.4A8.4 8.4 0 0 1 6.1 17.9"/><path d="M3.8 10.6A8.4 8.4 0 0 1 17.9 6.1"/><path d="M17.4 2.9v3.4h-3.4"/><path d="M6.6 21.1v-3.4h3.4"/><circle cx="12" cy="12" r="2.6"/>',
    'tirage':         '<path d="M4 8.5a1.5 1.5 0 0 1 .8-1.3l6.5-3.5a1.5 1.5 0 0 1 1.4 0l6.5 3.5a1.5 1.5 0 0 1 .8 1.3v7a1.5 1.5 0 0 1-.8 1.3l-6.5 3.5a1.5 1.5 0 0 1-1.4 0l-6.5-3.5a1.5 1.5 0 0 1-.8-1.3Z"/><path d="m4.3 7.8 7.7 4.2 7.7-4.2"/><path d="M12 12v8.5"/>',
    /* ─ Ajouts pour les applications métier et le back-office ─ */
    'rafraichir':     '<path d="M20.5 11.5a8.5 8.5 0 0 1-14.6 5.9"/><path d="M3.5 12.5a8.5 8.5 0 0 1 14.6-5.9"/><path d="M18.4 3.2v3.4H15"/><path d="M5.6 20.8v-3.4H9"/>',
    'corbeille':      '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.5 6.5 7.3 19a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12.5"/><path d="M10.2 10.5v6"/><path d="M13.8 10.5v6"/>',
    'sirene':         '<path d="M6 19v-5.5a6 6 0 0 1 12 0V19"/><path d="M4 19h16"/><path d="M12 2.5v2"/><path d="m5.2 5.6 1.4 1.4"/><path d="m18.8 5.6-1.4 1.4"/>',
    'recherche':      '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m20 20-4.4-4.4"/>',
    'ticket':         '<path d="M3.5 8.5V7a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 7v1.5a2.5 2.5 0 0 0 0 7V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-1.5a2.5 2.5 0 0 0 0-7Z"/><path d="M13.5 5.5v13"/>',
    'couronne':       '<path d="m3 8 3.5 3L12 4.5 17.5 11 21 8l-1.8 10.5H4.8Z"/><path d="M4.8 20.5h14.4"/>',
    'ecran':          '<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M9 20.5h6"/><path d="M12 16.5v4"/>',
    'globe':          '<circle cx="12" cy="12" r="8.8"/><path d="M3.4 12h17.2"/><path d="M12 3.2a13 13 0 0 1 0 17.6"/><path d="M12 3.2a13 13 0 0 0 0 17.6"/>',
    'trophee':        '<path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0Z"/><path d="M7.5 5.5H5a2 2 0 0 0 2.5 3.9"/><path d="M16.5 5.5H19a2 2 0 0 1-2.5 3.9"/><path d="M12 14v3.5"/><path d="M8.5 20.5h7"/><path d="M9.8 17.5h4.4l.8 3H9Z"/>',
    'feuille':        '<path d="M4.5 19.5C3 14 6 5.5 19.5 4.5c1 10.5-5 15-11 14.5"/><path d="M9 15c1.5-3 4-5.2 7.5-6.5"/>',
    'cadenas-ouvert': '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 7.7-1.5"/><circle cx="12" cy="15.2" r="1.3" fill="currentColor" stroke="none"/>',
    'etiquette':      '<path d="M11.6 3.5H4.8A1.3 1.3 0 0 0 3.5 4.8v6.8a2 2 0 0 0 .6 1.4l7.4 7.4a1.8 1.8 0 0 0 2.6 0l6-6a1.8 1.8 0 0 0 0-2.6L12.9 4.1a2 2 0 0 0-1.3-.6Z"/><circle cx="7.8" cy="7.8" r="1.4"/>',
    'panier':         '<path d="M3 4.5h2.2l2 10.6a1.6 1.6 0 0 0 1.6 1.3h8a1.6 1.6 0 0 0 1.6-1.3L20 8H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    'regle':          '<rect x="1.8" y="8" width="20.4" height="8" rx="2" transform="rotate(-45 12 12)"/><path d="m9 7.5 1.6 1.6"/><path d="m11.8 10.3 1.6 1.6"/><path d="m14.6 13.1 1.6 1.6"/>',
    'cible':          '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    'tri-haut':       '<path d="m6 14.5 6-6 6 6Z"/>',
    'tri-bas':        '<path d="m6 9.5 6 6 6-6Z"/>',
    'signal':         '<path d="M4 20v-3.5"/><path d="M9 20v-7"/><path d="M14 20V9"/><path d="M19 20V4.5"/>',
    'lien':           '<path d="M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.6 1.6"/><path d="M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.6-1.6"/>',
    'reglages':       '<circle cx="12" cy="12" r="3.1"/><path d="M19.6 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.5 1.1Z"/>',
    'outils':         '<path d="M14.2 6.4a3.8 3.8 0 0 0 5 5L21 13a5.5 5.5 0 0 1-7.6-7.6Z"/><path d="m13.4 10.6-9 9"/><path d="M4.4 15.6 8.9 20"/>',
    'ile':            '<path d="M12 3.5v10"/><path d="M12 7.5c-2.4-2-4.5-1.6-5.6-.8 1 1.9 3.2 3 5.6 2.8"/><path d="M12 6.8c2.4-2 4.5-1.6 5.6-.8-1 1.9-3.2 3-5.6 2.8"/><path d="M2.5 17.5c1.8 0 1.8 1.6 3.6 1.6s1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6 1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6"/><path d="M6.5 13.5h11"/>',
    'lampe':          '<path d="M9 3.5h6l1 4H8Z"/><path d="M8.5 7.5h7v3.2a1.6 1.6 0 0 1-1.6 1.6h-3.8a1.6 1.6 0 0 1-1.6-1.6Z"/><path d="M12 12.3v4.4"/><rect x="10.2" y="16.7" width="3.6" height="4" rx="1.2"/>',
    'chrono':         '<circle cx="12" cy="13.4" r="7.4"/><path d="M12 9.8v3.6l2.4 1.5"/><path d="M9.6 2.6h4.8"/><path d="M12 2.6v3.4"/>',
    'interdit':       '<circle cx="12" cy="12" r="8.8"/><path d="m6 18 12-12"/>',
    'carte-geo':      '<path d="m3.5 6 5.5-2.2 6 2.4 5.5-2.2v14L15 20.2l-6-2.4-5.5 2.2Z"/><path d="M9 3.8v14"/><path d="M15 6.2v14"/>',
    'dossier':        '<path d="M3.5 7.2a2 2 0 0 1 2-2h3.3l2 2.3H18.5a2 2 0 0 1 2 2v7.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
    'fusee':          '<path d="M8.6 15.4c-2 .6-3 2-3.4 5 3-.4 4.4-1.4 5-3.4"/><path d="M13 17.5 9.5 14a15 15 0 0 1 8-10.5c1.4-.4 2.4.6 2 2A15 15 0 0 1 13 17.5Z"/><circle cx="14.6" cy="9.4" r="1.6"/>',
    'diamant':        '<path d="M6.5 3.5h11l4 6-9.5 11L2.5 9.5Z"/><path d="M2.5 9.5h19"/><path d="m9 3.5-2 6 5 11 5-11-2-6"/>',
    'cloche-barree':  '<path d="M4 4.5 20 19.5"/><path d="M18 11c0-3.4-2.7-6-6-6a5.9 5.9 0 0 0-2.7.6"/><path d="M7 8.6A6 6 0 0 0 6 11c0 5-2 6.5-2 6.5h13"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
    'boussole':       '<circle cx="12" cy="12" r="8.8"/><path d="m15.5 8.5-2 5.2-5.2 2 2-5.2Z"/>',
    'recu':           '<path d="M5.5 3.5h13v17l-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4-2.1-1.4-2.2 1.4Z"/><path d="M9 8h6"/><path d="M9 12h4"/>',
    'immeuble':       '<rect x="4.5" y="3.5" width="15" height="17" rx="1.6"/><path d="M8.5 7.5h2"/><path d="M13.5 7.5h2"/><path d="M8.5 11.5h2"/><path d="M13.5 11.5h2"/><path d="M10 20.5v-4.2h4v4.2"/>',
    'drapeau':        '<path d="M5 21V4"/><path d="M5 5.2c4-2 7 2 11 0v8.4c-4 2-7-2-11 0Z"/>',
    'crayon':         '<path d="M4 20h4l11-11-4-4L4 16Z"/><path d="m14 6 4 4"/>',
    'utilisateurs':   '<circle cx="9" cy="8.4" r="3.3"/><path d="M2.8 19.4a6.4 6.4 0 0 1 12.4 0"/><path d="M16.4 5.4a3.3 3.3 0 0 1 0 6"/><path d="M18.2 19.4a5.6 5.6 0 0 0-2.2-4.4"/>',
    'main-salut':     '<path d="M11 11V5.2a1.6 1.6 0 0 1 3.2 0V11"/><path d="M14.2 10.4V6.6a1.6 1.6 0 0 1 3.2 0v6.8"/><path d="M7.8 12.4V8.6a1.6 1.6 0 0 1 3.2 0V11"/><path d="M7.8 12.2 6.4 10.4a1.6 1.6 0 0 0-2.6 1.8l3.4 6a5.6 5.6 0 0 0 4.8 2.8h1.4a5.6 5.6 0 0 0 5.6-5.6v-2"/>',
    'reseau':         '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="m10.4 6.9-4 8.8"/><path d="m13.6 6.9 4 8.8"/><path d="M7.4 18h9.2"/>'
  };

  /* Alias — noms métier vers tracés partagés */
  P['kyc'] = P['piece-identite'];
  P['mes-documents'] = P['document'];
  P['tontine-recu'] = P['celebration'];
  P['commission'] = P['etoile'];
  P['bonus'] = P['cadeau'];
  P['orange-credit'] = P['mobile'];
  P['moov-credit'] = P['mobile'];
  P['mtn-credit'] = P['telephone'];
  P['alerte-urgente'] = P['sirene'];
  P['supprimer'] = P['corbeille'];
  P['modifier'] = P['crayon'];
  P['groupe'] = P['utilisateurs'];
  P['zone'] = P['carte-geo'];
  P['magasin'] = P['boutique'];
  P['nouveau'] = P['etiquette'];

  function ic(nom, taille, couleur, epaisseur) {
    var d = P[nom];
    if (!d) d = P['point'];
    var s = taille || 20;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none"'
      + ' stroke="' + (couleur || 'currentColor') + '" stroke-width="' + (epaisseur || 1.7) + '"'
      + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
      + ' style="flex-shrink:0;display:block">' + d + '</svg>';
  }

  ic.existe = function (nom) { return !!P[nom]; };
  ic.noms = function () { return Object.keys(P); };

  root.ic = ic;
  root.MP_ICONS = P;
})(typeof window !== 'undefined' ? window : this);
