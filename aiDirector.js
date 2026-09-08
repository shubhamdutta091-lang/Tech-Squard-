/**
 * MOON VR: "THE LAST SIGNAL" - Adaptive AI Mission Director
 * The core brain: continuously observes player behavior, mistakes, reaction speed,
 * risk-taking, resource conservation, and stress response.
 * Builds persistent causal memory and dynamically adapts future phases.
 */

class AIDirector {
  constructor() {
    this.reset();
  }

  reset() {
    // Astronaut Behavioral Telemetry
    this.metrics = {
      decisionMaking: 85,
      stressManagement: 80,
      technicalSkills: 82,
      riskManagement: 75,
      attention: 88,
      resourceManagement: 84
    };

    // Live state tracking
    this.telemetry = {
      panicClicks: 0,
      rapidClickTimestamps: [],
      mistakesCount: 0,
      checklistCompleted: 0,
      checklistTotal: 5,
      totalResponseTimeSec: 0,
      emergencyResponseTimes: [],
      currentStress: 20, // 0 to 100
      oxygenLevel: 100,
      cabinPressure: 101.3, // kPa
      fuelReserve: 100, // %
      powerGridIntegrity: 100,
      hullIntegrity: 100,
      suitIntegrity: 100,
      scienceDataScore: 0,
      seed: Math.floor(Math.random() * 90000) + 10000
    };

    // Flags for cascading causal branches
    this.flags = {
      checkedOxygen: false,
      checkedComms: false,
      checkedNav: false,
      checkedPower: false,
      checkedEquipment: false,
      rushedLaunch: false,
      engine2DiagnosisTime: 0,
      engine2Correct: false,
      engine2FuelVented: false,
      hullLeakResponseTime: 0,
      hullPatchQuality: "nominal",
      evaTetherChecked: false,
      evaDriftIncident: false,
      solarStormChoice: null, // "return" | "repair" | "shield"
      adaptiveComplicationType: null,
      impossibleDecisionChoice: null, // "ship" | "teammate" | "science"
      backupPowerFunctional: true,
      rcsThrustersAvailable: true,
      reentryHeatShieldFailureReason: null,
      survived: true
    };

    // Persistent Causal Memory Graph Nodes
    this.memoryLog = [];

    // Live AI thought feed
    this.aiLogCallbacks = [];
  }

  onAILog(callback) {
    this.aiLogCallbacks.push(callback);
  }

  logThought(message, severity = "info") {
    console.log(`[AI DIRECTOR] [${severity.toUpperCase()}]: ${message}`);
    this.aiLogCallbacks.forEach(cb => cb(message, severity));
  }

  // Record an action into persistent causal memory
  recordMemory(phase, eventTitle, description, actionTaken, consequence, downstreamPhase, isFailureRoot = false) {
    const memoryNode = {
      id: "mem_" + (this.memoryLog.length + 1),
      timestamp: Date.now(),
      phase: phase,
      title: eventTitle,
      description: description,
      actionTaken: actionTaken,
      consequence: consequence,
      downstreamPhase: downstreamPhase,
      isFailureRoot: isFailureRoot
    };

    this.memoryLog.push(memoryNode);
    this.logThought(`MEMORY STORED: "${eventTitle}" -> Consequence: "${consequence}"`, isFailureRoot ? "warning" : "info");
    return memoryNode;
  }

  // Monitor clicks for panic behavior
  registerInteraction(isCorrectAction = true) {
    const now = Date.now();
    this.telemetry.rapidClickTimestamps.push(now);

    // Keep timestamps from the last 3.5 seconds
    this.telemetry.rapidClickTimestamps = this.telemetry.rapidClickTimestamps.filter(t => now - t < 3500);

    // If more than 5 clicks in 3.5 seconds, player is panicking
    if (this.telemetry.rapidClickTimestamps.length >= 5) {
      this.telemetry.panicClicks++;
      this.telemetry.currentStress = Math.min(100, this.telemetry.currentStress + 8);
      this.metrics.stressManagement = Math.max(25, this.metrics.stressManagement - 3);
      this.logThought(`BEHAVIOR DETECTED: Erratic / Rapid interaction frequency. Stress escalating to ${Math.round(this.telemetry.currentStress)}%.`, "alert");
      if (window.audioEngine) {
        window.audioEngine.setHeartbeatBpm(75 + (this.telemetry.currentStress * 0.7));
      }
    }

    if (!isCorrectAction) {
      this.telemetry.mistakesCount++;
      this.metrics.technicalSkills = Math.max(20, this.metrics.technicalSkills - 4);
      this.telemetry.currentStress = Math.min(100, this.telemetry.currentStress + 5);
      this.logThought(`OPERATIONAL ERROR: Incorrect panel actuation. Mistake count: ${this.telemetry.mistakesCount}.`, "warning");
    }
  }

  // --- PHASE 1 ADAPTIVE LOGIC ---
  evaluatePreflightChecklist() {
    const checks = [
      this.flags.checkedOxygen,
      this.flags.checkedComms,
      this.flags.checkedNav,
      this.flags.checkedPower,
      this.flags.checkedEquipment
    ];
    this.telemetry.checklistCompleted = checks.filter(Boolean).length;
    const completeness = (this.telemetry.checklistCompleted / this.telemetry.checklistTotal) * 100;

    if (completeness < 60) {
      this.flags.rushedLaunch = true;
      this.metrics.attention = Math.max(30, this.metrics.attention - 25);
      this.metrics.riskManagement = Math.max(35, this.metrics.riskManagement - 15);
      this.flags.backupPowerFunctional = false;

      this.recordMemory(
        1,
        "Rushed Pre-Flight Checklist",
        "Astronaut bypassed essential life support and electrical bus diagnostic verifications.",
        "Rapid ignition without checklist completion",
        "Electrical bus uncalibrated; backup battery capacitor damaged for late-mission re-entry",
        7,
        true
      );
      this.logThought("EVALUATION: Trainee displays severe rush syndrome. Checklist skipped. Storing downstream consequence for Re-entry Phase.", "warning");
    } else if (completeness === 100) {
      this.metrics.attention = Math.min(99, this.metrics.attention + 10);
      this.metrics.technicalSkills = Math.min(99, this.metrics.technicalSkills + 5);
      this.recordMemory(
        1,
        "Methodical Pre-Flight Discipline",
        "All five primary ship subsystems meticulously inspected and balanced.",
        "Full pre-flight verification",
        "Ship bus optimized; +15% power redundancy granted for critical operations",
        7,
        false
      );
      this.logThought("EVALUATION: Exceptional preparation discipline observed.", "info");
    }
  }

  recordEngine2Diagnosis(responseTimeSec, isCorrect) {
    this.flags.engine2DiagnosisTime = responseTimeSec;
    this.flags.engine2Correct = isCorrect;
    this.telemetry.emergencyResponseTimes.push(responseTimeSec);

    if (isCorrect && responseTimeSec <= 8.5) {
      this.metrics.decisionMaking = Math.min(98, this.metrics.decisionMaking + 8);
      this.metrics.technicalSkills = Math.min(98, this.metrics.technicalSkills + 6);
      this.recordMemory(
        1,
        "Instantaneous Engine Anomaly Diagnosis",
        `Isolated Engine 2 turbopump overpressure in ${responseTimeSec.toFixed(1)}s before turbine blade shear.`,
        "Rapid bypass closure",
        "Fuel reserves fully protected; nominal delta-V maintained",
        7,
        false
      );
      this.logThought(`HIGH PERFORMANCE: Engine 2 diagnosed in ${responseTimeSec.toFixed(1)}s. Fuel fully preserved.`, "info");
    } else if (isCorrect && responseTimeSec <= 15) {
      this.telemetry.fuelReserve -= 12;
      this.metrics.decisionMaking = Math.max(40, this.metrics.decisionMaking - 4);
      this.recordMemory(
        1,
        "Delayed Engine 2 Isolation",
        `Diagnosis completed in ${responseTimeSec.toFixed(1)}s, allowing partial fuel vent to prevent structural rupture.`,
        "Delayed manual valve override",
        "12% fuel reserve lost to prevent manifold blowout",
        6,
        false
      );
      this.logThought(`MODERATE DELAY: Fuel reserve reduced to ${this.telemetry.fuelReserve}%.`, "warning");
    } else {
      // Failed or timed out
      this.flags.engine2FuelVented = true;
      this.telemetry.fuelReserve -= 26;
      this.flags.rcsThrustersAvailable = false;
      this.metrics.decisionMaking = Math.max(30, this.metrics.decisionMaking - 22);
      this.metrics.technicalSkills = Math.max(30, this.metrics.technicalSkills - 20);
      this.recordMemory(
        1,
        "Engine 2 Manifold Blowout",
        "Failed to isolate turbine pressure within emergency threshold. Auto-vent dumped emergency propellant.",
        "Incorrect or expired diagnostic response",
        "26% fuel reserve exhausted; fine RCS attitude thrusters disabled for atmospheric entry",
        7,
        true
      );
      this.logThought("CRITICAL EVENT: Engine 2 failure unmanaged. Severe propellant penalty applied.", "alert");
    }
  }

  // --- PHASE 2 ADAPTIVE LOGIC ---
  recordHullBreachResponse(responseTimeSec, patchAppliedCleanly) {
    this.flags.hullLeakResponseTime = responseTimeSec;
    this.flags.hullPatchQuality = patchAppliedCleanly ? "nominal" : "compromised";

    if (patchAppliedCleanly && responseTimeSec <= 18) {
      this.telemetry.cabinPressure = 98.4;
      this.telemetry.oxygenLevel = Math.max(88, this.telemetry.oxygenLevel - 4);
      this.metrics.stressManagement = Math.min(98, this.metrics.stressManagement + 6);
      this.recordMemory(
        2,
        "Rapid Micrometeoroid Hull Seal",
        `Breach located and sealed within ${responseTimeSec.toFixed(1)}s. Cabin pressure stabilized.`,
        "Immediate sealant applicator deployment",
        "Life support reserves secured at 94%+",
        5,
        false
      );
      this.logThought("ORBIT HAZARD: Breach sealed with minimal atmosphere venting.", "info");
    } else {
      this.telemetry.cabinPressure = 79.2;
      this.telemetry.oxygenLevel = 72;
      this.metrics.resourceManagement = Math.max(35, this.metrics.resourceManagement - 20);
      this.metrics.stressManagement = Math.max(35, this.metrics.stressManagement - 16);
      this.recordMemory(
        2,
        "Severe Atmospheric Decompression",
        `Hull puncture took ${responseTimeSec.toFixed(1)}s to seal; cabin pressure dropped below 80 kPa.`,
        "Slow puncture localization",
        "Primary oxygen reserve crippled to 72%; astronaut cognitive stamina degraded",
        5,
        true
      );
      this.logThought("CRITICAL RESOURCE LOSS: Oxygen reserve compromised. Trainee cognitive load elevated.", "alert");
    }
  }

  // --- PHASE 3 ADAPTIVE LOGIC ---
  recordEVAPreparation(tetherChecked, suitPressureChecked) {
    this.flags.evaTetherChecked = tetherChecked;

    if (!tetherChecked) {
      this.flags.evaDriftIncident = true;
      this.metrics.attention = Math.max(25, this.metrics.attention - 18);
      this.metrics.riskManagement = Math.max(30, this.metrics.riskManagement - 20);
      this.recordMemory(
        3,
        "Skipped Tether Lock Verification",
        "Astronaut exited airlock into vacuum without verifying magnetic tether carabiner lock.",
        "Direct airlock egress without tether safety check",
        "Tether snapped free during satellite approach; mandatory thruster burn burned 8% O2/fuel",
        4,
        true
      );
      this.logThought("DANGEROUS PROTOCOL VIOLATION: Tether neglected. Preparing zero-g drift emergency.", "alert");
    } else {
      this.metrics.attention = Math.min(99, this.metrics.attention + 5);
      this.recordMemory(
        3,
        "Disciplined EVA Egress",
        "Tether and suit pressure seals verified prior to airlock depressurization.",
        "Full tether lock protocol executed",
        "Zero-g stability guaranteed during satellite contact",
        4,
        false
      );
      this.logThought("EVA PROTOCOL: Astronaut safety tether properly anchored.", "info");
    }
  }

  // --- PHASE 4 ADAPTIVE LOGIC (Solar Storm) ---
  recordSolarStormDecision(choice) {
    this.flags.solarStormChoice = choice;

    if (choice === "return") {
      this.metrics.riskManagement = Math.min(95, this.metrics.riskManagement + 12);
      this.metrics.resourceManagement = Math.min(95, this.metrics.resourceManagement + 8);
      this.telemetry.suitIntegrity = 96;
      this.telemetry.scienceDataScore += 15;
      this.recordMemory(
        4,
        "Conservative Storm Evacuation",
        "Astronaut prioritized biological survival and aborted satellite repair immediately.",
        "Immediate airlock retreat",
        "Astronaut radiation exposure minimized; scientific telemetry unrecovered",
        6,
        false
      );
      this.logThought("BEHAVIOR PATTERN: Cautious / Survival-first posture confirmed.", "info");
    } else if (choice === "repair") {
      this.metrics.riskManagement = Math.max(30, this.metrics.riskManagement - 22);
      this.metrics.technicalSkills = Math.min(99, this.metrics.technicalSkills + 14);
      this.telemetry.scienceDataScore += 95;
      this.telemetry.suitIntegrity = 64;
      this.telemetry.powerGridIntegrity -= 18;
      this.recordMemory(
        4,
        "High-Risk Satellite Telemetry Recovery",
        "Braved ionizing solar radiation storm to complete scientific sensor array calibration.",
        "Continued EVA during radiation influx",
        "Quantum scientific telemetry secured (+95%), but suit avionics suffered ion burn",
        7,
        true
      );
      this.logThought("BEHAVIOR PATTERN: Extreme risk tolerance. Avionics damaged by solar proton stream.", "warning");
    } else {
      // "shield"
      this.metrics.riskManagement = 78;
      this.telemetry.suitIntegrity = 86;
      this.telemetry.scienceDataScore += 55;
      this.telemetry.powerGridIntegrity -= 6;
      this.recordMemory(
        4,
        "Calculated Hull Shadow Maneuver",
        "Positioned behind spacecraft thermal radiation tiles, balancing shielding with sensor line of sight.",
        "Tactical shadow shielding",
        "Moderate scientific recovery (55%) with acceptable 14% suit thermal wear",
        6,
        false
      );
      this.logThought("BEHAVIOR PATTERN: Analytical tactical compromise.", "info");
    }
  }

  // --- PHASE 5 ADAPTIVE COMPLICATION INJECTION ---
  generateAdaptiveComplication() {
    // Determine dynamic complication based on player's accumulated profile
    const isCalm = this.metrics.stressManagement >= 75 && this.telemetry.panicClicks < 3;
    const isCareless = this.metrics.attention < 65 || this.telemetry.mistakesCount >= 3;
    const isResourceDepleted = this.telemetry.oxygenLevel < 80 || this.telemetry.fuelReserve < 75;

    let complication = {};

    if (isCareless || isResourceDepleted) {
      complication = {
        type: "cascading_resource_loss",
        title: "OXYGEN SCRUBBER SATURATION CRITICAL",
        description: "Because earlier hull depressurization stressed life support, the lithium hydroxide scrubber is choking.",
        actionNeeded: "Manual bypass valve rotation & filter canister swap",
        urgency: "CRITICAL",
        rootCause: "Result of earlier unmanaged pressure leak or rushed checklist"
      };
      this.logThought("AI INTERVENTION: Trainee previously neglected systems. Triggering cascading life support crisis.", "alert");
    } else if (isCalm) {
      complication = {
        type: "technical_deep_puzzle",
        title: "QUANTUM RELAY FREQUENCY HARMONIZATION",
        description: "Trainee is operating with high mental clarity. Introducing complex multi-channel frequency alignment.",
        actionNeeded: "Match 3 harmonic waveforms on the navigation computer",
        urgency: "HIGH_TECH",
        rootCause: "Autonomous AI calibration: increasing technical complexity for calm astronaut"
      };
      this.logThought("AI INTERVENTION: Astronaut calm. Escalating technical complexity to test maximum operational limit.", "info");
    } else {
      complication = {
        type: "electrical_breaker_overload",
        title: "ATTITUDE INVERTER SHORT-CIRCUIT",
        description: "High stress erratic switching caused power surge in the primary avionics inverter.",
        actionNeeded: "Reset Breakers 3, 5, and auxiliary transformer switch",
        urgency: "WARNING",
        rootCause: "Directly induced by erratic switch actuation in previous phases"
      };
      this.logThought("AI INTERVENTION: Erratic interactions detected. Triggering electrical breaker trip.", "warning");
    }

    this.flags.adaptiveComplicationType = complication.type;
    return complication;
  }

  // --- PHASE 6 THE IMPOSSIBLE DECISION ---
  recordImpossibleDecision(choice) {
    this.flags.impossibleDecisionChoice = choice;

    if (choice === "ship") {
      this.metrics.resourceManagement = Math.min(98, this.metrics.resourceManagement + 10);
      this.recordMemory(
        6,
        "Prioritized Spacecraft & Self-Preservation",
        "Reserved remaining propellant and thermal reserves exclusively for vehicle atmospheric return.",
        "Conserve ship systems",
        "Spacecraft structurally intact; ground mission deemed partial tactical success",
        7,
        false
      );
      this.logThought("PSYCHOLOGICAL ASSESSMENT: Pragmatic survival-oriented decision-maker.", "info");
    } else if (choice === "teammate") {
      this.telemetry.fuelReserve -= 18;
      this.metrics.stressManagement = Math.min(95, this.metrics.stressManagement + 12);
      this.metrics.riskManagement = Math.max(35, this.metrics.riskManagement - 15);
      this.recordMemory(
        6,
        "Diverted Propellant to Retrieve Injured Teammate",
        "Ignited orbital burn to intercept adrift crew capsule, expending reserve margin for re-entry.",
        "High-risk crew rescue burn",
        "Teammate life saved; re-entry fuel margin reduced to absolute zero tolerance",
        7,
        true
      );
      this.logThought("PSYCHOLOGICAL ASSESSMENT: Altruistic warrior. Sacrificed safety margins for human life.", "warning");
    } else {
      // "science"
      this.telemetry.powerGridIntegrity -= 15;
      this.telemetry.scienceDataScore += 100;
      this.recordMemory(
        6,
        "Prioritized Lunar Quantum Discovery",
        "Directed remaining electrical battery power to beam breakthrough deep-space dataset to Earth.",
        "Max power scientific transmitter burn",
        "Global science community receives revolutionary lunar dataset; ship power depleted",
        7,
        true
      );
      this.logThought("PSYCHOLOGICAL ASSESSMENT: Visionary pioneer. Placed human knowledge above physical vessel.", "info");
    }
  }

  // --- PHASE 7 RE-ENTRY OUTCOME CALCULATION ---
  calculateReentryConditions() {
    const hasLostRcs = !this.flags.rcsThrustersAvailable || this.flags.engine2FuelVented;
    const hasLostBackupPower = !this.flags.backupPowerFunctional || this.flags.rushedLaunch;
    const hasAvionicsBurn = this.flags.solarStormChoice === "repair";

    return {
      hasLostRcs,
      hasLostBackupPower,
      hasAvionicsBurn,
      fuelLeft: this.telemetry.fuelReserve,
      powerLeft: this.telemetry.powerGridIntegrity,
      timeLimitSec: hasLostBackupPower ? 70 : 90
    };
  }

  recordReentryResolution(survived, responseTimeSec) {
    this.flags.survived = survived;

    if (survived) {
      this.recordMemory(
        7,
        "Atmospheric Re-entry Vector Stabilized",
        `Maintained heat shield orientation through severe turbulence in ${responseTimeSec.toFixed(1)}s despite accumulated system strain.`,
        "Manual pitch compensation and plasma barrier alignment",
        "Spacecraft penetrated troposphere intact; Drogue parachutes armed",
        8,
        false
      );
      this.logThought("MISSION RECOVERY: Trainee successfully brought vessel through atmospheric inferno.", "info");
    } else {
      this.recordMemory(
        7,
        "Thermal Shield Angle Collapse",
        "Aerodynamic deceleration angle exceeded thermal envelope due to earlier fuel and power constraints.",
        "Atmospheric skip / thermal breach",
        "Vessel lost during final terminal descent",
        8,
        true
      );
      this.logThought("MISSION CATASTROPHE: Vessel compromised during re-entry.", "alert");
    }
  }

  // --- FINAL PSYCHOLOGICAL & TECHNICAL EVALUATION (Phase 8) ---
  generateFinalAssessment() {
    // Dynamic Persona Title
    let title = "ASTRONAUT CANDIDATE";
    let summary = "";

    const { decisionMaking, stressManagement, technicalSkills, riskManagement, attention, resourceManagement } = this.metrics;

    if (riskManagement < 50 && technicalSkills >= 80) {
      title = "CALCULATED DAREDEVIL";
      summary = "You possess brilliant technical intuition, but you frequently push system safety envelopes beyond recommended thresholds when under time pressure.";
    } else if (stressManagement >= 85 && attention >= 85) {
      title = "VANGUARD COMMANDER";
      summary = "You demonstrate exceptional psychological composure and meticulous pre-flight discipline. Under chaotic emergency conditions, your operational accuracy remained virtually flawless.";
    } else if (attention < 60) {
      title = "INSTINCTIVE SURVIVOR";
      summary = "You react rapidly by instinct rather than following standard operating procedures. While you survived critical hazards, your early oversights directly induced the catastrophic crises encountered late in the mission.";
    } else if (resourceManagement >= 85) {
      title = "METHODICAL FLIGHT SPECIALIST";
      summary = "You show extraordinary conservation discipline. You protected life support and propellant reserves with precision, ensuring survival options remained open until touchdown.";
    } else {
      title = "ADAPTIVE OPERATOR";
      summary = "You demonstrated resilient adaptability across unexpected deep-space hazards, overcoming early mechanical setbacks through tenacity and decisive crisis intervention.";
    }

    // Dynamic Root Cause Callout
    // Finding the earliest root cause mistake
    const rootMistake = this.memoryLog.find(m => m.isFailureRoot);
    let causalVerdict = "Your mission proceeded with textbook precision and minimal secondary fallout.";
    if (rootMistake) {
      causalVerdict = `You didn't struggle in Phase 7 because of the heat shield alarm. Your mission was endangered back in Phase ${rootMistake.phase} when you: "${rootMistake.actionTaken}". It remembered you.`;
    }

    return {
      title,
      summary,
      causalVerdict,
      metrics: {
        decisionMaking: Math.round(decisionMaking),
        stressManagement: Math.round(stressManagement),
        technicalSkills: Math.round(technicalSkills),
        riskManagement: Math.round(riskManagement),
        attention: Math.round(attention),
        resourceManagement: Math.round(resourceManagement)
      },
      telemetry: this.telemetry,
      memoryLog: this.memoryLog
    };
  }
}

// Global instance
window.aiDirector = new AIDirector();
