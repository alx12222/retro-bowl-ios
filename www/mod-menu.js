(function () {
  function boot() {
    if (typeof GameMaker_Init !== "function") {
      setTimeout(boot, 40);
      return;
    }
    GameMaker_Init();
    installGameplayHooks();
  }
  window.addEventListener("load", function () {
    window.PokiSDK = null;
    window.PokiSDK_OK = false;
    boot();
  });

  var SAVE_KEYS = ["RetroBowl.0.savedata.ini", "RetroBowlModded.0.savedata.ini"];
  var OPT_KEYS = ["RetroBowl.0.optiondata.dat", "RetroBowlModded.0.optiondata.dat"];
  var panel = document.getElementById("alex-panel");
  var openBtn = document.getElementById("alex-open");
  var dimmer = document.getElementById("alex-dimmer");
  var exportBox = document.getElementById("alex-export");
  var exportName = document.getElementById("export-name");
  var MOD_SETTINGS_KEY = "alex_gameplay_mods";
  var gameplayMods = (window.AlexMods = {
    fieldGoalAimbot: false,
    noTackles: false,
    noFumbles: false,
    noInjuries: false,
    infiniteQBThrowRange: false,
    freezeClock: false,
    unlimitedDowns: false,
    infiniteStamina: false,
    noInterceptions: false,
    autoStiffArm: false,
    playerSpeedMult: 1
  });
  var frozenClock = null;
  var tickerMessageIndex = 0;
  var playerObjectIds = null;
  var stiffArmCooldown = 0;
  var uiState = 0;

  if (typeof window._Vr1 === "function") {
    window._Vr1 = function () {
      tickerMessageIndex = (tickerMessageIndex + 1) % 2;
      return tickerMessageIndex === 0
        ? "this mod so tuff boiiii"
        : "Mod made by Alex and available on GitHub :)";
    };
  }

  try {
    var savedGameplayMods = JSON.parse(localStorage.getItem(MOD_SETTINGS_KEY) || "{}");
    Object.keys(gameplayMods).forEach(function (name) {
      if (typeof savedGameplayMods[name] === "boolean" || typeof savedGameplayMods[name] === "number") {
        gameplayMods[name] = savedGameplayMods[name];
      }
    });
    if (typeof gameplayMods.playerSpeedMult === "number") {
      gameplayMods.playerSpeedMult = Math.max(1, Math.min(gameplayMods.playerSpeedMult, 3));
    } else {
      gameplayMods.playerSpeedMult = 1;
    }
  } catch (err) {
    gameplayMods.playerSpeedMult = 1;
  }

  function saveGameplayMods() {
    localStorage.setItem(MOD_SETTINGS_KEY, JSON.stringify(gameplayMods));
  }

  function isTypingBox(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toUpperCase();
    if (tag === "TEXTAREA") return true;
    if (tag !== "INPUT") return false;
    var type = (el.type || "text").toLowerCase();
    return type === "text" || type === "number" || type === "search" || type === "tel" || type === "url" || type === "password" || type === "";
  }

  function eachList(list, fn) {
    if (!list) return;
    if (typeof list.forEach === "function") {
      list.forEach(fn);
      return;
    }
    for (var key in list) {
      if (!Object.prototype.hasOwnProperty.call(list, key)) continue;
      fn(list[key], key);
    }
  }

  function findPlayerObjectIds() {
    if (playerObjectIds && playerObjectIds.length) return playerObjectIds;
    var ids = [];
    if (typeof window._Qm !== "function") return ids;
    for (var id = 0; id < 200; id++) {
      var list;
      try { list = window._Qm(id); } catch (err) { continue; }
      if (!list) continue;
      var hit = false;
      eachList(list, function (inst) {
        if (hit || !inst) return;
        if (inst._4r !== undefined && (inst._Ex1 !== undefined || inst._V1 !== undefined)) hit = true;
      });
      if (hit) ids.push(id);
    }
    if (ids.length) playerObjectIds = ids;
    return ids;
  }

  function eachFieldPlayer(fn) {
    if (typeof window._Qm !== "function") return;
    findPlayerObjectIds().forEach(function (id) {
      var list;
      try { list = window._Qm(id); } catch (err) { return; }
      eachList(list, function (inst) {
        if (inst && inst._4r !== undefined) fn(inst);
      });
    });
  }

  function getBallHolder() {
    try {
      if (window.global && window.global._Rw !== undefined) {
        var balls = window._Qm(window.global._Rw);
        var holder = null;
        eachList(balls, function (b) {
          if (!holder && b && b._J71 !== undefined && b._J71 !== null && b._J71 !== -4) holder = b._J71;
        });
        return holder;
      }
    } catch (err) {}
    return null;
  }

  function getInstanceById(id) {
    if (id === null || id === undefined || id === -4) return null;
    var found = null;
    eachFieldPlayer(function (inst) {
      if (found) return;
      if (inst.id === id || inst === id) found = inst;
    });
    if (found) return found;
    if (typeof id === "object" && id && id._4r !== undefined) return id;
    return null;
  }

  function dist2(a, b) {
    var dx = (a.x || 0) - (b.x || 0);
    var dy = (a.y || 0) - (b.y || 0);
    return dx * dx + dy * dy;
  }

  function applyAutoStiffArm() {
    if (!gameplayMods.autoStiffArm) return;
    if (stiffArmCooldown > 0) { stiffArmCooldown -= 1; return; }
    var holderId = getBallHolder();
    if (holderId === null) return;
    var carrier = getInstanceById(holderId);
    if (!carrier || carrier._K71 === false || carrier._K71 === 0) return;
    carrier._Gx1 = 2;
    if (carrier._Rx1 !== undefined) carrier._Rx1 = 2;
    var near = [];
    eachFieldPlayer(function (player) {
      if (!player || player === carrier) return;
      if (player._K71 === true || player._K71 === 1) return;
      if (player._Lu1 || player._uv1) return;
      if (dist2(carrier, player) < 900) near.push(player);
    });
    if (!near.length) return;
    near.sort(function (a, b) { return dist2(carrier, a) - dist2(carrier, b); });
    var target = near[0];
    carrier._Gx1 = 2;
    carrier._vv1 = target.id !== undefined ? target.id : target;
    try {
      if (typeof target.y === "number" && typeof carrier.y === "number") target._Sb = carrier.y < target.y ? 2.2 : -2.2;
      if (typeof target.x === "number" && typeof carrier.x === "number") {
        var push = carrier.x < target.x ? 3.5 : -3.5;
        target.x = target.x + push;
        if (target._Rb !== undefined) target._Rb = push * 0.6;
      }
    } catch (err) {}
    stiffArmCooldown = 8;
  }

  function forceClockFrozen(match) {
    if (!match) return;
    if (!frozenClock) {
      frozenClock = { minutes: match._yt1, seconds: match._zt1, quarter: match._rV };
    }
    match._yt1 = frozenClock.minutes;
    match._zt1 = frozenClock.seconds;
    if (match._EF1 !== undefined) match._EF1 = 0;
    if (match._gE1 !== undefined) match._gE1 = frozenClock.minutes * 60 + frozenClock.seconds;
    if (match._iE1 !== undefined) match._iE1 = frozenClock.minutes * 60 + frozenClock.seconds;
  }

  function installGameplayHooks() {
    var originalDropBall = window._2w1;
    if (typeof originalDropBall === "function" && !originalDropBall.__alexHooked) {
      window._2w1 = function () {
        if (gameplayMods.noFumbles) return;
        return originalDropBall.apply(this, arguments);
      };
      window._2w1.__alexHooked = true;
    }
    var originalInjuryCheck = window._iI1;
    if (typeof originalInjuryCheck === "function" && !originalInjuryCheck.__alexHooked) {
      window._iI1 = function () {
        if (gameplayMods.noInjuries) return 0;
        return originalInjuryCheck.apply(this, arguments);
      };
      window._iI1.__alexHooked = true;
    }
    var originalSubtractTime = window._pG1;
    if (typeof originalSubtractTime === "function" && !originalSubtractTime.__alexHooked) {
      window._pG1 = function () {
        if (gameplayMods.freezeClock) { forceClockFrozen(arguments[0] || activeMatch()); return; }
        return originalSubtractTime.apply(this, arguments);
      };
      window._pG1.__alexHooked = true;
    }
    var originalTimeAccum = window._nE1;
    if (typeof originalTimeAccum === "function" && !originalTimeAccum.__alexHooked) {
      window._nE1 = function () {
        if (gameplayMods.freezeClock) { forceClockFrozen(arguments[0] || activeMatch()); return; }
        return originalTimeAccum.apply(this, arguments);
      };
      window._nE1.__alexHooked = true;
    }
    var originalApplyTime = window._xG1;
    if (typeof originalApplyTime === "function" && !originalApplyTime.__alexHooked) {
      window._xG1 = function () {
        if (gameplayMods.freezeClock) { forceClockFrozen(activeMatch()); return; }
        return originalApplyTime.apply(this, arguments);
      };
      window._xG1.__alexHooked = true;
    }
    var originalTackle = window._KA1;
    if (typeof originalTackle === "function" && !originalTackle.__alexHooked) {
      window._KA1 = function () {
        if (gameplayMods.noTackles) return;
        if (gameplayMods.autoStiffArm && arguments[0]) {
          var self = arguments[0];
          if (self && (self._K71 === true || self._K71 === 1)) {
            self._Gx1 = 2;
            if (self._Rx1 !== undefined) self._Rx1 = 2;
          }
        }
        return originalTackle.apply(this, arguments);
      };
      window._KA1.__alexHooked = true;
    }
    var originalCatch = window._tv1;
    if (typeof originalCatch === "function" && !originalCatch.__alexHooked) {
      window._tv1 = function (_bi, _ci) {
        if (gameplayMods.noInterceptions && _bi && !_bi._K71) return 0;
        return originalCatch.apply(this, arguments);
      };
      window._tv1.__alexHooked = true;
    }
    var originalAim = window._rs1;
    if (typeof originalAim === "function" && !originalAim.__alexHooked) {
      window._rs1 = function () {
        if (!gameplayMods.infiniteQBThrowRange || typeof window.min !== "function") {
          return originalAim.apply(this, arguments);
        }
        var nativeMin = window.min;
        window.min = function (first, second) {
          if (second === 100 && first > 100) return first;
          return nativeMin.apply(this, arguments);
        };
        try { return originalAim.apply(this, arguments); }
        finally { window.min = nativeMin; }
      };
      window._rs1.__alexHooked = true;
    }
    var originalKick = window._Mt1;
    if (typeof originalKick === "function" && !originalKick.__alexHooked) {
      window._Mt1 = function () {
        if (gameplayMods.fieldGoalAimbot && arguments[0]) {
          arguments[0]._Rt1 = 55;
          arguments[0]._es1 = 300;
        }
        return originalKick.apply(this, arguments);
      };
      window._Mt1.__alexHooked = true;
    }
  }

  function applyMatchControls() {
    if (typeof window._Qm !== "function") return;
    try {
      installGameplayHooks();
      var matches = window._Qm(99);
      eachList(matches, function (match) {
        if (!match || match._yt1 === undefined || match._zt1 === undefined || match._Oo === undefined) return;
        if (gameplayMods.freezeClock) forceClockFrozen(match);
        else frozenClock = null;
        if (gameplayMods.unlimitedDowns && match._Oo >= 4 && match._Oo < 6) match._Oo = 1;
      });
      if (gameplayMods.infiniteStamina) {
        eachFieldPlayer(function (player) {
          if (player._Fx1 !== undefined) player._Fx1 = 10;
          if (player._4q && typeof window._yn === "function") {
            try { window._yn(player._4q, "stamina", 10); } catch (err) {}
          }
        });
      }
      if (gameplayMods.autoStiffArm) {
        eachFieldPlayer(function (player) {
          if (player && (player._K71 === true || player._K71 === 1)) {
            if (player._Gx1 !== undefined && player._Gx1 < 2) player._Gx1 = 2;
            if (player._Rx1 !== undefined) player._Rx1 = 2;
          }
        });
        applyAutoStiffArm();
      }
      // Player Speed multiplier is applied in the rAF loop below (scales the
      // instance's GM-builtin hspeed/vspeed each frame). Nothing to do here.
    } catch (err) {}
  }

  installGameplayHooks();
  window.setInterval(applyMatchControls, 33);

  // Player Speed: boost offensive players by (a) raising max_speed stat, and
  // (b) each frame, adding an extra forward nudge to hspeed/vspeed up to a cap
  // so no one teleports off the field. mult<=1 is a full no-op (restores).
  (function speedLoop() {
    try {
      var mult = Number(gameplayMods.playerSpeedMult) || 1;
      if (mult > 3) mult = 3;
      // Boost factor: (mult - 1), so 2x adds 1x extra, 100x adds 99x extra.
      // Cap per-frame velocity nudge so players don't teleport.
      var nudgeFactor = Math.max(0, mult - 1);
      var maxNudge = Math.min(nudgeFactor * 2.0, 20); // absolute cap in px/frame
      if (window._yn && window._5n) {
        // Only boost the current ball carrier (if they're on our offense).
        var holderId = getBallHolder();
        var carrier = (holderId !== null) ? getInstanceById(holderId) : null;
        var carrierOnOffense = carrier && (carrier._K71 === true || carrier._K71 === 1);

        eachFieldPlayer(function (p) {
          if (!p || !p._4q) return;
          var isTheCarrier = carrierOnOffense && (p === carrier || p.id === holderId);
          // If this player was previously boosted but isn't the carrier now
          // (or the slider's at 1x), restore and bail.
          if (!isTheCarrier || mult <= 1) {
            if (p._alexBaseMax !== undefined) {
              try { window._yn(p._4q, "max_speed", p._alexBaseMax); } catch (e) {}
              delete p._alexBaseMax;
            }
            return;
          }
          // Carrier gets the max_speed cap raised
          try {
            if (p._alexBaseMax === undefined) {
              var cur = Number(window._5n(p._4q, "max_speed"));
              p._alexBaseMax = (!isNaN(cur) && cur > 0 && cur <= 10) ? cur : 10;
            }
            window._yn(p._4q, "max_speed", Math.min(p._alexBaseMax * mult, 1000));
          } catch (e) {}
          // Position-nudge boost on the carrier only.
          var vx = typeof p._Rb === "number" ? p._Rb : 0;
          var vy = typeof p._Sb === "number" ? p._Sb : 0;
          var mag = Math.sqrt(vx * vx + vy * vy);
          if (mag > 0.4) {
            var bonus = (mult - 1) * 0.3;
            var extraMag = mag * bonus;
            var cap = 10;
            if (extraMag > cap) bonus = cap / mag;
            if (typeof p.x === "number") p.x += vx * bonus;
            if (typeof p.y === "number") p.y += vy * bonus;
          }
        });
      }
    } catch (e) {}
    window.requestAnimationFrame(speedLoop);
  })();

  function activeController() {
    if (typeof window._Qm !== "function") return null;
    var controllers = window._Qm(92);
    if (!controllers) return null;
    if (controllers.length) return controllers[0];
    for (var key in controllers) {
      if (Object.prototype.hasOwnProperty.call(controllers, key)) return controllers[key];
    }
    return null;
  }

  function activeMatch() {
    if (typeof window._Qm !== "function") return null;
    var matches = window._Qm(99);
    var match = null;
    if (matches && matches.length) match = matches[0];
    else eachList(matches, function (item) { if (!match) match = item; });
    if (!match || match._yt1 === undefined || match._zt1 === undefined || match._Oo === undefined) return null;
    return match;
  }

  function setGamePaused(paused) {
    if (typeof window._625 === "boolean") window._625 = paused;
  }

  function openMenu() {
    uiState = 2;
    panel.classList.add("open");
    dimmer.classList.add("visible");
    openBtn.classList.add("hidden");
    setGamePaused(true);
  }

  function closeMenu() {
    panel.classList.remove("open");
    dimmer.classList.remove("visible");
    openBtn.classList.add("hidden");
    uiState = 1;
    setGamePaused(false);
  }

  function cycleSlashUI() {
    if (uiState === 0) {
      openBtn.classList.add("hidden");
      panel.classList.remove("open");
      dimmer.classList.remove("visible");
      setGamePaused(false);
      uiState = 1;
    } else if (uiState === 1) {
      openBtn.classList.add("hidden");
      panel.classList.add("open");
      dimmer.classList.add("visible");
      setGamePaused(true);
      uiState = 2;
    } else {
      panel.classList.remove("open");
      dimmer.classList.remove("visible");
      openBtn.classList.remove("hidden");
      setGamePaused(false);
      uiState = 0;
    }
  }

  // Return every localStorage key that holds a real career save (any slot:
  // savedata.ini, savedata2.ini, ..., savedata5.ini, or legacy keys).
  function findAllSaveKeys() {
    var hits = [], n, k, v;
    for (n = 0; n < localStorage.length; n++) {
      k = localStorage.key(n);
      if (!k || !/savedata/i.test(k)) continue;
      v = localStorage.getItem(k);
      if (v && v.indexOf("coach_credit") !== -1) hits.push(k);
    }
    return hits;
  }

  // Preferred single key for *reading* current values into the UI: biggest
  // save wins (likely the active career).
  function findSaveKey() {
    var keys = findAllSaveKeys();
    if (!keys.length) {
      // legacy fallbacks (first that exists)
      for (var i = 0; i < SAVE_KEYS.length; i++) {
        if (localStorage.getItem(SAVE_KEYS[i])) return SAVE_KEYS[i];
      }
      return SAVE_KEYS[0];
    }
    var best = keys[0], bestLen = (localStorage.getItem(best) || "").length;
    for (var j = 1; j < keys.length; j++) {
      var l = (localStorage.getItem(keys[j]) || "").length;
      if (l > bestLen) { best = keys[j]; bestLen = l; }
    }
    return best;
  }

  function getSave() { return localStorage.getItem(findSaveKey()) || ""; }

  // Writes go to EVERY save slot that looks like a real career, so whichever
  // slot the user actually loads picks up the change. Falls back to primary
  // key if nothing matches (e.g. no career started yet).
  function setSave(s) {
    var keys = findAllSaveKeys();
    if (keys.length === 0) { localStorage.setItem(findSaveKey(), s); return; }
    // For multi-slot writes we apply the same field value to all of them
    // via writeAllSaves below; this single-blob setter writes to the active
    // one it was read from (compat path for export/import flows).
    localStorage.setItem(findSaveKey(), s);
  }

  // Apply a field change to every career save in localStorage.
  function writeAllSaves(name, value) {
    var keys = findAllSaveKeys();
    if (keys.length === 0) return 0;
    var changed = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var s = localStorage.getItem(k) || "";
      var updated = replaceField(s, name, value);
      if (updated !== s) {
        localStorage.setItem(k, updated);
        changed++;
      }
    }
    return changed;
  }

  function getField(name, fallback) {
    var match = getSave().match(new RegExp(name + '=["\\\']([^"\\\']*)["\\\']'));
    return match ? match[1] : fallback;
  }

  function rosterRecordCount(save) {
    var matches = save.match(/roster_[0-9]+="[^"\r\n]*"/g);
    return matches ? matches.length : 0;
  }

  function replaceField(s, name, value) {
    var re = new RegExp(name + '="[^"]*"', "g");
    if (re.test(s)) return s.replace(re, name + '="' + value + '"');
    re = new RegExp(name + "='[^']*'", "g");
    if (re.test(s)) return s.replace(re, name + '="' + value + '"');
    if (s.indexOf("[savegame]") !== -1) return s.replace("[savegame]", "[savegame]\r\n" + name + '="' + value + '"');
    return s + "\r\n" + name + '="' + value + '"\r\n';
  }

  function setField(name, value) {
    var s = getSave();
    if (!s) { alert("No save yet. Start a career first."); return false; }
    // Apply to every save slot in localStorage so whichever slot the user
    // loads picks up the change.
    var n = writeAllSaves(name, value);
    if (n === 0) setSave(replaceField(s, name, value));
    return true;
  }

  function notifyRefresh() { alert("Changes will show on refresh."); }
  function val(id) { return document.getElementById(id).value.replace(/[^0-9.\-eE+]/g, ""); }
  function add(id, delta) {
    var el = document.getElementById(id);
    var n = parseFloat(el.value);
    if (isNaN(n)) n = 0;
    el.value = String(n + delta);
  }

  function syncValues() {
    var save = getSave();
    document.getElementById("v-credits").value = getField("coach_credit", "0");
    document.getElementById("v-salary").value = getField("salary_cap", "150");
    document.getElementById("v-fans").value = getField("fans", "30");
    document.getElementById("v-roster").value = String(Math.min(parseInt(getField("roster", "0"), 10) || 0, rosterRecordCount(save)));
    document.getElementById("v-draft").value = getField("draft_picks_0", "0");
    document.getElementById("v-fac").value = getField("facility_stadium", "1");
    var speedEl = document.getElementById("v-speed");
    if (speedEl) {
      speedEl.value = gameplayMods.playerSpeedMult;
      document.getElementById("v-speed-label").textContent = Number(gameplayMods.playerSpeedMult).toFixed(1) + "x";
    }
  }

  function clearGameDialogs(controller) {
    [73, 65, 74, 4].forEach(function (objectId) {
      if (typeof window._wz === "function") window._wz(controller, objectId);
    });
  }

  function maxTeamMorale() {
    if (typeof window._Qm !== "function" || typeof window._1n !== "function" || typeof window._4n !== "function" || typeof window._yn !== "function") return;
    try {
      eachList(window._Qm(92), function (team) {
        if (!team) return;
        [team._sp, team._nv].forEach(function (roster) {
          if (roster === undefined || roster === null) return;
          for (var index = 0; index < window._1n(roster); index++) {
            var player = window._4n(roster, index);
            if (player !== undefined && player !== null) window._yn(player, "attitude", 100);
          }
        });
      });
    } catch (err) {}
  }

  openBtn.onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    openMenu();
  };
  document.getElementById("alex-x").onclick = function () { closeMenu(); };

  panel.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key !== "Tab") return;
    if (!isTypingBox(e.target)) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
  });
  panel.addEventListener("keyup", function (e) { e.stopPropagation(); });
  panel.addEventListener("keypress", function (e) { e.stopPropagation(); });
  panel.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  panel.addEventListener("click", function (e) { e.stopPropagation(); });

  Array.prototype.forEach.call(panel.querySelectorAll("[data-mod]"), function (input) {
    input.checked = !!gameplayMods[input.getAttribute("data-mod")];
    input.onchange = function () {
      var name = input.getAttribute("data-mod");
      gameplayMods[name] = input.checked;
      if (name === "freezeClock" && !input.checked) frozenClock = null;
      if (name === "freezeClock" && input.checked) {
        var m = activeMatch();
        if (m) frozenClock = { minutes: m._yt1, seconds: m._zt1, quarter: m._rV };
      }
      saveGameplayMods();
    };
  });

  var speedSlider = document.getElementById("v-speed");
  if (speedSlider) {
    speedSlider.max = 3;
    speedSlider.value = gameplayMods.playerSpeedMult;
    document.getElementById("v-speed-label").textContent = Number(gameplayMods.playerSpeedMult).toFixed(1) + "x";
    speedSlider.oninput = function () {
      var v = parseFloat(this.value);
      if (isNaN(v)) v = 1;
      v = Math.max(1, Math.min(v, 3));
      gameplayMods.playerSpeedMult = v;
      document.getElementById("v-speed-label").textContent = v.toFixed(1) + "x";
      saveGameplayMods();
    };
  }

  document.getElementById("a-give-td").onclick = function () {
    var match = activeMatch();
    if (!match) { alert("You must be in a game."); return; }
    alert("Give td is running now. Close the menu when you are ready.");
    var controller = activeController();
    if (!controller || typeof window._qY !== "function") return;
    clearGameDialogs(controller);
    match._r11 = 40;
    match._ky = 10;
    match._Mo = match._No;
    if (match._Oo >= 6) match._Oo = 1;
    setGamePaused(false);
    window._qY(controller, controller, 1);
  };

  document.getElementById("a-win-game").onclick = function () {
    var match = activeMatch();
    if (!match) { alert("You must be in a game."); return; }
    alert("Win Game is running now. Close the menu when you are ready.");
    var controller = activeController();
    if (!controller || typeof window._1J1 !== "function") return;
    if (match._fE1 && match._No !== undefined) {
      var playerSide = match._No;
      var opponentSide = playerSide ? 0 : 1;
      match._fE1[playerSide] = 67;
      match._fE1[opponentSide] = 0;
    }
    window._1J1(controller, controller);
  };

  document.getElementById("a-morale-max").onclick = function () {
    maxTeamMorale();
    alert("Team morale is now maxed.");
  };

  document.getElementById("c-plus").onclick = function () { add("v-credits", 1000); };
  document.getElementById("c-minus").onclick = function () { add("v-credits", -1000); };
  document.getElementById("c-100").onclick = function () { add("v-credits", 100); };
  document.getElementById("c-500").onclick = function () { add("v-credits", 500); };
  document.getElementById("c-1000").onclick = function () { add("v-credits", 1000); };
  document.getElementById("s-plus").onclick = function () { add("v-salary", 100000); };
  document.getElementById("s-minus").onclick = function () { add("v-salary", -100000); };
  document.getElementById("f-plus").onclick = function () { add("v-fans", 5); };
  document.getElementById("f-minus").onclick = function () { add("v-fans", -5); };
  document.getElementById("r-plus").onclick = function () { add("v-roster", 1); };
  document.getElementById("r-minus").onclick = function () { add("v-roster", -1); };
  document.getElementById("d-plus").onclick = function () { add("v-draft", 1); };
  document.getElementById("d-minus").onclick = function () { add("v-draft", -1); };
  document.getElementById("fac-plus").onclick = function () { add("v-fac", 1); };
  document.getElementById("fac-minus").onclick = function () { add("v-fac", -1); };

  document.getElementById("a-credits").onclick = function () { if (setField("coach_credit", val("v-credits"))) notifyRefresh(); };
  document.getElementById("a-salary").onclick = function () { if (setField("salary_cap", val("v-salary"))) notifyRefresh(); };
  document.getElementById("a-fans").onclick = function () { if (setField("fans", val("v-fans"))) notifyRefresh(); };
  document.getElementById("a-roster").onclick = function () {
    var save = getSave();
    var requested = parseInt(val("v-roster"), 10);
    var available = rosterRecordCount(save);
    if (isNaN(requested)) requested = 0;
    requested = Math.max(0, Math.min(requested, available));
    document.getElementById("v-roster").value = String(requested);
    if (setField("roster", String(requested))) notifyRefresh();
  };
  document.getElementById("a-draft").onclick = function () {
    var v = val("v-draft");
    if (!getSave()) { alert("No save yet."); return; }
    writeAllSaves("draft_picks_0", v);
    writeAllSaves("draft_picks_1", v);
    writeAllSaves("draft_picks_2", v);
    notifyRefresh();
  };

  function setFacilities(v) {
    if (!getSave()) { alert("No save yet."); return false; }
    ["facility_stadium", "facility_upgraded_stadium", "facility_training", "facility_upgraded_training", "facility_rehab", "facility_upgraded_rehab"].forEach(function (k) {
      writeAllSaves(k, v);
    });
    return true;
  }
  document.getElementById("a-fac").onclick = function () { if (setFacilities(val("v-fac"))) notifyRefresh(); };
  document.getElementById("a-fac-max").onclick = function () {
    document.getElementById("v-fac").value = "10";
    if (setFacilities("10")) notifyRefresh();
  };
  document.getElementById("a-fac-reset").onclick = function () {
    document.getElementById("v-fac").value = "1";
    if (setFacilities("1")) notifyRefresh();
  };

  function collectExportData() {
    saveGameplayMods();
    var data = { localStorage: {} };
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      data.localStorage[k] = localStorage.getItem(k);
    }
    return data;
  }

  function applyImportData(obj) {
    if (!obj || !obj.localStorage) return false;
    Object.keys(obj.localStorage).forEach(function (k) {
      localStorage.setItem(k, obj.localStorage[k]);
    });
    return true;
  }

  function exportFileName(raw) {
    var name = String(raw || "").trim();
    name = name.replace(/\\/g, "/").split("/").pop();
    name = name.replace(/[<>:"|?*\u0000-\u001f]/g, "");
    name = name.replace(/(\.[A-Za-z0-9]+)+$/, "");
    name = name.replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim();
    if (!name) name = "retrobowl-save";
    return name + ".json";
  }

  function downloadExport(filename) {
    var data = collectExportData();
    if (!data.localStorage || !Object.keys(data.localStorage).length) {
      alert("Nothing to export.");
      return;
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  document.getElementById("a-export").onclick = function () {
    exportName.value = "retrobowl-save";
    exportBox.classList.add("show");
  };
  document.getElementById("export-cancel").onclick = function () { exportBox.classList.remove("show"); };
  document.getElementById("export-ok").onclick = function () {
    var filename = exportFileName(exportName.value);
    exportBox.classList.remove("show");
    downloadExport(filename);
  };
  document.getElementById("a-import").onclick = function () { document.getElementById("f-import").click(); };
  document.getElementById("f-import").onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var t = r.result;
        var loaded = false;
        try {
          var o = JSON.parse(t);
          if (o && o.localStorage) loaded = applyImportData(o);
        } catch (err) {}
        if (!loaded && t.indexOf("coach_credit=") !== -1) {
          localStorage.setItem(findSaveKey(), t);
          loaded = true;
        }
        if (!loaded) { alert("Could not read that file."); return; }
        location.reload();
      } catch (err) { alert("Import failed."); }
    };
    r.readAsText(f);
    e.target.value = "";
  };
  document.getElementById("a-reload").onclick = function () { location.reload(); };

  window.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && panel.classList.contains("open") && !isTypingBox(e.target)) e.preventDefault();
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      cycleSlashUI();
    }
  });

  syncValues();

  var alertBox = document.getElementById("alex-alert");
  if (!localStorage.getItem("alex_starter_prompted")) {
    alertBox.classList.add("show");
  }
  document.getElementById("alert-no").onclick = function () {
    localStorage.setItem("alex_starter_prompted", "1");
    alertBox.classList.remove("show");
  };
  document.getElementById("alert-yes").onclick = function () {
    localStorage.setItem("alex_starter_prompted", "1");
    fetch("saves/starter.json")
      .then(function (r) { return r.json(); })
      .then(function (o) {
        if (o.localStorage) {
          Object.keys(o.localStorage).forEach(function (k) {
            localStorage.setItem(k, o.localStorage[k]);
          });
        }
        location.reload();
      })
      .catch(function () {
        alert("Could not load starter save.");
        alertBox.classList.remove("show");
      });
  };
})();