import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useBiometrics } from '../../context/BiometricsContext';
import { useTypingGame } from '../../hooks/useTypingGame';
import { motion, AnimatePresence } from 'framer-motion';

interface Interactive3DTypewriterProps {
  className?: string;
  externalText?: string;
  onTextUpdate?: (text: string) => void;
  showHud?: boolean;
}

// QWERTY keyboard layout rows
const KEYBOARD_ROWS = [
  // Row 0: Numbers
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '⌫'],
  // Row 1: QWERTY
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  // Row 2: Home row
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", '↵'],
  // Row 3: Bottom row
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
];

export const Interactive3DTypewriter: React.FC<Interactive3DTypewriterProps> = ({
  className = '',
  externalText,
  onTextUpdate,
  showHud = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isTyping, onKeyAction } = useBiometrics();
  const typingGame = useTypingGame();

  // 3D Scene Refs
  const keysGroupRef = useRef<THREE.Group | null>(null);
  const carriageGroupRef = useRef<THREE.Group | null>(null);
  const typewriterRootRef = useRef<THREE.Group | null>(null);
  const activeTypebarRef = useRef<THREE.Mesh | null>(null);
  const paperTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Key map for physical QWERTY keys: char -> { group, capMesh, originalY, originalEmissive }
  const keyMeshMapRef = useRef<
    Map<
      string,
      {
        group: THREE.Group;
        capMesh: THREE.Mesh;
        material: THREE.MeshStandardMaterial;
        originalY: number;
      }
    >
  >(new Map());

  // Paper text buffer
  const textLinesRef = useRef<string[]>(['KeySign Biometrics', 'Type here to ink...']);
  const [typedBuffer, setTypedBuffer] = useState<string>('KeySign Biometrics\nType here to ink...');
  const targetCarriageXRef = useRef<number>(0);

  // Helper: Draw paper canvas with vintage typewriter aesthetics
  const redrawPaper = useCallback(() => {
    const canvas = paperCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Parchment paper background with subtle aging
    ctx.fillStyle = '#fbf8ee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Faint vintage paper texture noise
    ctx.fillStyle = 'rgba(215, 204, 180, 0.15)';
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * canvas.width;
      const ry = Math.random() * canvas.height;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Left red margin line
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(80, canvas.height);
    ctx.stroke();

    // Subtle faint horizontal ruled lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    const lineHeight = 56;
    for (let y = 140; y < canvas.height; y += lineHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 2. Render Typewritten Text with realistic ink bleed
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 36px "Courier New", Courier, monospace';
    ctx.textBaseline = 'middle';

    const startY = 135;
    const lines = textLinesRef.current;

    lines.forEach((line, lineIndex) => {
      const y = startY + lineIndex * lineHeight;
      if (y > canvas.height - 40) return;

      // Draw each character with micro typewriter jitter
      let currentX = 110;
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        const microJitterX = (Math.sin(c * 9.2 + lineIndex) * 0.4);
        const microJitterY = (Math.cos(c * 7.1 + lineIndex) * 0.4);
        const opacityJitter = 0.88 + (Math.sin(c * 4.3) * 0.1);

        ctx.fillStyle = `rgba(15, 23, 42, ${opacityJitter})`;
        ctx.fillText(char, currentX + microJitterX, y + microJitterY);
        currentX += 22; // Monospace character width
      }

      // Blinking ink cursor on last line
      if (lineIndex === lines.length - 1) {
        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(currentX + 2, y - 18, 4, 36);
      }
    });

    if (paperTextureRef.current) {
      paperTextureRef.current.needsUpdate = true;
    }
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 520;

    // 1. Scene & Camera Setup (generous, full-machine framing with zero clipping)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 4.4, 7.5);
    camera.lookAt(0, 0.25, 0.15);

    // 2. WebGL Renderer with High DPI & Soft Shadows
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting: Multi-point key, rim, and warm accent lights
    const ambientLight = new THREE.AmbientLight(0xf1f5f9, 2.0);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4, 9, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.4); // Cool indigo rim
    rimLight.position.set(-6, 4, -4);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.9); // Cyan telemetry bounce
    fillLight.position.set(0, -2, 5);
    scene.add(fillLight);

    // 4. Procedural Mechanical Typewriter Model
    const typewriterGroup = new THREE.Group();
    typewriterRootRef.current = typewriterGroup;
    typewriterGroup.scale.set(1.02, 1.02, 1.02); // Natural scale with full visibility

    // High-fidelity Materials
    const chassisMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Matte slate lacquer
      roughness: 0.32,
      metalness: 0.48,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Polished chrome
      roughness: 0.12,
      metalness: 0.92,
    });

    const darkRollerMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Vulcanized black rubber
      roughness: 0.65,
      metalness: 0.2,
    });

    const goldAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Vintage brass accents
      roughness: 0.2,
      metalness: 0.85,
    });

    // 4a. Base Chassis & Sloped Keyboard Bed
    const baseGeo = new THREE.BoxGeometry(3.7, 0.52, 3.3);
    const baseMesh = new THREE.Mesh(baseGeo, chassisMaterial);
    baseMesh.position.y = 0.26;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    typewriterGroup.add(baseMesh);

    // Keyboard slope
    const rampGeo = new THREE.BoxGeometry(3.5, 0.36, 1.7);
    const rampMesh = new THREE.Mesh(rampGeo, chassisMaterial);
    rampMesh.position.set(0, 0.4, 0.9);
    rampMesh.rotation.x = 0.22;
    rampMesh.castShadow = true;
    typewriterGroup.add(rampMesh);

    // Polished Brass Brand Medallion on Front
    const medallionGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24);
    const medallionMesh = new THREE.Mesh(medallionGeo, goldAccentMaterial);
    medallionMesh.rotation.x = Math.PI / 2;
    medallionMesh.position.set(0, 0.28, 1.66);
    typewriterGroup.add(medallionMesh);

    // 4b. Moving Carriage Assembly with Platen & Paper
    const carriage = new THREE.Group();
    carriageGroupRef.current = carriage;
    carriage.position.set(0, 0.88, -0.72);

    // Rubber Platen Roller
    const platenGeo = new THREE.CylinderGeometry(0.34, 0.34, 4.0, 32);
    const platenMesh = new THREE.Mesh(platenGeo, darkRollerMaterial);
    platenMesh.rotation.z = Math.PI / 2;
    platenMesh.castShadow = true;
    carriage.add(platenMesh);

    // Platen Chrome End Knobs
    const knobGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 24);
    const leftKnob = new THREE.Mesh(knobGeo, chromeMaterial);
    leftKnob.rotation.z = Math.PI / 2;
    leftKnob.position.x = -2.16;
    carriage.add(leftKnob);

    const rightKnob = new THREE.Mesh(knobGeo, chromeMaterial);
    rightKnob.rotation.z = Math.PI / 2;
    rightKnob.position.x = 2.16;
    carriage.add(rightKnob);

    // Chrome Return Lever on Left
    const leverBarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 16);
    const leverMesh = new THREE.Mesh(leverBarGeo, chromeMaterial);
    leverMesh.position.set(-2.0, 0.35, 0.2);
    leverMesh.rotation.z = 0.6;
    leverMesh.rotation.x = 0.4;
    carriage.add(leverMesh);

    // Paper Bail Hold-down Bar
    const bailGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.9, 16);
    const bailMesh = new THREE.Mesh(bailGeo, chromeMaterial);
    bailMesh.rotation.z = Math.PI / 2;
    bailMesh.position.set(0, 0.36, 0.28);
    carriage.add(bailMesh);

    // 4c. Dynamic Inked Paper Sheet
    const paperCanvas = document.createElement('canvas');
    paperCanvas.width = 1024;
    paperCanvas.height = 1024;
    paperCanvasRef.current = paperCanvas;

    const paperTexture = new THREE.CanvasTexture(paperCanvas);
    paperTextureRef.current = paperTexture;
    paperTexture.anisotropy = 8;

    const paperMaterial = new THREE.MeshStandardMaterial({
      map: paperTexture,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Curled Paper Geometry flowing over the platen
    const paperGeo = new THREE.PlaneGeometry(2.6, 2.2, 16, 16);
    const paperMesh = new THREE.Mesh(paperGeo, paperMaterial);
    paperMesh.position.set(0, 0.72, -0.22);
    paperMesh.rotation.x = -0.38;
    paperMesh.castShadow = true;
    carriage.add(paperMesh);

    typewriterGroup.add(carriage);

    // Draw initial paper content
    redrawPaper();

    // 4d. Type Basket (Radial typebars + active striking typebar)
    const basketGroup = new THREE.Group();
    basketGroup.position.set(0, 0.62, -0.32);

    for (let i = -7; i <= 7; i++) {
      const angle = (i / 7) * 0.75;
      const barGeo = new THREE.BoxGeometry(0.035, 0.025, 0.95);
      const barMesh = new THREE.Mesh(barGeo, chromeMaterial);
      barMesh.position.set(Math.sin(angle) * 0.85, 0.12, -Math.cos(angle) * 0.4);
      barMesh.rotation.y = -angle;
      barMesh.rotation.x = -0.34;
      basketGroup.add(barMesh);
    }

    // Active Center Typebar (moves forward & strikes when any key is pressed)
    const activeBarGeo = new THREE.BoxGeometry(0.045, 0.03, 1.05);
    const activeBarMesh = new THREE.Mesh(activeBarGeo, chromeMaterial);
    activeBarMesh.position.set(0, 0.14, -0.35);
    activeBarMesh.rotation.x = -0.32;
    activeTypebarRef.current = activeBarMesh;
    basketGroup.add(activeBarMesh);

    // Ribbon vibrator guide (center strike target)
    const guideGeo = new THREE.BoxGeometry(0.18, 0.22, 0.06);
    const guideMesh = new THREE.Mesh(guideGeo, darkRollerMaterial);
    guideMesh.position.set(0, 0.32, -0.4);
    basketGroup.add(guideMesh);

    typewriterGroup.add(basketGroup);

    // 4e. Full QWERTY Key Array with Printed Keycaps
    const keysGroup = new THREE.Group();
    keysGroupRef.current = keysGroup;
    const keyMap = keyMeshMapRef.current;
    keyMap.clear();

    const keyCapGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.065, 20);
    const keyRingGeo = new THREE.TorusGeometry(0.115, 0.018, 12, 24);

    // Function to create a small canvas texture with the key label
    const createKeyLabelTexture = (label: string) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      if (!ctx) return null;

      // Ivory circular background
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.fill();

      // Inner thin vintage ring
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Bold key label
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 54px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 64, 66);

      const tex = new THREE.CanvasTexture(c);
      return tex;
    };

    const rowConfigs = [
      { z: 0.35, y: 0.65, spacing: 0.24 }, // Numbers
      { z: 0.65, y: 0.58, spacing: 0.26 }, // QWERTY
      { z: 0.95, y: 0.51, spacing: 0.26 }, // Home
      { z: 1.25, y: 0.44, spacing: 0.28 }, // Bottom
    ];

    KEYBOARD_ROWS.forEach((row, rowIdx) => {
      const cfg = rowConfigs[rowIdx];
      const startX = -((row.length - 1) * cfg.spacing) / 2;

      row.forEach((char, colIdx) => {
        const keyGroup = new THREE.Group();
        const keyLabelTex = createKeyLabelTexture(char);

        const capMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.28,
          metalness: 0.1,
          map: keyLabelTex || undefined,
          emissive: new THREE.Color(0x000000),
        });

        const capMesh = new THREE.Mesh(keyCapGeo, capMat);
        capMesh.castShadow = true;

        const ringMesh = new THREE.Mesh(keyRingGeo, chromeMaterial);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 0.02;

        keyGroup.add(capMesh);
        keyGroup.add(ringMesh);

        const posX = startX + colIdx * cfg.spacing;
        const posY = cfg.y;
        const posZ = cfg.z;
        keyGroup.position.set(posX, posY, posZ);

        keysGroup.add(keyGroup);

        // Register key in map (lowercase & uppercase & aliases)
        const keyData = {
          group: keyGroup,
          capMesh,
          material: capMat,
          originalY: posY,
        };

        keyMap.set(char.toLowerCase(), keyData);
        if (char === '⌫') keyMap.set('backspace', keyData);
        if (char === '↵') keyMap.set('enter', keyData);
      });
    });

    // Wide Chrome & Ivory Spacebar
    const spaceGeo = new THREE.BoxGeometry(1.7, 0.08, 0.22);
    const spaceMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.15,
      emissive: new THREE.Color(0x000000),
    });
    const spaceMesh = new THREE.Mesh(spaceGeo, spaceMat);
    const spaceGroup = new THREE.Group();
    spaceGroup.position.set(0, 0.35, 1.56);
    spaceMesh.castShadow = true;
    spaceGroup.add(spaceMesh);
    keysGroup.add(spaceGroup);

    const spaceData = {
      group: spaceGroup,
      capMesh: spaceMesh,
      material: spaceMat,
      originalY: 0.35,
    };
    keyMap.set(' ', spaceData);
    keyMap.set('space', spaceData);

    typewriterGroup.add(keysGroup);

    // Initial position & photogenic angle
    typewriterGroup.position.set(0, -0.25, 0);
    typewriterGroup.rotation.set(0.32, -0.34, 0.05);
    scene.add(typewriterGroup);

    // 5. Mouse Interaction Tracking (Pitch & Yaw Rotation)
    let targetRotX = 0.32;
    let targetRotY = -0.36;
    let scrollShift = 0;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      targetRotY = -0.36 + normX * 0.5;
      targetRotX = 0.32 - normY * 0.3;
    };

    const handleScroll = () => {
      scrollShift = (window.scrollY || 0) * 0.0008;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 6. 60 FPS Render Loop with Smooth LERP & Ambient Drift
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const renderLoop = () => {
      animationFrameId = requestAnimationFrame(renderLoop);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse rotation
      typewriterGroup.rotation.x += (targetRotX - typewriterGroup.rotation.x) * 0.07;
      typewriterGroup.rotation.y += (targetRotY - typewriterGroup.rotation.y) * 0.07;

      // Ambient floating breathing motion
      const idleFloat = Math.sin(elapsed * 0.9) * 0.035;
      typewriterGroup.position.y = -0.32 + idleFloat - Math.min(scrollShift * 0.25, 0.8);

      // Smooth carriage horizontal motion
      if (carriageGroupRef.current) {
        carriageGroupRef.current.position.x +=
          (targetCarriageXRef.current - carriageGroupRef.current.position.x) * 0.12;
      }

      renderer.render(scene, camera);
    };

    renderLoop();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 700;
      const newH = container.clientHeight || 520;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [redrawPaper]);

  // Handle Physical Key Depress & Strike Execution
  const strikeKey = useCallback(
    (char: string) => {
      const lower = char.toLowerCase();
      const keyData = keyMeshMapRef.current.get(lower);

      // 1. Depress the exact QWERTY 3D keycap
      if (keyData) {
        keyData.group.position.y = keyData.originalY - 0.075; // Real mechanical depression
        keyData.material.emissive.setHex(0x6366f1); // Glowing indigo strike pulse

        setTimeout(() => {
          keyData.group.position.y = keyData.originalY;
          keyData.material.emissive.setHex(0x000000);
        }, 110);
      }

      // 2. Animate central typebar basket strike
      if (activeTypebarRef.current) {
        const bar = activeTypebarRef.current;
        bar.rotation.x = 0.52; // Swing up to platen
        bar.position.z = -0.18;

        setTimeout(() => {
          bar.rotation.x = -0.32; // Swing back down
          bar.position.z = -0.35;
        }, 90);
      }

      // 3. Ink onto paper & slide carriage
      const lines = textLinesRef.current;
      const currentLineIndex = lines.length - 1;

      if (char === 'Backspace' || char === '⌫') {
        if (lines[currentLineIndex].length > 0) {
          lines[currentLineIndex] = lines[currentLineIndex].slice(0, -1);
          targetCarriageXRef.current = Math.min(0, targetCarriageXRef.current + 0.038);
        } else if (lines.length > 1) {
          lines.pop();
        }
      } else if (char === 'Enter' || char === '↵') {
        // Line feed & carriage return!
        lines.push('');
        if (lines.length > 12) {
          lines.shift(); // Scroll paper upward
        }
        targetCarriageXRef.current = 0; // Return carriage to start margin!
        typingGame.triggerBell(); // Ring mechanical carriage return bell!
      } else if (char.length === 1) {
        // Normal printable character
        lines[currentLineIndex] += char;
        targetCarriageXRef.current -= 0.038; // Carriage advances left

        // Auto wrap if line gets too long
        if (lines[currentLineIndex].length >= 30) {
          lines.push('');
          if (lines.length > 12) lines.shift();
          targetCarriageXRef.current = 0;
          typingGame.triggerBell();
        }
      }

      // Update canvas texture
      redrawPaper();

      const fullText = lines.join('\n');
      setTypedBuffer(fullText);
      if (onTextUpdate) onTextUpdate(fullText);

      // Register gamified streak and points
      typingGame.registerKeyHit(char);
    },
    [redrawPaper, onTextUpdate, typingGame]
  );

  // Global Keyboard Listener: strikes exact key and inks paper
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      strikeKey(e.key);
      onKeyAction('down');
    };

    const handleGlobalKeyUp = () => {
      onKeyAction('up');
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [strikeKey, onKeyAction]);

  // Clear paper helper
  const handleClearPaper = () => {
    textLinesRef.current = [''];
    targetCarriageXRef.current = 0;
    redrawPaper();
    setTypedBuffer('');
    typingGame.resetGame();
  };

  return (
    <div className={`relative w-full ${className} select-none`}>
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-[540px] sm:h-[620px] lg:h-[700px] xl:h-[740px] pointer-events-auto cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden"
        title="Interactive 3D Mechanical Typewriter — Type on your keyboard to strike the exact matching QWERTY keys and ink the paper sheet!"
      />

      {/* Gamified HUD Overlay */}
      {showHud && (
        <>
          {/* The streak counter, combo multiplier, points and unlock banner that used to sit
              here were an arcade layer bolted to a security tool: fire and lightning emoji,
              a purple gradient, "Milestone Unlocked!". Words per minute is the one number
              worth keeping, because it is measured and it is what a typist looks for. */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 text-xs font-mono text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span>Follows your keyboard</span>
            </div>

            {typingGame.wpm > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-3 py-1.5 rounded-full bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 text-[11px] font-mono text-slate-600 dark:text-slate-300"
              >
                {typingGame.wpm} wpm
              </motion.div>
            )}
          </div>

          <div className="absolute top-4 right-4 z-20 flex items-center gap-2.5">
            {/* The bell stays: a carriage bell at the end of a line is what the machine did. */}
            <motion.div
              animate={typingGame.bellTriggered ? { rotate: [-18, 18, -12, 12, 0], scale: [1, 1.25, 1] } : {}}
              transition={{ duration: 0.45 }}
              className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-sm transition-colors ${
                typingGame.bellTriggered
                  ? 'bg-amber-400 border-amber-300 text-slate-900 shadow-amber-400/50'
                  : 'bg-white/75 dark:bg-slate-900/75 border-slate-200/60 dark:border-slate-800/60 text-slate-500 dark:text-slate-400'
              }`}
              title="Carriage Return Bell"
            >
              <span className="material-symbols-outlined text-[17px]">notifications_active</span>
            </motion.div>

            {/* Clear Paper Button */}
            <button
              onClick={handleClearPaper}
              className="px-2.5 py-1 rounded-full bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-[10px] font-mono text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Clear paper and insert new sheet"
            >
              New Sheet
            </button>
          </div>

          {/* Bottom Live Interaction Guide */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">
                keyboard
              </span>
              <span>
                <strong>Exact QWERTY Sync:</strong> Press any key on your keyboard to depress that 3D key & ink paper.
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Inking
              </span>
              <span className="text-slate-400 hidden sm:inline">|</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                Press Enter for Carriage Return
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
