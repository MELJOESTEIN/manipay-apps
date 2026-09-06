/* ManiPay — ManiPot, l'assistant
   ─────────────────────────────────────────────────────────────────────────
   Règles reprises du dossier de conception (« ManiPot Identite », planches
   16a à 16e, et « ManiPot Ecosysteme », 17a à 17h). Elles ne sont pas
   négociables :

   1. Il prépare, il n'exécute jamais. Toute opération d'argent passe par un
      écran de confirmation avec saisie du code secret.
   2. Il ne demande jamais le code secret. C'est ce qui protège de
      l'hameçonnage par imitation de l'assistant.
   3. Il ne promet jamais un gain futur et ne dit jamais « je m'en occupe »
      d'une opération qu'il n'a pas encore exécutée.
   4. ManiPot tutoie, ManiPay vouvoie. Un même écran peut porter les deux
      voix, jamais dans la même phrase.
   5. Le registre descend quand l'argent en jeu monte. Au registre 4 —
      fraude, blocage, bannissement, caution appelée — le personnage quitte
      l'écran : ni pastille violette, ni tutoiement, ni expression. C'est ce
      silence qui rend sa présence crédible partout ailleurs.

   Ce fichier ne fournit que la voix et la mise en forme. Les faits qu'il
   affiche viennent de l'application ; il n'appelle aucune API et ne décide
   rien.                                                                     */
(function (root) {
  'use strict';

  /* ── Les quatre registres ──────────────────────────────────────────── */
  var REGISTRES = {
    R1: { nom: 'complice', emoji: true,  tutoie: true,  personnage: true },
    R2: { nom: 'direct',   emoji: 'un',  tutoie: true,  personnage: true },
    R3: { nom: 'sobre',    emoji: false, tutoie: true,  personnage: true },
    R4: { nom: 'formel',   emoji: false, tutoie: false, personnage: false }
  };

  /* ── Les cinq expressions, liées à un déclencheur, jamais à une humeur ── */
  var EXPRESSIONS = {
    content:  { img: 'manipot.png',          registre: 'R1' },  // commission, filleul, cotisation
    celebre:  { img: 'manipot-celebre.png',  registre: 'R1' },  // palier franchi, KYC validé
    neutre:   { img: 'manipot-neutre.png',   registre: 'R3' },  // récapitulatif, consultation
    inquiet:  { img: 'manipot-inquiet.png',  registre: 'R2' },  // solde bas, plafond, échéance
    attentif: { img: 'manipot-attentif.png', registre: 'R2' }   // ambiguïté, OTP refusé, hors habitude
  };

  /* ── Couleurs de la charte pour la voix de ManiPot ─────────────────── */
  var VIOLET = '#6941C6', VIOLET_FOND = '#F0EBFF', VIOLET_BORD = '#DACDF7';

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function heure(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /** Montant au format de la charte : « 162 900 F », espace insécable. */
  function montant(n) {
    return Number(n || 0).toLocaleString('fr-FR').replace(/ |\s/g, ' ') + ' F';
  }

  /**
   * Rend une carte ManiPot.
   *
   * @param {object} o
   *   texte      {string}  ce que ManiPot dit — au registre demandé
   *   registre   {string}  'R1' | 'R2' | 'R3' | 'R4'  (défaut R1)
   *   expression {string}  clé de EXPRESSIONS ; déduite du registre si absente
   *   titre      {string}  intitulé optionnel au-dessus du texte
   *   faits      {Array}   [{ label, valeur }] — « ce que je vois »
   *   actions    {Array}   [{ texte }] — « ce que tu peux faire », numérotées
   *   boutons    {Array}   [{ texte, onclick, primaire }]
   *   compact    {boolean} version resserrée, pour un bandeau d'accueil
   *
   * Au registre 4, le personnage disparaît : la carte devient une note
   * institutionnelle qui vouvoie. C'est voulu, et c'est la règle.
   */
  function carte(o) {
    o = o || {};
    var reg = REGISTRES[o.registre] ? o.registre : 'R1';
    var r = REGISTRES[reg];

    /* Registre 4 : ManiPay parle, ManiPot se retire. */
    if (!r.personnage) {
      return ''
        + '<div class="mp-formel" style="background:#fff;border:1px solid #E3EAE5;'
        + 'border-left:3px solid #912018;border-radius:14px;padding:14px 16px;margin:8px 0">'
        + (o.titre ? '<div style="font:600 13.5px \'Outfit\',sans-serif;color:#912018;margin-bottom:5px">' + esc(o.titre) + '</div>' : '')
        + '<div style="font:400 13px/1.6 \'Instrument Sans\',sans-serif;color:#33473C">' + esc(o.texte) + '</div>'
        + blocFaits(o.faits, '#912018')
        + blocBoutons(o.boutons, '#912018')
        + '</div>';
    }

    var expr = EXPRESSIONS[o.expression] ? o.expression : expressionParDefaut(reg);
    var img = EXPRESSIONS[expr].img;
    var pad = o.compact ? '11px 13px' : '14px 16px';

    return ''
      + '<div class="mp-card" style="background:' + VIOLET_FOND + ';border:1px solid ' + VIOLET_BORD
      + ';border-radius:14px;padding:' + pad + ';margin:8px 0">'
      + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:' + (o.compact ? '6px' : '9px') + '">'
      +   '<img src="' + img + '" alt="" style="width:' + (o.compact ? 26 : 32) + 'px;height:' + (o.compact ? 26 : 32)
      +     'px;border-radius:999px;background:#fff;border:1.5px solid ' + VIOLET_BORD + ';object-fit:cover;flex-shrink:0"/>'
      +   '<div style="font:600 12.5px \'Outfit\',sans-serif;color:' + VIOLET + ';flex:1">ManiPot</div>'
      +   '<div style="font:500 10px \'Geist Mono\',monospace;color:#9AAAA1">' + heure(o.date) + '</div>'
      + '</div>'
      + (o.titre ? '<div style="font:600 14px \'Outfit\',sans-serif;color:#0A1F14;margin-bottom:4px">' + esc(o.titre) + '</div>' : '')
      + '<div style="font:400 13.5px/1.6 \'Instrument Sans\',sans-serif;color:#0A1F14">' + esc(o.texte) + '</div>'
      + blocFaits(o.faits, VIOLET)
      + blocActions(o.actions)
      + blocBoutons(o.boutons, VIOLET)
      + '</div>';
  }

  function expressionParDefaut(reg) {
    if (reg === 'R3') return 'neutre';
    if (reg === 'R2') return 'inquiet';
    return 'content';
  }

  /** « Ce que je vois » — des faits vérifiables, jamais une intuition. */
  function blocFaits(faits, couleur) {
    if (!faits || !faits.length) return '';
    var h = '<div style="margin-top:11px;background:rgba(255,255,255,.72);border-radius:10px;padding:9px 11px">'
          + '<div style="font:600 9.5px \'Geist Mono\',monospace;letter-spacing:.14em;text-transform:uppercase;color:#4E6157;margin-bottom:6px">Ce que je vois</div>';
    faits.forEach(function (f, i) {
      h += '<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0'
         + (i ? ';border-top:1px solid #E3EAE5' : '') + '">'
         + '<span style="font-size:12px;color:#4E6157">' + esc(f.label) + '</span>'
         + '<span style="font:600 12px \'Instrument Sans\',sans-serif;color:' + couleur + ';text-align:right">' + esc(f.valeur) + '</span>'
         + '</div>';
    });
    return h + '</div>';
  }

  /** « Ce que tu peux faire » — des actions que la personne peut réellement prendre. */
  function blocActions(actions) {
    if (!actions || !actions.length) return '';
    var h = '<div style="margin-top:11px">'
          + '<div style="font:600 9.5px \'Geist Mono\',monospace;letter-spacing:.14em;text-transform:uppercase;color:#4E6157;margin-bottom:6px">Ce que tu peux faire</div>';
    actions.forEach(function (a, i) {
      h += '<div style="display:flex;gap:9px;align-items:flex-start;padding:4px 0">'
         + '<span style="flex-shrink:0;width:17px;height:17px;border-radius:999px;background:' + VIOLET
         + ';color:#fff;font:600 10px \'Geist Mono\',monospace;display:flex;align-items:center;justify-content:center;margin-top:1px">'
         + (i + 1) + '</span>'
         + '<span style="font-size:12.5px;line-height:1.5;color:#0A1F14">' + esc(a.texte || a) + '</span>'
         + '</div>';
    });
    return h + '</div>';
  }

  function blocBoutons(boutons, couleur) {
    if (!boutons || !boutons.length) return '';
    var h = '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">';
    boutons.forEach(function (b) {
      var p = !!b.primaire;
      h += '<button type="button" onclick="' + esc(b.onclick || '') + '" '
         + 'style="flex:1;min-width:120px;min-height:40px;padding:0 14px;border-radius:10px;cursor:pointer;'
         + 'font:600 13px \'Instrument Sans\',sans-serif;'
         + (p ? 'background:' + couleur + ';color:#fff;border:none'
              : 'background:#fff;color:' + couleur + ';border:1.5px solid ' + VIOLET_BORD)
         + '">' + esc(b.texte) + '</button>';
    });
    return h + '</div>';
  }

  /**
   * Pose une carte dans un conteneur, en tête de son contenu.
   * Sans effet si le conteneur est absent : l'assistant ne bloque jamais un écran.
   */
  function poser(idConteneur, o) {
    var el = typeof idConteneur === 'string' ? document.getElementById(idConteneur) : idConteneur;
    if (!el) return false;
    var hote = el.querySelector('[data-manipot]');
    if (!hote) {
      hote = document.createElement('div');
      hote.setAttribute('data-manipot', '1');
      el.insertBefore(hote, el.firstChild);
    }
    hote.innerHTML = carte(o);
    return true;
  }

  function retirer(idConteneur) {
    var el = typeof idConteneur === 'string' ? document.getElementById(idConteneur) : idConteneur;
    if (!el) return;
    var hote = el.querySelector('[data-manipot]');
    if (hote && hote.parentNode) hote.parentNode.removeChild(hote);
  }

  root.ManiPot = {
    carte: carte,
    poser: poser,
    retirer: retirer,
    montant: montant,
    EXPRESSIONS: EXPRESSIONS,
    REGISTRES: REGISTRES
  };
})(typeof window !== 'undefined' ? window : this);
