/**
 * MOON VR: "THE LAST SIGNAL" - 3D Cockpit & Space Environment Engine
 * Built with Three.js (WebGL + WebXR).
 * Supports VR headsets (Meta Quest, Vive, etc.) & Desktop 6DOF first-person controls.
 */

class CockpitScene {
  constructor() {
    this.container = document.getElementById("canvas-container");
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Interaction raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactables = [];
    this.hoveredObject = null;

    // Controls state
    this.isPointerLocked = false;
    this.cameraPitch = 0;
    this.cameraYaw = 0;
    this.moveSpeed = 0.05;
    this.keys = {};

    // 3D Objects
    this.cockpitGroup = null;
    this.earthGroup = null;
    this.earthMesh = null;
    this.cloudMesh = null;
    this.atmosphereMesh = null;
    this.moonMesh = null;
    this.starfield = null;
    this.dustParticles = null;
    this.satelliteMesh = null;
    this.plasmaParticles = null;
    this.hullBreachHole = null;
    this.tetherLine = null;

    // Lights
    this.ambientLight = null;
    this.cockpitCyanLight = null;
    this.cockpitRedAlarmLight = null;
    this.sunLight = null;

    // Animated levers & switches
    this.switches = {};
    this.ignitionLever = null;
    this.sealantTool = null;

    // MFD canvas screens
    this.mfdCanvas = null;
    this.mfdCtx = null;
    this.mfdTexture = null;

    // Screen Shake
    this.shakeIntensity = 0;

    // Current scene mode: "cockpit" | "eva" | "reentry"
    this.sceneMode = "cockpit";

    // WebXR controllers
    this.controllers = [];
  }

  init() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000208, 0.0003);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 10000);
    this.camera.position.set(0, 1.25, 0); // Trainee seated eye position

    // 3. Renderer with ACES Filmic tonemapping & WebXR
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.setupLighting();

    // 5. Starfield & Space Environment
    this.createStarfield();
    this.createEarthAndMoon();
    this.createFloatingDust();

    // 6. Cockpit Interior & MFDs
    this.createCockpitInterior();
    this.createInteractiveSwitches();
    this.createSatelliteForEVA();
    this.createReentryPlasma();

    // 7. Event Listeners & WebXR
    this.setupEventListeners();
    this.setupWebXR();

    // 8. Animation Loop
    this.renderer.setAnimationLoop(() => this.render());
    console.log("[CockpitScene] 3D Cockpit & WebXR initialized.");
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x0a1226, 0.6);
    this.scene.add(this.ambientLight);

    // Distant Sun
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.5);
    this.sunLight.position.set(400, 200, -600);
    this.scene.add(this.sunLight);

    // Cockpit cyan interior console wash
    this.cockpitCyanLight = new THREE.PointLight(0x00e5ff, 1.8, 3.5);
    this.cockpitCyanLight.position.set(0, 1.4, -0.4);
    this.scene.add(this.cockpitCyanLight);

    // Emergency red alarm strobe (initially off)
    this.cockpitRedAlarmLight = new THREE.PointLight(0xff0033, 0.0, 4.0);
    this.cockpitRedAlarmLight.position.set(0, 1.6, -0.2);
    this.scene.add(this.cockpitRedAlarmLight);
  }

  // --- CELESTIAL BODIES (Earth, Moon, Stars) ---
  createStarfield() {
    const starCount = 4500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 1800 + Math.random() * 800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);

      const colorTint = Math.random();
      if (colorTint > 0.8) {
        colors[i] = 0.7; colors[i+1] = 0.85; colors[i+2] = 1.0; // Blue star
      } else if (colorTint > 0.6) {
        colors[i] = 1.0; colors[i+1] = 0.85; colors[i+2] = 0.6; // Amber star
      } else {
        colors[i] = 0.95; colors[i+1] = 0.95; colors[i+2] = 1.0; // White star
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  createEarthAndMoon() {
    this.earthGroup = new THREE.Group();
    this.earthGroup.position.set(220, -140, -480);
    this.earthGroup.rotation.z = 0.22; // Axial tilt

    // Procedural Earth Texture Canvas
    const earthCanvas = document.createElement("canvas");
    earthCanvas.width = 1024;
    earthCanvas.height = 512;
    const eCtx = earthCanvas.getContext("2d");

    // Deep Ocean gradient
    const oceanGrad = eCtx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0, "#08254f");
    oceanGrad.addColorStop(0.5, "#0b3975");
    oceanGrad.addColorStop(1, "#071b3b");
    eCtx.fillStyle = oceanGrad;
    eCtx.fillRect(0, 0, 1024, 512);

    // Continents
    eCtx.fillStyle = "#1e4d2b";
    for (let c = 0; c < 45; c++) {
      const cx = (c * 67) % 1024;
      const cy = 100 + ((c * 43) % 312);
      const rad = 35 + ((c * 19) % 65);
      eCtx.beginPath();
      eCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      eCtx.fill();
    }
    // Polar ice caps
    eCtx.fillStyle = "#e0f2fe";
    eCtx.fillRect(0, 0, 1024, 38);
    eCtx.fillRect(0, 474, 1024, 38);

    const earthTexture = new THREE.CanvasTexture(earthCanvas);
    const earthGeo = new THREE.SphereGeometry(180, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.45,
      metalness: 0.1
    });
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthGroup.add(this.earthMesh);

    // Earth Clouds
    const cloudCanvas = document.createElement("canvas");
    cloudCanvas.width = 1024;
    cloudCanvas.height = 512;
    const cCtx = cloudCanvas.getContext("2d");
    cCtx.fillStyle = "rgba(0,0,0,0)";
    cCtx.fillRect(0, 0, 1024, 512);
    cCtx.fillStyle = "rgba(255, 255, 255, 0.45)";
    for (let i = 0; i < 90; i++) {
      const x = (i * 47) % 1024;
      const y = (i * 31) % 512;
      cCtx.beginPath();
      cCtx.ellipse(x, y, 70, 22, (i * 0.3), 0, Math.PI * 2);
      cCtx.fill();
    }
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    const cloudGeo = new THREE.SphereGeometry(182.5, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.earthGroup.add(this.cloudMesh);

    // Atmospheric scattering rim glow
    const atmoGeo = new THREE.SphereGeometry(186, 48, 48);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4da6ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    this.atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.earthGroup.add(this.atmosphereMesh);

    this.scene.add(this.earthGroup);

    // The Moon in distance
    const moonGeo = new THREE.SphereGeometry(35, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xc8ced6,
      roughness: 0.9,
      metalness: 0.05
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.position.set(-360, 160, -750);
    this.scene.add(this.moonMesh);
  }

  createFloatingDust() {
    const dustCount = 350;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 4.5;
      positions[i + 1] = 0.5 + Math.random() * 2.2;
      positions[i + 2] = (Math.random() - 0.5) * 4.5;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.035,
      color: 0x88ccff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });

    this.dustParticles = new THREE.Points(geometry, material);
    this.scene.add(this.dustParticles);
  }

  // --- 3D COCKPIT INTERIOR ---
  createCockpitInterior() {
    this.cockpitGroup = new THREE.Group();

    // Cockpit Shell (Fuselage interior)
    const shellGeo = new THREE.CylinderGeometry(2.4, 2.6, 5.0, 16, 1, true, -Math.PI / 2, Math.PI);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x121722,
      roughness: 0.75,
      metalness: 0.3,
      side: THREE.BackSide
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.rotation.z = Math.PI / 2;
    shell.position.set(0, 1.4, 0);
    this.cockpitGroup.add(shell);

    // Forward Main Console Console
    const consoleGeo = new THREE.BoxGeometry(2.2, 0.85, 0.9);
    const consoleMat = new THREE.MeshStandardMaterial({
      color: 0x1a2130,
      roughness: 0.6,
      metalness: 0.4
    });
    const mainConsole = new THREE.Mesh(consoleGeo, consoleMat);
    mainConsole.position.set(0, 0.75, -1.05);
    mainConsole.rotation.x = -0.32;
    this.cockpitGroup.add(mainConsole);

    // Overhead Canopy Ribs
    const ribGeo = new THREE.TorusGeometry(2.25, 0.045, 8, 24, Math.PI);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x222a3a, metalness: 0.7, roughness: 0.3 });
    const rib1 = new THREE.Mesh(ribGeo, ribMat);
    rib1.rotation.y = Math.PI / 2;
    rib1.position.set(0, 1.4, -0.6);
    this.cockpitGroup.add(rib1);

    const rib2 = new THREE.Mesh(ribGeo, ribMat);
    rib2.rotation.y = Math.PI / 2;
    rib2.position.set(0, 1.4, 0.5);
    this.cockpitGroup.add(rib2);

    // Center Window Frame Strut
    const centerStrutGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8);
    const centerStrut = new THREE.Mesh(centerStrutGeo, ribMat);
    centerStrut.position.set(0, 2.0, -0.9);
    centerStrut.rotation.x = -0.65;
    this.cockpitGroup.add(centerStrut);

    // Canopy Glass (Subtle reflection)
    const glassGeo = new THREE.SphereGeometry(2.45, 24, 16, 0, Math.PI, 0, Math.PI / 2);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88bbdd,
      transparent: true,
      opacity: 0.12,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.85,
      ior: 1.45
    });
    const canopyGlass = new THREE.Mesh(glassGeo, glassMat);
    canopyGlass.rotation.x = -Math.PI / 2;
    canopyGlass.position.set(0, 1.4, 0);
    this.cockpitGroup.add(canopyGlass);

    // Multi-Function Display (MFD) Canvas Screen
    this.mfdCanvas = document.createElement("canvas");
    this.mfdCanvas.width = 1024;
    this.mfdCanvas.height = 512;
    this.mfdCtx = this.mfdCanvas.getContext("2d");
    this.updateMFDCanvas("NOMINAL", 100, 101.3, 100);

    this.mfdTexture = new THREE.CanvasTexture(this.mfdCanvas);
    const mfdGeo = new THREE.PlaneGeometry(1.4, 0.55);
    const mfdMat = new THREE.MeshBasicMaterial({ map: this.mfdTexture });
    const mfdScreen = new THREE.Mesh(mfdGeo, mfdMat);
    mfdScreen.position.set(0, 0.95, -0.94);
    mfdScreen.rotation.x = -0.32;
    this.cockpitGroup.add(mfdScreen);

    // Astronaut Flight Seat
    const seatBaseGeo = new THREE.BoxGeometry(0.75, 0.5, 0.8);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x181e2b, roughness: 0.8 });
    const seatBase = new THREE.Mesh(seatBaseGeo, seatMat);
    seatBase.position.set(0, 0.35, 0.1);
    this.cockpitGroup.add(seatBase);

    const seatBackGeo = new THREE.BoxGeometry(0.7, 1.1, 0.2);
    const seatBack = new THREE.Mesh(seatBackGeo, seatMat);
    seatBack.position.set(0, 0.95, 0.45);
    seatBack.rotation.x = -0.15;
    this.cockpitGroup.add(seatBack);

    // Phase 2 Micrometeoroid Hull Rupture point on right hull
    const breachGroup = new THREE.Group();
    breachGroup.position.set(1.45, 1.1, -0.3);
    breachGroup.rotation.y = -Math.PI / 2;

    const breachRimGeo = new THREE.RingGeometry(0.015, 0.065, 16);
    const breachRimMat = new THREE.MeshStandardMaterial({ color: 0x442211, roughness: 0.9 });
    const breachRim = new THREE.Mesh(breachRimGeo, breachRimMat);
    breachGroup.add(breachRim);

    const punctureHoleGeo = new THREE.CircleGeometry(0.018, 16);
    const punctureHoleMat = new THREE.MeshBasicMaterial({ color: 0x000208 });
    const punctureHole = new THREE.Mesh(punctureHoleGeo, punctureHoleMat);
    punctureHole.position.z = 0.002;
    breachGroup.add(punctureHole);

    // Glowing alert beacon around leak
    const leakBeaconGeo = new THREE.RingGeometry(0.07, 0.09, 16);
    const leakBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.0 });
    const leakBeacon = new THREE.Mesh(leakBeaconGeo, leakBeaconMat);
    leakBeacon.position.z = 0.003;
    breachGroup.add(leakBeacon);
    breachGroup.userData = { interactable: true, type: "breach", isSealed: false, beacon: leakBeacon };

    this.hullBreachHole = breachGroup;
    this.hullBreachHole.visible = false;
    this.cockpitGroup.add(this.hullBreachHole);
    this.interactables.push(this.hullBreachHole);

    this.scene.add(this.cockpitGroup);
  }

  // --- INTERACTIVE SWITCHES & LEVERS ---
  createInteractiveSwitches() {
    const switchDefs = [
      { id: "o2", label: "O2 PRIMARY", pos: [-0.62, 0.72, -0.92], color: 0x00ffff },
      { id: "comms", label: "COMMS UPLINK", pos: [-0.31, 0.72, -0.92], color: 0x38bdf8 },
      { id: "nav", label: "NAV COMPUTER", pos: [0.0, 0.72, -0.92], color: 0x3b82f6 },
      { id: "power", label: "POWER BUS", pos: [0.31, 0.72, -0.92], color: 0xa855f7 },
      { id: "cargo", label: "LOCK EQUIPMENT", pos: [0.62, 0.72, -0.92], color: 0x10b981 },
      // Phase 1 Engine 2 emergency bypass
      { id: "eng2_bypass", label: "ENG 2 BYPASS", pos: [0.78, 0.95, -0.88], color: 0xf59e0b, emergencyOnly: true }
    ];

    switchDefs.forEach(def => {
      const switchGroup = new THREE.Group();
      switchGroup.position.set(def.pos[0], def.pos[1], def.pos[2]);
      switchGroup.rotation.x = -0.32;

      // Base plate
      const plateGeo = new THREE.BoxGeometry(0.16, 0.12, 0.03);
      const plateMat = new THREE.MeshStandardMaterial({ color: 0x222a38, metalness: 0.8, roughness: 0.4 });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      switchGroup.add(plate);

      // Rocker Switch Lever
      const rockerGeo = new THREE.BoxGeometry(0.06, 0.07, 0.05);
      const rockerMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        emissive: 0x000000,
        roughness: 0.3
      });
      const rocker = new THREE.Mesh(rockerGeo, rockerMat);
      rocker.position.z = 0.035;
      rocker.rotation.x = -0.35; // Initial OFF position
      switchGroup.add(rocker);

      // Status LED indicator
      const ledGeo = new THREE.CircleGeometry(0.015, 12);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(0, 0.04, 0.02);
      switchGroup.add(led);

      switchGroup.userData = {
        interactable: true,
        type: "switch",
        switchId: def.id,
        label: def.label,
        active: false,
        rocker: rocker,
        led: led,
        accentColor: def.color,
        emergencyOnly: !!def.emergencyOnly
      };

      if (def.emergencyOnly) {
        switchGroup.visible = false;
      }

      this.switches[def.id] = switchGroup;
      this.cockpitGroup.add(switchGroup);
      this.interactables.push(switchGroup);
    });

    // Physical Ignition & Throttle Lever (Right Console)
    const throttleGroup = new THREE.Group();
    throttleGroup.position.set(0.68, 0.65, -0.45);

    const tBaseGeo = new THREE.BoxGeometry(0.14, 0.22, 0.4);
    const tBaseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7, roughness: 0.3 });
    const tBase = new THREE.Mesh(tBaseGeo, tBaseMat);
    throttleGroup.add(tBase);

    // Lever arm
    const leverPivot = new THREE.Group();
    leverPivot.position.set(0, 0.08, 0.12);

    const armGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.28, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.y = 0.14;
    leverPivot.add(arm);

    // T-Handle Grip
    const handleGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.11, 8);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.4,
      emissive: 0x7f1d1d
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.y = 0.28;
    leverPivot.add(handle);

    throttleGroup.add(leverPivot);
    throttleGroup.userData = {
      interactable: true,
      type: "lever",
      leverId: "ignition",
      label: "THRUST IGNITION LEVER",
      pivot: leverPivot,
      pulled: false
    };

    this.ignitionLever = throttleGroup;
    this.cockpitGroup.add(this.ignitionLever);
    this.interactables.push(this.ignitionLever);

    // Emergency Hull Sealant Tool (mounted on side console)
    const toolGroup = new THREE.Group();
    toolGroup.position.set(-0.75, 0.65, -0.4);

    const canisterGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.24, 12);
    const canisterMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.4 });
    const canister = new THREE.Mesh(canisterGeo, canisterMat);
    toolGroup.add(canister);

    const nozzleGeo = new THREE.ConeGeometry(0.022, 0.08, 12);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.y = 0.14;
    toolGroup.add(nozzle);

    toolGroup.userData = {
      interactable: true,
      type: "tool",
      toolId: "sealant",
      label: "MAGNETIC HULL SEALANT APPLICATOR",
      isEquipped: false
    };

    this.sealantTool = toolGroup;
    this.sealantTool.visible = false;
    this.cockpitGroup.add(this.sealantTool);
    this.interactables.push(this.sealantTool);
  }

  // --- EXTERNAL SATELLITE FOR SPACEWALK (EVA) ---
  createSatelliteForEVA() {
    this.satelliteGroup = new THREE.Group();
    this.satelliteGroup.position.set(0, 1.8, -12.0); // Floats ahead in space

    // Satellite Main Bus
    const busGeo = new THREE.BoxGeometry(1.6, 2.2, 1.6);
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04, // Gold thermal foil insulation
      metalness: 0.85,
      roughness: 0.25
    });
    const bus = new THREE.Mesh(busGeo, busMat);
    this.satelliteGroup.add(bus);

    // Dual Solar Array Wings
    const wingGeo = new THREE.BoxGeometry(4.2, 1.2, 0.04);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // Deep blue solar cells
      metalness: 0.7,
      roughness: 0.2
    });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-2.8, 0, 0);
    this.satelliteGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(2.8, 0, 0);
    this.satelliteGroup.add(rightWing);

    // Parabolic Dish Antenna
    const dishGeo = new THREE.SphereGeometry(0.9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 3);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI;
    dish.position.set(0, 1.3, 0.5);
    this.satelliteGroup.add(dish);

    // Diagnostic Interface Node (Interactable in EVA)
    const nodeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.12);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      roughness: 0.2
    });
    const dataNode = new THREE.Mesh(nodeGeo, nodeMat);
    dataNode.position.set(0, 0, 0.85);
    dataNode.userData = {
      interactable: true,
      type: "satellite_node",
      label: "SATELLITE QUANTUM TELEMETRY PORT"
    };

    this.satelliteGroup.add(dataNode);
    this.interactables.push(dataNode);

    this.satelliteGroup.visible = false;
    this.scene.add(this.satelliteGroup);
  }

  // --- RE-ENTRY PLASMA PARTICLES ---
  createReentryPlasma() {
    const pCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    const colors = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 6;
      positions[i + 1] = (Math.random() - 0.5) * 4 + 1.2;
      positions[i + 2] = -Math.random() * 12;

      // Fiery plasma gradient (orange / yellow / bright red)
      colors[i] = 1.0;
      colors[i + 1] = 0.3 + Math.random() * 0.5;
      colors[i + 2] = 0.05;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });

    this.plasmaParticles = new THREE.Points(geometry, material);
    this.scene.add(this.plasmaParticles);
  }

  // --- MFD CANVAS DISPLAY UPDATER ---
  updateMFDCanvas(statusText, o2, pressure, power) {
    if (!this.mfdCtx) return;
    const ctx = this.mfdCtx;
    ctx.fillStyle = "#030a16";
    ctx.fillRect(0, 0, 1024, 512);

    // Frame border
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 1008, 496);

    // Header bar
    ctx.fillStyle = "#091e3a";
    ctx.fillRect(8, 8, 1008, 64);
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 26px 'Orbitron', monospace, sans-serif";
    ctx.fillText("APOLLO-X FLIGHT TELEMETRY SYSTEM", 30, 48);

    ctx.fillStyle = statusText.includes("CRITICAL") || statusText.includes("ABNORMAL") ? "#ff0033" : "#10b981";
    ctx.fillText(`SYS: ${statusText}`, 720, 48);

    // Grid panels
    // 1. Oxygen
    ctx.fillStyle = "#061528";
    ctx.fillRect(30, 95, 290, 380);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 22px monospace";
    ctx.fillText("PRIMARY LIFE SUPPORT", 50, 135);
    ctx.font = "bold 58px monospace";
    ctx.fillText(`${Math.round(o2)}%`, 50, 210);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("FLOW RATE: 0.42 kg/h", 50, 250);
    ctx.fillText("SUIT INTEGRITY: NOMINAL", 50, 280);

    // O2 Progress bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(50, 310, 240, 24);
    ctx.fillStyle = o2 < 40 ? "#ef4444" : "#0284c7";
    ctx.fillRect(50, 310, (o2 / 100) * 240, 24);

    // 2. Cabin Pressure
    ctx.fillStyle = "#061528";
    ctx.fillRect(350, 95, 310, 380);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 22px monospace";
    ctx.fillText("HULL CABIN PRESSURE", 370, 135);
    ctx.font = "bold 58px monospace";
    ctx.fillStyle = pressure < 85 ? "#ef4444" : "#10b981";
    ctx.fillText(`${pressure.toFixed(1)} kPa`, 370, 210);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("ATMOSPHERE: 21% O2 / 78% N2", 370, 250);
    ctx.fillText(pressure < 90 ? "WARNING: RAPID LOSS" : "LEAK SENSORS: QUIET", 370, 280);

    // Pressure Gauge Graphic
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(370, 310, 260, 24);
    ctx.fillStyle = pressure < 85 ? "#dc2626" : "#059669";
    ctx.fillRect(370, 310, Math.min(260, (pressure / 101.3) * 260), 24);

    // 3. Power Grid & Attitude
    ctx.fillStyle = "#061528";
    ctx.fillRect(690, 95, 290, 380);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 22px monospace";
    ctx.fillText("POWER BUS & FUEL", 710, 135);
    ctx.font = "bold 58px monospace";
    ctx.fillText(`${Math.round(power)}%`, 710, 210);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("AUX BUS: CONNECTED", 710, 250);
    ctx.fillText("SOLAR MATRIX: DEPLOYED", 710, 280);

    // Power Bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(710, 310, 240, 24);
    ctx.fillStyle = power < 50 ? "#f59e0b" : "#8b5cf6";
    ctx.fillRect(710, 310, (power / 100) * 240, 24);

    // Telemetry Footer
    ctx.fillStyle = "#00e5ff";
    ctx.font = "16px monospace";
    ctx.fillText("ORBIT: 408 KM LEO | VELOCITY: 7.66 KM/S | MISSION: SOLO TRAINEE", 210, 450);

    if (this.mfdTexture) this.mfdTexture.needsUpdate = true;
  }

  // --- TRANSITIONS ---
  enterEVA() {
    this.sceneMode = "eva";
    this.cockpitGroup.visible = false;
    this.satelliteGroup.visible = true;
    this.camera.position.set(0, 1.8, 0); // Outside in open space
    console.log("[CockpitScene] Entered EVA Spacewalk mode.");
  }

  returnToCockpit() {
    this.sceneMode = "cockpit";
    this.cockpitGroup.visible = true;
    this.satelliteGroup.visible = false;
    this.camera.position.set(0, 1.25, 0);
    console.log("[CockpitScene] Returned to Cockpit mode.");
  }

  setAlarmVisuals(active) {
    if (active) {
      this.cockpitCyanLight.intensity = 0.25;
      this.cockpitRedAlarmLight.intensity = 3.5;
    } else {
      this.cockpitCyanLight.intensity = 1.8;
      this.cockpitRedAlarmLight.intensity = 0.0;
    }
  }

  setScreenShake(intensity) {
    this.shakeIntensity = intensity;
  }

  // --- CONTROLS & INTERACTION ---
  setupEventListeners() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse Look (Desktop)
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    window.addEventListener("mousedown", (e) => {
      if (e.target.tagName !== "CANVAS") return;
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      this.checkIntersectionAndClick(e);
    });

    window.addEventListener("mouseup", () => {
      isMouseDown = false;
    });

    window.addEventListener("mousemove", (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (isMouseDown && !this.renderer.xr.isPresenting) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        this.cameraYaw -= deltaX * 0.0035;
        this.cameraPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.cameraPitch - deltaY * 0.0035));

        const basePos = this.sceneMode === "eva" ? new THREE.Vector3(0, 1.8, 0) : new THREE.Vector3(0, 1.25, 0);
        this.camera.rotation.order = "YXZ";
        this.camera.rotation.y = this.cameraYaw;
        this.camera.rotation.x = this.cameraPitch;
      }

      this.updateHover();
    });

    // Keyboard controls for fine positioning
    window.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  updateHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactables, true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.interactable && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData.interactable) {
        if (this.hoveredObject !== obj) {
          this.hoveredObject = obj;
          document.body.style.cursor = "pointer";
          const promptEl = document.getElementById("interaction-prompt");
          if (promptEl) {
            promptEl.textContent = `[CLICK TO ENGAGE] ${obj.userData.label || obj.userData.type.toUpperCase()}`;
            promptEl.style.opacity = "1";
          }
        }
        return;
      }
    }

    if (this.hoveredObject) {
      this.hoveredObject = null;
      document.body.style.cursor = "default";
      const promptEl = document.getElementById("interaction-prompt");
      if (promptEl) promptEl.style.opacity = "0";
    }
  }

  checkIntersectionAndClick(e) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactables, true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.interactable && obj.parent) {
        obj = obj.parent;
      }

      if (obj && obj.userData.interactable) {
        this.triggerInteraction(obj);
      }
    }
  }

  triggerInteraction(obj) {
    const data = obj.userData;
    console.log("[CockpitScene] Interacted with:", data);

    if (window.audioEngine) window.audioEngine.resume();

    // 1. Rocker Switch
    if (data.type === "switch") {
      data.active = !data.active;
      data.rocker.rotation.x = data.active ? 0.35 : -0.35;
      data.led.material.color.setHex(data.active ? data.accentColor : 0x334155);

      if (window.audioEngine) window.audioEngine.playSwitchClick();

      // Dispatch event to missionFlow
      window.dispatchEvent(new CustomEvent("cockpit-switch-toggle", {
        detail: { switchId: data.switchId, active: data.active }
      }));
    }

    // 2. Throttle Lever
    else if (data.type === "lever") {
      if (!data.pulled) {
        data.pulled = true;
        data.pivot.rotation.x = 0.85; // Pulled forward
        if (window.audioEngine) window.audioEngine.playLeverClunk();

        window.dispatchEvent(new CustomEvent("cockpit-lever-pulled", {
          detail: { leverId: data.leverId }
        }));
      }
    }

    // 3. Sealant Tool Pick-up
    else if (data.type === "tool" && data.toolId === "sealant") {
      data.isEquipped = true;
      obj.position.set(0.25, 1.05, -0.6); // Moves to astronaut's virtual hand
      if (window.audioEngine) window.audioEngine.playLeverClunk();

      window.dispatchEvent(new CustomEvent("tool-equipped", {
        detail: { toolId: "sealant" }
      }));
    }

    // 4. Hull Breach Repair
    else if (data.type === "breach") {
      window.dispatchEvent(new CustomEvent("breach-seal-attempt", {
        detail: { target: obj }
      }));
    }

    // 5. Satellite Node in EVA
    else if (data.type === "satellite_node") {
      window.dispatchEvent(new CustomEvent("satellite-node-engaged"));
    }
  }

  // --- WEBXR SUPPORT ---
  setupWebXR() {
    if ("xr" in navigator) {
      navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
        const vrBtn = document.getElementById("vr-enter-btn");
        if (supported && vrBtn) {
          vrBtn.style.display = "flex";
          vrBtn.addEventListener("click", () => this.toggleVR());
        }
      });
    }

    // Controller 1 & 2
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener("selectstart", () => this.onXRSelect(controller));

      // Controller laser ray
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3.5)
      ]);
      const rayMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.75 });
      const ray = new THREE.Line(rayGeo, rayMat);
      controller.add(ray);

      this.scene.add(controller);
      this.controllers.push(controller);
    }
  }

  toggleVR() {
    if (!this.renderer.xr.isPresenting) {
      navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"]
      }).then((session) => {
        this.renderer.xr.setSession(session);
      });
    } else {
      this.renderer.xr.getSession().end();
    }
  }

  onXRSelect(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = this.raycaster.intersectObjects(this.interactables, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.interactable && obj.parent) obj = obj.parent;
      if (obj && obj.userData.interactable) this.triggerInteraction(obj);
    }
  }

  setSwitchState(switchId, active) {
    const sw = this.switches[switchId];
    if (sw) {
      sw.userData.active = active;
      if (sw.userData.rocker) {
        sw.userData.rocker.rotation.x = active ? 0.35 : -0.35;
      }
      if (sw.userData.led) {
        sw.userData.led.material.color.setHex(active ? sw.userData.accentColor : 0x334155);
      }
    }
  }

  setIgnitionState(pulled) {
    if (this.ignitionLever && this.ignitionLever.userData.pivot) {
      this.ignitionLever.userData.pulled = pulled;
      this.ignitionLever.userData.pivot.rotation.x = pulled ? 0.85 : 0.0;
    }
  }

  resetCameraView() {
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    const basePos = this.sceneMode === "eva" ? new THREE.Vector3(0, 1.8, 0) : new THREE.Vector3(0, 1.25, 0);
    this.camera.position.copy(basePos);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(0, 0, 0);
  }

  // --- RENDER LOOP ---
  render() {
    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Rotate Earth and Clouds
    if (this.earthMesh) this.earthMesh.rotation.y += delta * 0.015;
    if (this.cloudMesh) this.cloudMesh.rotation.y += delta * 0.022;

    // 2. Twinkle stars and drift dust particles
    if (this.dustParticles) {
      this.dustParticles.rotation.y += delta * 0.005;
      this.dustParticles.rotation.x += delta * 0.003;
    }

    // 3. Pulse Emergency Red Alarm if active
    if (this.cockpitRedAlarmLight.intensity > 0.1) {
      this.cockpitRedAlarmLight.intensity = 2.0 + Math.sin(elapsedTime * 6.0) * 1.8;
    }

    // 4. Leak Beacon pulsing
    if (this.hullBreachHole && this.hullBreachHole.visible && !this.hullBreachHole.userData.isSealed) {
      this.hullBreachHole.userData.beacon.material.opacity = 0.4 + Math.sin(elapsedTime * 8.0) * 0.4;
    }

    // 5. Re-entry Plasma particles animation
    if (this.sceneMode === "reentry" || this.plasmaParticles.material.opacity > 0.01) {
      const positions = this.plasmaParticles.geometry.attributes.position.array;
      for (let i = 2; i < positions.length; i += 3) {
        positions[i] += delta * 35; // Rush toward and past cockpit
        if (positions[i] > 2) {
          positions[i] = -12;
          positions[i - 2] = (Math.random() - 0.5) * 5;
          positions[i - 1] = (Math.random() - 0.5) * 3 + 1.2;
        }
      }
      this.plasmaParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 6. Camera Screen Shake
    if (this.shakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.08;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.08;
      const shakeZ = (Math.random() - 0.5) * this.shakeIntensity * 0.05;

      const basePos = this.sceneMode === "eva" ? new THREE.Vector3(0, 1.8, 0) : new THREE.Vector3(0, 1.25, 0);
      this.camera.position.set(basePos.x + shakeX, basePos.y + shakeY, basePos.z + shakeZ);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Global scene instance
window.cockpitScene = new CockpitScene();
