/**
 * MOON VR: "THE LAST SIGNAL" - 8-Phase Mission Lifecycle Controller
 * Coordinates the full cinematic narrative, physical cockpit interactions,
 * audio events, and Adaptive AI Director branching.
 */

class MissionFlow {
  constructor() {
    this.currentPhase = 1;
    this.phaseTimer = null;
    this.phaseStartTime = 0;
    this.emergencyTimer = null;
    this.emergencySecondsLeft = 0;

    // Phase 1 Launch State
    this.countdownSeconds = 10;
    this.countdownTimer = null;
    this.isLaunching = false;
    this.engine2AlarmActive = false;

    // Phase 2 Orbit State
    this.leakActive = false;
    this.sealantEquipped = false;
    this.leakStartTime = 0;

    // Phase 3 EVA State
    this.evaTetherVerified = false;
    this.evaPressureVerified = false;

    // Phase 7 Re-entry State
    this.reentryActive = false;
    this.reentrySeconds = 90;
    this.pitchTrimBalanced = false;
    this.coolantDumped = false;

    this.initEventListeners();
  }

  initEventListeners() {
    // 3D Switch Toggles
    window.addEventListener("cockpit-switch-toggle", (e) => {
      const { switchId, active } = e.detail;
      this.handleSwitchToggle(switchId, active);
    });

    // 3D Throttle Lever
    window.addEventListener("cockpit-lever-pulled", (e) => {
      const { leverId } = e.detail;
      if (leverId === "ignition") {
        this.handleIgnitionPull();
      }
    });

    // Tool Equipped
    window.addEventListener("tool-equipped", (e) => {
      if (e.detail.toolId === "sealant") {
        this.sealantEquipped = true;
        this.showHUDNotification("EQUIPPED", "Magnetic Sealant Applicator Ready. Target hull puncture!", "info");
        const patchBtn = document.getElementById("dock-btn-patch");
        if (patchBtn) patchBtn.style.display = "inline-flex";
      }
    });

    // Breach Seal Attempt
    window.addEventListener("breach-seal-attempt", () => {
      this.handleBreachSeal();
    });

    // Satellite Node in EVA
    window.addEventListener("satellite-node-engaged", () => {
      this.handleSatelliteScanned();
    });

    // --- QUICK-ACTION DOCK CONTROLS ---
    // Dock Rocker Switch Buttons
    document.querySelectorAll(".dock-btn[data-switch]").forEach(btn => {
      btn.addEventListener("click", () => {
        const switchId = btn.getAttribute("data-switch");
        this.toggleSwitchFromDock(switchId);
      });
    });

    // Dock Ignition Button
    const dockIgnitionBtn = document.getElementById("dock-btn-ignition");
    if (dockIgnitionBtn) {
      dockIgnitionBtn.addEventListener("click", () => {
        if (window.cockpitScene) window.cockpitScene.setIgnitionState(true);
        this.handleIgnitionPull();
      });
    }

    // Dock Reset View Button
    const resetViewBtn = document.getElementById("btn-reset-view");
    if (resetViewBtn) {
      resetViewBtn.addEventListener("click", () => {
        if (window.cockpitScene) window.cockpitScene.resetCameraView();
        if (window.audioEngine) window.audioEngine.playSwitchClick();
        this.showHUDNotification("VIEW RE-CENTERED", "Camera centered on main instrument console.", "info");
      });
    }

    // Dock Emergency Engine 2 Bypass Button
    const dockBypassBtn = document.getElementById("dock-btn-bypass");
    if (dockBypassBtn) {
      dockBypassBtn.addEventListener("click", () => {
        if (this.engine2AlarmActive) {
          if (window.cockpitScene) window.cockpitScene.setSwitchState("eng2_bypass", true);
          this.resolveEngine2Emergency(true);
        }
      });
    }

    // Dock Tool & Patch Buttons
    const dockSealantBtn = document.getElementById("dock-btn-sealant");
    if (dockSealantBtn) {
      dockSealantBtn.addEventListener("click", () => {
        this.sealantEquipped = true;
        if (window.cockpitScene && window.cockpitScene.sealantTool) {
          window.cockpitScene.sealantTool.userData.isEquipped = true;
          window.cockpitScene.sealantTool.position.set(0.25, 1.05, -0.6);
        }
        if (window.audioEngine) window.audioEngine.playLeverClunk();
        this.showHUDNotification("EQUIPPED", "Magnetic Sealant Applicator Ready.", "info");
        const patchBtn = document.getElementById("dock-btn-patch");
        if (patchBtn) patchBtn.style.display = "inline-flex";
      });
    }

    const dockPatchBtn = document.getElementById("dock-btn-patch");
    if (dockPatchBtn) {
      dockPatchBtn.addEventListener("click", () => {
        this.handleBreachSeal();
      });
    }

    // --- ACCESSIBLE KEYBOARD SHORTCUTS ---
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (key === "1") this.toggleSwitchFromDock("o2");
      else if (key === "2") this.toggleSwitchFromDock("comms");
      else if (key === "3") this.toggleSwitchFromDock("nav");
      else if (key === "4") this.toggleSwitchFromDock("power");
      else if (key === "5") this.toggleSwitchFromDock("cargo");
      else if (key === "c") {
        if (window.cockpitScene) window.cockpitScene.resetCameraView();
        if (window.audioEngine) window.audioEngine.playSwitchClick();
        this.showHUDNotification("VIEW RE-CENTERED", "Camera centered on main instrument console.", "info");
      } else if (key === "e") {
        if (this.engine2AlarmActive) {
          if (window.cockpitScene) window.cockpitScene.setSwitchState("eng2_bypass", true);
          this.resolveEngine2Emergency(true);
        }
      } else if (key === "f") {
        if (this.currentPhase === 2 && this.leakActive) {
          dockSealantBtn && dockSealantBtn.click();
        }
      } else if (key === "r") {
        if (this.currentPhase === 2 && this.leakActive) {
          dockPatchBtn && dockPatchBtn.click();
        }
      } else if (key === " " || e.code === "Space") {
        e.preventDefault();
        if (this.currentPhase === 1 && !this.isLaunching) {
          if (window.cockpitScene) window.cockpitScene.setIgnitionState(true);
          this.handleIgnitionPull();
        } else if (this.currentPhase === 3) {
          const rcsBtn = document.getElementById("btn-rcs-pulse");
          if (rcsBtn) rcsBtn.click();
        }
      }
    });
  }

  toggleSwitchFromDock(switchId) {
    let cur = false;
    if (switchId === "o2") cur = !window.aiDirector.flags.checkedOxygen;
    else if (switchId === "comms") cur = !window.aiDirector.flags.checkedComms;
    else if (switchId === "nav") cur = !window.aiDirector.flags.checkedNav;
    else if (switchId === "power") cur = !window.aiDirector.flags.checkedPower;
    else if (switchId === "cargo") cur = !window.aiDirector.flags.checkedEquipment;

    if (window.cockpitScene) window.cockpitScene.setSwitchState(switchId, cur);
    if (window.audioEngine) window.audioEngine.playSwitchClick();
    this.handleSwitchToggle(switchId, cur);
  }

  // --- START THE MISSION ---
  start() {
    this.currentPhase = 1;
    this.phaseStartTime = Date.now();
    this.updateHUDPhase(1, "LAUNCH SEQUENCE & PRE-FLIGHT VERIFICATION");

    if (window.audioEngine) {
      window.audioEngine.init();
      window.audioEngine.resume();
      window.audioEngine.speakRadioMessage(
        "Apollo-X, Houston Flight. You are go for solo pre-flight verification. Meticulously inspect life support, comms, nav, power, and secure cargo locks before pulling primary ignition."
      );
    }

    if (window.aiDirector) {
      window.aiDirector.logThought("MISSION INITIALIZED: Monitoring trainee preparation discipline.", "info");
    }

    this.renderPhase1HUD();
  }

  // --- PHASE 1: LAUNCH & PRE-FLIGHT ---
  renderPhase1HUD() {
    const actionArea = document.getElementById("hud-action-area");
    if (!actionArea) return;

    actionArea.innerHTML = `
      <div class="mission-objective-box">
        <div class="obj-title">MISSION OBJECTIVE: PRE-FLIGHT SYSTEMS CHECK</div>
        <div class="obj-desc">Physically toggle cockpit rocker switches to calibrate ship systems, then pull the red THRUST IGNITION LEVER.</div>
        <div class="checklist-items" id="preflight-checklist">
          <div class="chk-item" id="chk-o2">⚪ [O2] Primary Oxygen Life Support</div>
          <div class="chk-item" id="chk-comms">⚪ [COMMS] Deep Space Uplink Antenna</div>
          <div class="chk-item" id="chk-nav">⚪ [NAV] Lunar Inertial Navigation Bus</div>
          <div class="chk-item" id="chk-power">⚪ [POWER] Auxiliary Battery Grid</div>
          <div class="chk-item" id="chk-cargo">⚪ [CARGO] Equipment Magnetic Locks</div>
        </div>
      </div>
    `;
  }

  handleSwitchToggle(switchId, active) {
    if (window.aiDirector) window.aiDirector.registerInteraction(true);

    if (this.currentPhase === 1) {
      if (switchId === "o2") {
        window.aiDirector.flags.checkedOxygen = active;
        this.updateChecklistItem("chk-o2", active);
      } else if (switchId === "comms") {
        window.aiDirector.flags.checkedComms = active;
        this.updateChecklistItem("chk-comms", active);
      } else if (switchId === "nav") {
        window.aiDirector.flags.checkedNav = active;
        this.updateChecklistItem("chk-nav", active);
      } else if (switchId === "power") {
        window.aiDirector.flags.checkedPower = active;
        this.updateChecklistItem("chk-power", active);
      } else if (switchId === "cargo") {
        window.aiDirector.flags.checkedEquipment = active;
        this.updateChecklistItem("chk-cargo", active);
      } else if (switchId === "eng2_bypass") {
        // Engine 2 Emergency bypass toggle
        if (this.engine2AlarmActive) {
          this.resolveEngine2Emergency(true);
        }
      }

      // Synchronize Dock Button State
      const dockBtn = document.getElementById(`dock-btn-${switchId}`);
      if (dockBtn) {
        if (active) dockBtn.classList.add("active");
        else dockBtn.classList.remove("active");
      }

      // Highlight Ignition Lever button when all 5 checks are done
      const f = window.aiDirector.flags;
      const allDone = f.checkedOxygen && f.checkedComms && f.checkedNav && f.checkedPower && f.checkedEquipment;
      const dockIgnBtn = document.getElementById("dock-btn-ignition");
      if (dockIgnBtn) {
        if (allDone) dockIgnBtn.classList.add("ready-pulse");
        else dockIgnBtn.classList.remove("ready-pulse");
      }
    } else if (this.currentPhase === 5) {
      // Adaptive complication switch toggles
      if (switchId === "power") {
        this.resolveAdaptiveComplication();
      }
    }
  }

  updateChecklistItem(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    if (active) {
      el.classList.add("checked");
      el.textContent = el.textContent.replace("⚪", "✓");
    } else {
      el.classList.remove("checked");
      el.textContent = el.textContent.replace("✓", "⚪");
    }
  }

  handleIgnitionPull() {
    if (this.isLaunching) return;
    this.isLaunching = true;

    // AI Director assesses whether player rushed without checklist
    if (window.aiDirector) {
      window.aiDirector.evaluatePreflightChecklist();
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="countdown-display">
          <div class="countdown-title">IGNITION SEQUENCE ARMED</div>
          <div class="countdown-timer" id="countdown-num">T-10</div>
          <div class="countdown-sub">STAND BY FOR MAIN ENGINE ACCELERATION</div>
        </div>
      `;
    }

    // 10 Second Countdown
    this.countdownSeconds = 10;
    this.countdownTimer = setInterval(() => {
      this.countdownSeconds--;
      const numEl = document.getElementById("countdown-num");
      if (numEl) numEl.textContent = `T-0${this.countdownSeconds}`;

      if (this.countdownSeconds === 5) {
        if (window.audioEngine) window.audioEngine.startRocketRumble(0.6);
        if (window.cockpitScene) window.cockpitScene.setScreenShake(0.3);
      }

      if (this.countdownSeconds <= 0) {
        clearInterval(this.countdownTimer);
        this.triggerLaunchLiftoff();
      }
    }, 1000);
  }

  triggerLaunchLiftoff() {
    const numEl = document.getElementById("countdown-num");
    if (numEl) {
      numEl.textContent = "LIFTOFF!";
      numEl.style.color = "#00e5ff";
    }

    if (window.audioEngine) {
      window.audioEngine.startRocketRumble(1.0);
      window.audioEngine.speakRadioMessage("Tower cleared. Velocity increasing. You are supersonic.");
    }
    if (window.cockpitScene) {
      window.cockpitScene.setScreenShake(0.8);
    }

    // After 4.5 seconds of ascent -> Engine 2 Pressure Anomaly!
    setTimeout(() => {
      this.triggerEngine2Crisis();
    }, 4500);
  }

  triggerEngine2Crisis() {
    this.engine2AlarmActive = true;
    const crisisStartTime = Date.now();

    if (window.audioEngine) {
      window.audioEngine.startAlarm("warning");
      window.audioEngine.setHeartbeatBpm(115);
    }
    if (window.cockpitScene) {
      window.cockpitScene.setAlarmVisuals(true);
      window.cockpitScene.updateMFDCanvas("ABNORMAL", 99, 101.3, 88);
      // Reveal the emergency bypass switch on the right console
      if (window.cockpitScene.switches["eng2_bypass"]) {
        window.cockpitScene.switches["eng2_bypass"].visible = true;
      }
    }

    // Show Emergency Bypass on Dock
    const bypassBtn = document.getElementById("dock-btn-bypass");
    if (bypassBtn) bypassBtn.style.display = "inline-flex";

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="emergency-banner critical">
          <div class="em-title">⚠️ MASTER CAUTION: ENGINE 2 PRESSURE ABNORMAL</div>
          <div class="em-timer" id="em-clock">15.0s REMAINING</div>
          <div class="em-desc">Turbopump overpressure detected. Locate and actuate [ENG 2 BYPASS] on the cockpit console before turbine blade failure!</div>
        </div>
      `;
    }

    this.emergencySecondsLeft = 15.0;
    this.emergencyTimer = setInterval(() => {
      this.emergencySecondsLeft -= 0.1;
      const clockEl = document.getElementById("em-clock");
      if (clockEl) clockEl.textContent = `${Math.max(0, this.emergencySecondsLeft).toFixed(1)}s REMAINING`;

      if (this.emergencySecondsLeft <= 0) {
        clearInterval(this.emergencyTimer);
        this.resolveEngine2Emergency(false);
      }
    }, 100);
  }

  resolveEngine2Emergency(isCorrect) {
    if (!this.engine2AlarmActive) return;
    this.engine2AlarmActive = false;
    clearInterval(this.emergencyTimer);

    const responseTime = Math.max(1, (15.0 - this.emergencySecondsLeft));
    if (window.aiDirector) {
      window.aiDirector.recordEngine2Diagnosis(responseTime, isCorrect);
    }

    if (window.audioEngine) {
      window.audioEngine.stopAlarm();
      window.audioEngine.stopRocketRumble(2.5);
    }
    if (window.cockpitScene) {
      window.cockpitScene.setAlarmVisuals(false);
      window.cockpitScene.setScreenShake(0.0);
      window.cockpitScene.updateMFDCanvas("NOMINAL", 98, 101.3, window.aiDirector.telemetry.fuelReserve);
      if (window.cockpitScene.switches["eng2_bypass"]) {
        window.cockpitScene.switches["eng2_bypass"].visible = false;
      }
    }

    const bypassBtn = document.getElementById("dock-btn-bypass");
    if (bypassBtn) bypassBtn.style.display = "none";

    this.showHUDNotification(
      isCorrect ? "ENGINE 2 ISOLATED" : "TURBINE OVERHEAT - AUTO-VENT DUMPED FUEL",
      isCorrect ? `Pressure stabilized in ${responseTime.toFixed(1)}s. Main engine cutoff nominal.` : "Fuel reserves lost to prevent explosion.",
      isCorrect ? "success" : "alert"
    );

    // Transition to Phase 2: Orbit
    setTimeout(() => {
      this.transitionToPhase2();
    }, 3200);
  }

  // --- PHASE 2: ORBIT & MICROMETEOROID LEAK ---
  transitionToPhase2() {
    this.currentPhase = 2;
    this.updateHUDPhase(2, "ORBITAL INSERTION & UNEXPECTED SIGNAL");

    if (window.audioEngine) {
      window.audioEngine.setHeartbeatBpm(70);
      window.audioEngine.speakRadioMessage(
        "Apollo-X, orbital insertion confirmed. You are in Low Lunar Orbit. Beautiful view of Earth on your horizon... Wait, we are picking up an anomalous deep-space telemetry signal on auxiliary band 4."
      );
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="mission-objective-box">
          <div class="obj-title">ORBITAL CRUISE: SENSORS SCANNING</div>
          <div class="obj-desc">Look outside canopy to observe Earth and orbital horizon. Ground telemetry scanning anomalous signal...</div>
        </div>
      `;
    }

    // After 6 seconds, Micrometeoroid strike occurs!
    setTimeout(() => {
      this.triggerMicrometeoroidBreach();
    }, 6000);
  }

  triggerMicrometeoroidBreach() {
    this.leakActive = true;
    this.leakStartTime = Date.now();

    if (window.audioEngine) {
      window.audioEngine.playImpactThud();
      window.audioEngine.startPressureLeakHiss();
      window.audioEngine.startAlarm("warning");
      window.audioEngine.setHeartbeatBpm(120);
    }
    if (window.cockpitScene) {
      window.cockpitScene.setAlarmVisuals(true);
      window.cockpitScene.hullBreachHole.visible = true;
      window.cockpitScene.sealantTool.visible = true;
      window.cockpitScene.updateMFDCanvas("PRESSURE LOSS", 94, 88.5, 85);
    }

    // Show Sealant Tool on Dock
    const dockSealBtn = document.getElementById("dock-btn-sealant");
    if (dockSealBtn) dockSealBtn.style.display = "inline-flex";

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="emergency-banner critical">
          <div class="em-title">🚨 MICROMETEOROID IMPACT - CABIN DEPRESSURIZING</div>
          <div class="em-desc">
            1. Click the amber [SEALANT APPLICATOR] on the left console to equip it.<br>
            2. Inspect right cockpit hull to locate glowing leak hole.<br>
            3. Click the rupture to apply magnetic pressure sealant!
          </div>
          <div class="pressure-gauge-hud">CABIN PRESSURE DROPPING: <span id="pressure-val">88.5 kPa</span></div>
        </div>
      `;
    }

    // Depressurization loop
    this.emergencyTimer = setInterval(() => {
      if (!this.leakActive) return;
      if (window.aiDirector) {
        window.aiDirector.telemetry.cabinPressure = Math.max(50, window.aiDirector.telemetry.cabinPressure - 1.2);
        const pVal = document.getElementById("pressure-val");
        if (pVal) pVal.textContent = `${window.aiDirector.telemetry.cabinPressure.toFixed(1)} kPa`;
        if (window.cockpitScene) {
          window.cockpitScene.updateMFDCanvas("LEAK ACTIVE", 92, window.aiDirector.telemetry.cabinPressure, 85);
        }
      }
    }, 600);
  }

  handleBreachSeal() {
    if (!this.leakActive) return;
    if (!this.sealantEquipped) {
      this.showHUDNotification("EQUIPMENT REQUIRED", "You must equip the Sealant Applicator from the left console first!", "warning");
      if (window.aiDirector) window.aiDirector.registerInteraction(false);
      return;
    }

    this.leakActive = false;
    clearInterval(this.emergencyTimer);
    const responseTime = (Date.now() - this.leakStartTime) / 1000;

    if (window.aiDirector) {
      window.aiDirector.recordHullBreachResponse(responseTime, true);
    }

    if (window.audioEngine) {
      window.audioEngine.stopPressureLeakHiss();
      window.audioEngine.playSealPatchSound();
      window.audioEngine.stopAlarm();
    }
    if (window.cockpitScene) {
      window.cockpitScene.hullBreachHole.userData.isSealed = true;
      window.cockpitScene.hullBreachHole.userData.beacon.visible = false;
      window.cockpitScene.sealantTool.visible = false;
      window.cockpitScene.setAlarmVisuals(false);
      window.cockpitScene.updateMFDCanvas("SEALED", window.aiDirector.telemetry.oxygenLevel, window.aiDirector.telemetry.cabinPressure, 85);
    }

    const dockSealBtn = document.getElementById("dock-btn-sealant");
    if (dockSealBtn) dockSealBtn.style.display = "none";
    const dockPatchBtn = document.getElementById("dock-btn-patch");
    if (dockPatchBtn) dockPatchBtn.style.display = "none";

    this.showHUDNotification("HULL RUPTURE SEALED", "Cabin pressure stabilizing. Foam sealant polymer set.", "success");

    // MAJOR STORY TURNING POINT: SUDDEN COMMUNICATION LOSS
    setTimeout(() => {
      this.triggerCommunicationFailure();
    }, 3000);
  }

  triggerCommunicationFailure() {
    if (window.audioEngine) {
      window.audioEngine.speakRadioMessage("Apollo-X, Houston, we see the pressure stabiliz— [STATIC] —warning, major solar flare discharge— [CARRIER LOSS]", () => {
        if (window.audioEngine) {
          window.audioEngine.setAtmosphereSilence();
          window.audioEngine.setHeartbeatBpm(90);
        }
      });
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="comms-loss-card">
          <div class="loss-glitch-title">COMMUNICATION LOST</div>
          <div class="loss-sub">MISSION CONTROL: OFFLINE</div>
          <div class="loss-quote">“You are completely alone. In the silence of space, only your breathing remains.”</div>
        </div>
      `;
    }

    setTimeout(() => {
      this.transitionToPhase3();
    }, 5500);
  }

  // --- PHASE 3: SPACEWALK (EVA) ---
  transitionToPhase3() {
    this.currentPhase = 3;
    this.updateHUDPhase(3, "EXTRAVEHICULAR ACTIVITY (EVA) — SPACEWALK");

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="eva-prep-box">
          <div class="eva-title">👨🚀 AIRLOCK DEPRESSURIZATION PROTOCOL</div>
          <div class="eva-desc">You must exit the craft to inspect the satellite antenna dish. Complete pre-EVA checks or proceed immediately.</div>
          <div class="eva-checklist">
            <label><input type="checkbox" id="eva-chk-tether"> Verify Magnetic Safety Tether Carabiner</label>
            <label><input type="checkbox" id="eva-chk-pressure"> Verify Space Suit Pressure Integrity (32 kPa)</label>
            <label><input type="checkbox" id="eva-chk-thruster"> Arm Cold Gas Maneuvering Thrusters</label>
          </div>
          <button class="hud-action-btn" id="btn-egress">DEPRESSURIZE AIRLOCK & EGRESS INTO VACUUM</button>
        </div>
      `;

      document.getElementById("btn-egress").addEventListener("click", () => {
        const tetherChecked = document.getElementById("eva-chk-tether").checked;
        const pressureChecked = document.getElementById("eva-chk-pressure").checked;
        this.executeAirlockEgress(tetherChecked, pressureChecked);
      });
    }
  }

  executeAirlockEgress(tetherChecked, pressureChecked) {
    if (window.aiDirector) {
      window.aiDirector.recordEVAPreparation(tetherChecked, pressureChecked);
    }

    if (window.cockpitScene) {
      window.cockpitScene.enterEVA();
    }

    this.showHUDNotification("VACUUM EGRESS COMPLETE", "You are floating in open space. Earth horizon in view.", "info");

    // If trainee forgot tether -> trigger drift tension emergency!
    if (!tetherChecked) {
      setTimeout(() => {
        this.triggerTetherDriftIncident();
      }, 2500);
    } else {
      this.renderEVANavigationHUD();
    }
  }

  triggerTetherDriftIncident() {
    if (window.audioEngine) {
      window.audioEngine.startAlarm("critical");
      window.audioEngine.setHeartbeatBpm(135);
    }
    if (window.cockpitScene) {
      window.cockpitScene.setScreenShake(0.5);
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="emergency-banner critical">
          <div class="em-title">⚠️ TETHER TENSION ABNORMAL - ZERO-G DRIFT!</div>
          <div class="em-desc">Because tether verification was skipped, you slipped from the airlock handle and are drifting into vacuum!</div>
          <button class="hud-action-btn pulse-glow" id="btn-rcs-pulse">FIRE COLD GAS JET PULSE TO RE-STABILIZE</button>
        </div>
      `;

      document.getElementById("btn-rcs-pulse").addEventListener("click", () => {
        if (window.audioEngine) {
          window.audioEngine.stopAlarm();
          window.audioEngine.playSealPatchSound();
          window.audioEngine.setHeartbeatBpm(95);
        }
        if (window.cockpitScene) {
          window.cockpitScene.setScreenShake(0.0);
        }
        this.showHUDNotification("RE-STABILIZED", "Cold gas pulse halted drift. Anchored to satellite frame.", "success");
        this.renderEVANavigationHUD();
      });
    }
  }

  renderEVANavigationHUD() {
    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="mission-objective-box">
          <div class="obj-title">SATELLITE INTERFACE CONTACT</div>
          <div class="obj-desc">Approach the satellite floating ahead in 360 space. Click the glowing cyan [QUANTUM TELEMETRY PORT] to download the deep-space signal!</div>
        </div>
      `;
    }
  }

  handleSatelliteScanned() {
    this.showHUDNotification("SIGNAL EXTRACTED", "Quantum telemetry data downloaded to suit storage.", "success");
    setTimeout(() => {
      this.transitionToPhase4();
    }, 2000);
  }

  // --- PHASE 4: SOLAR STORM APPROACH ---
  transitionToPhase4() {
    this.currentPhase = 4;
    this.updateHUDPhase(4, "RADIATION ALERT — SOLAR STORM APPROACHING");

    if (window.audioEngine) {
      window.audioEngine.startAlarm("critical");
      window.audioEngine.setHeartbeatBpm(125);
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="storm-decision-card">
          <div class="storm-header">
            <span class="storm-icon">☢️</span>
            <div class="storm-title">CORONAL MASS EJECTION INCOMING</div>
          </div>
          <div class="storm-eta">ESTIMATED TIME TO IONIZING RADIATION IMPACT: 3 MINUTES</div>
          <div class="storm-sub">There is no single correct answer. Your choice defines your astronaut risk philosophy:</div>
          <div class="storm-options">
            <div class="storm-opt" id="opt-return">
              <div class="opt-label">OPTION A: RETURN IMMEDIATELY</div>
              <div class="opt-desc">Aborts scientific telemetry. Minimizes radiation exposure. Guarantees 98%+ astronaut physical survival.</div>
            </div>
            <div class="storm-opt" id="opt-repair">
              <div class="opt-label">OPTION B: CONTINUE REPAIRING SATELLITE</div>
              <div class="opt-desc">Recovers 100% of breakthrough lunar data. Exposes suit avionics to dangerous ionizing flare burn.</div>
            </div>
            <div class="storm-opt" id="opt-shield">
              <div class="opt-label">OPTION C: HIDE IN HULL SHADOW</div>
              <div class="opt-desc">Position in spacecraft thermal tile shadow. Balances radiation shielding, but sacrifices ground comms window.</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById("opt-return").addEventListener("click", () => this.resolveSolarStorm("return"));
      document.getElementById("opt-repair").addEventListener("click", () => this.resolveSolarStorm("repair"));
      document.getElementById("opt-shield").addEventListener("click", () => this.resolveSolarStorm("shield"));
    }
  }

  resolveSolarStorm(choice) {
    if (window.aiDirector) {
      window.aiDirector.recordSolarStormDecision(choice);
    }
    if (window.audioEngine) {
      window.audioEngine.stopAlarm();
      window.audioEngine.setHeartbeatBpm(85);
    }
    if (window.cockpitScene) {
      window.cockpitScene.returnToCockpit();
    }

    this.showHUDNotification("TACTICAL CHOICE COMMITTED", `Astronaut executed Strategy: ${choice.toUpperCase()}`, "info");

    setTimeout(() => {
      this.transitionToPhase5();
    }, 2800);
  }

  // --- PHASE 5: ADAPTIVE AI MISSION DIRECTOR ---
  transitionToPhase5() {
    this.currentPhase = 5;
    this.updateHUDPhase(5, "ADAPTIVE AI MISSION DIRECTOR CALIBRATION");

    const complication = window.aiDirector.generateAdaptiveComplication();

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="ai-director-manifest-card">
          <div class="ai-banner-title">🧠 ADAPTIVE AI MISSION DIRECTOR</div>
          <div class="ai-quote">“The simulation is observing your behavioral profile. Generating dynamic scenario adaptation...”</div>
          <div class="ai-complication-box">
            <div class="comp-urgency">[${complication.urgency}]</div>
            <div class="comp-title">${complication.title}</div>
            <div class="comp-desc">${complication.description}</div>
            <div class="comp-cause"><strong>Root Cause:</strong> ${complication.rootCause}</div>
          </div>
          <button class="hud-action-btn" id="btn-resolve-comp">ENGAGE PROTOCOL & COUNTERMEASURE</button>
        </div>
      `;

      document.getElementById("btn-resolve-comp").addEventListener("click", () => {
        this.resolveAdaptiveComplication();
      });
    }
  }

  resolveAdaptiveComplication() {
    if (window.audioEngine) window.audioEngine.playSwitchClick();
    this.showHUDNotification("SYSTEM REBALANCED", "Adaptive challenge countermeasure accepted.", "success");

    setTimeout(() => {
      this.transitionToPhase6();
    }, 2600);
  }

  // --- PHASE 6: THE IMPOSSIBLE DECISION ---
  transitionToPhase6() {
    this.currentPhase = 6;
    this.updateHUDPhase(6, "THE IMPOSSIBLE DECISION — ETHICS & RESOURCES");

    if (window.audioEngine) {
      window.audioEngine.speakRadioMessage(
        "Apollo-X, Ground relay restored for 60 seconds. We have one problem: orbital resources are insufficient for all objectives. You must make the call."
      );
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="dilemma-container">
          <div class="dilemma-title">⚖️ THE IMPOSSIBLE DECISION</div>
          <div class="dilemma-sub">Telemetry indicates remaining fuel and power can only guarantee ONE outcome:</div>
          <div class="dilemma-grid">
            <div class="dilemma-card" id="dil-ship">
              <div class="card-icon">🛰️</div>
              <div class="card-heading">SAVE THE SPACECRAFT</div>
              <div class="card-p">Conserve all remaining delta-V propellant for safe re-entry. Prioritizes vehicle survival and mission return.</div>
            </div>
            <div class="dilemma-card" id="dil-teammate">
              <div class="card-icon">🧑🚀</div>
              <div class="card-heading">SAVE YOUR TEAMMATE</div>
              <div class="card-p">Perform burn to intercept adrift crew capsule. Leaves absolute zero propellant margin for atmospheric re-entry.</div>
            </div>
            <div class="dilemma-card" id="dil-science">
              <div class="card-icon">🔬</div>
              <div class="card-heading">COMPLETE SCIENTIFIC OBJECTIVE</div>
              <div class="card-p">Burn battery power to transmit complete lunar quantum discovery before orbital degradation.</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById("dil-ship").addEventListener("click", () => this.resolveImpossibleDecision("ship"));
      document.getElementById("dil-teammate").addEventListener("click", () => this.resolveImpossibleDecision("teammate"));
      document.getElementById("dil-science").addEventListener("click", () => this.resolveImpossibleDecision("science"));
    }
  }

  resolveImpossibleDecision(choice) {
    if (window.aiDirector) {
      window.aiDirector.recordImpossibleDecision(choice);
    }
    this.showHUDNotification("ORDER LOGGED", `Astronaut Value Profile recorded: ${choice.toUpperCase()}`, "info");

    setTimeout(() => {
      this.transitionToPhase7();
    }, 2800);
  }

  // --- PHASE 7: FINAL CRISIS (ATMOSPHERIC RE-ENTRY) ---
  transitionToPhase7() {
    this.currentPhase = 7;
    this.reentryActive = true;
    this.updateHUDPhase(7, "ATMOSPHERIC RE-ENTRY — FINAL CRISIS");

    const reCond = window.aiDirector.calculateReentryConditions();
    this.reentrySeconds = reCond.timeLimitSec;

    if (window.audioEngine) {
      window.audioEngine.startReentryRoar();
      window.audioEngine.startAlarm("critical");
      window.audioEngine.setHeartbeatBpm(145);
    }
    if (window.cockpitScene) {
      window.cockpitScene.sceneMode = "reentry";
      window.cockpitScene.setScreenShake(0.95);
      window.cockpitScene.plasmaParticles.material.opacity = 0.85;
      window.cockpitScene.setAlarmVisuals(true);
      window.cockpitScene.updateMFDCanvas("HEAT SHIELD CRITICAL", window.aiDirector.telemetry.oxygenLevel, 101.3, reCond.powerLeft);
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="reentry-crisis-panel">
          <div class="crisis-header">
            <div class="crisis-title">⚠️ HEAT SHIELD FAILURE IMMINENT</div>
            <div class="crisis-countdown" id="reentry-clock">${this.reentrySeconds}s TO STRUCTURAL BREAKUP</div>
          </div>
          <div class="crisis-context">
            <strong>SYSTEM CONSTRAINTS INHERITED FROM YOUR PAST DECISIONS:</strong><br>
            • Backup Power: ${reCond.hasLostBackupPower ? '<span class="status-bad">OFFLINE (Rushed pre-flight)</span>' : '<span class="status-good">ONLINE</span>'}<br>
            • Attitude RCS: ${reCond.hasLostRcs ? '<span class="status-bad">COMPROMISED (Engine 2 blowout)</span>' : '<span class="status-good">OPERATIONAL</span>'}<br>
            • Avionics Drift: ${reCond.hasAvionicsBurn ? '<span class="status-bad">HIGH (Solar flare damage)</span>' : '<span class="status-good">STABLE</span>'}
          </div>
          <div class="crisis-controls">
            <button class="hud-action-btn" id="btn-trim-pitch">MANUAL PITCH TRIM COMPENSATION</button>
            <button class="hud-action-btn" id="btn-coolant-dump">DUMP AUXILIARY HEAT SINK COOLANT</button>
          </div>
        </div>
      `;

      document.getElementById("btn-trim-pitch").addEventListener("click", () => {
        this.pitchTrimBalanced = true;
        this.showHUDNotification("PITCH COMPENSATED", "Aerodynamic angle aligned with heat shield.", "success");
        this.checkReentrySurvival();
      });

      document.getElementById("btn-coolant-dump").addEventListener("click", () => {
        this.coolantDumped = true;
        this.showHUDNotification("COOLANT DUMPED", "Thermal barrier temperature dropping.", "success");
        this.checkReentrySurvival();
      });
    }

    // Re-entry Countdown
    this.emergencyTimer = setInterval(() => {
      this.reentrySeconds--;
      const clockEl = document.getElementById("reentry-clock");
      if (clockEl) clockEl.textContent = `${this.reentrySeconds}s TO STRUCTURAL BREAKUP`;

      if (this.reentrySeconds <= 0) {
        clearInterval(this.emergencyTimer);
        this.resolveReentry(this.pitchTrimBalanced && this.coolantDumped);
      }
    }, 1000);
  }

  checkReentrySurvival() {
    if (this.pitchTrimBalanced && this.coolantDumped) {
      clearInterval(this.emergencyTimer);
      setTimeout(() => {
        this.resolveReentry(true);
      }, 1500);
    }
  }

  resolveReentry(survived) {
    if (!this.reentryActive) return;
    this.reentryActive = false;
    clearInterval(this.emergencyTimer);

    if (window.aiDirector) {
      window.aiDirector.recordReentryResolution(survived, 90 - this.reentrySeconds);
    }

    if (window.audioEngine) {
      window.audioEngine.stopReentryRoar();
      window.audioEngine.stopAlarm();
      window.audioEngine.setHeartbeatBpm(72);
    }
    if (window.cockpitScene) {
      window.cockpitScene.setScreenShake(0.0);
      window.cockpitScene.plasmaParticles.material.opacity = 0.0;
      window.cockpitScene.setAlarmVisuals(false);
    }

    setTimeout(() => {
      this.transitionToPhase8(survived);
    }, 2000);
  }

  // --- PHASE 8: LANDING & DEBRIEF ---
  transitionToPhase8(survived) {
    this.currentPhase = 8;
    this.updateHUDPhase(8, "TOUCHDOWN & ASTRONAUT PERFORMANCE ASSESSMENT");

    if (window.audioEngine) {
      window.audioEngine.speakRadioMessage(
        survived
          ? "Welcome home, astronaut. Touchdown verified. Remove helmet and stand by for psychological assessment."
          : "Search and rescue telemetry dispatched. Mission debrief initialized."
      );
    }

    const actionArea = document.getElementById("hud-action-area");
    if (actionArea) actionArea.innerHTML = "";

    // Show the comprehensive Astronaut Assessment Modal
    this.renderDebriefModal();
  }

  renderDebriefModal() {
    const debriefContainer = document.getElementById("debrief-modal");
    if (!debriefContainer) return;
    debriefContainer.style.display = "flex";

    const assessment = window.aiDirector.generateFinalAssessment();
    const { title, summary, causalVerdict, metrics, memoryLog } = assessment;

    document.getElementById("debrief-persona-title").textContent = title;
    document.getElementById("debrief-summary").textContent = summary;
    document.getElementById("debrief-verdict").textContent = causalVerdict;

    // Metrics Score Bars
    document.getElementById("metric-decisions").textContent = metrics.decisionMaking;
    document.getElementById("bar-decisions").style.width = `${metrics.decisionMaking}%`;

    document.getElementById("metric-stress").textContent = metrics.stressManagement;
    document.getElementById("bar-stress").style.width = `${metrics.stressManagement}%`;

    document.getElementById("metric-tech").textContent = metrics.technicalSkills;
    document.getElementById("bar-tech").style.width = `${metrics.technicalSkills}%`;

    document.getElementById("metric-risk").textContent = metrics.riskManagement;
    document.getElementById("bar-risk").style.width = `${metrics.riskManagement}%`;

    document.getElementById("metric-attention").textContent = metrics.attention;
    document.getElementById("bar-attention").style.width = `${metrics.attention}%`;

    document.getElementById("metric-resources").textContent = metrics.resourceManagement;
    document.getElementById("bar-resources").style.width = `${metrics.resourceManagement}%`;

    // Render the Interactive Causal Mission Memory Graph
    if (window.MemoryGraphVisualizer) {
      const graphViz = new window.MemoryGraphVisualizer("memory-graph-content");
      graphViz.render(memoryLog, causalVerdict);
    }

    // Play Again button
    const replayBtn = document.getElementById("btn-replay-mission");
    if (replayBtn) {
      replayBtn.onclick = () => {
        window.location.reload();
      };
    }
  }

  // --- HUD HELPERS ---
  updateHUDPhase(phaseNum, phaseName) {
    const phaseEl = document.getElementById("hud-phase-name");
    const stepEl = document.getElementById("hud-phase-step");
    if (phaseEl) phaseEl.textContent = phaseName;
    if (stepEl) stepEl.textContent = `PHASE 0${phaseNum} / 08`;
  }

  showHUDNotification(title, message, type = "info") {
    const notif = document.getElementById("hud-notification");
    if (!notif) return;

    notif.className = `hud-notif ${type}`;
    notif.innerHTML = `
      <div class="notif-title">${title}</div>
      <div class="notif-body">${message}</div>
    `;
    notif.style.opacity = "1";
    notif.style.transform = "translateY(0)";

    setTimeout(() => {
      notif.style.opacity = "0";
      notif.style.transform = "translateY(-15px)";
    }, 4200);
  }
}

// Global instance
window.missionFlow = new MissionFlow();
