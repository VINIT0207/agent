import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ModelAssetStatus, AssistantState } from '../types/assistant';
import { luxuryAudio } from '../services/audioSynthesizer';

interface AuraOrbCanvasProps {
  assistantState: AssistantState;
  onModelStatusChange: (status: ModelAssetStatus) => void;
  externalGlbFile: File | null;
}

export const AuraOrbCanvas: React.FC<AuraOrbCanvasProps> = ({
  assistantState,
  onModelStatusChange,
  externalGlbFile,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const assistantStateRef = useRef<AssistantState>(assistantState);
  assistantStateRef.current = assistantState;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId: number;
    let isDisposed = false;

    // Detect software WebGL per Three.js directives
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // Setup Three.js scene with transparent background for pure OLED black blending
    const scene = new THREE.Scene();

    // Camera setup - 45 deg FOV, placed at z = 3.8
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      1000
    );
    camera.position.set(0, 0, 3.8);

    // WebGL Renderer with alpha true
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Luxury Pearl/Crystalline micro-facet texture generator
    const createPearlTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(48, 40, 2, 64, 64, 64);
        grad.addColorStop(0, '#ffffff');      // specular pearl highlight
        grad.addColorStop(0.25, '#cffafe');   // soft cyan luster
        grad.addColorStop(0.55, '#22d3ee');   // turquoise midtone
        grad.addColorStop(0.85, '#0891b2');   // deep teal edge
        grad.addColorStop(1, '#021216');      // dark rim
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const pearlTexture = createPearlTexture();

    // Lighting calibrated for dark moody resting state and luminous active bursts
    const ambientLight = new THREE.AmbientLight(0x021518, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00f2fe, 1.8);
    keyLight.position.set(3.5, 4.0, 3.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x0891b2, 1.3);
    fillLight.position.set(-3.5, -2.5, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 2.6);
    rimLight.position.set(0, 3.5, -4.0);
    scene.add(rimLight);

    // Dynamic inner core glow point light
    const coreGlowLight = new THREE.PointLight(0x00f2fe, 1.2, 5.5);
    coreGlowLight.position.set(0, 0, 0.4);
    scene.add(coreGlowLight);

    // Group to hold the 3D subject
    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    let mixer: THREE.AnimationMixer | null = null;
    let customModelLoaded = false;
    const dotMeshes: THREE.Mesh[] = [];

    // Pre-allocated reusable colors to avoid GC
    const colorWhite = new THREE.Color(0xffffff);
    const colorCyan = new THREE.Color(0x00f2fe);        // vibrant cyan
    const colorTurquoise = new THREE.Color(0x06b6d4);   // turquoise
    const colorEmerald = new THREE.Color(0x10b981);     // emerald highlight
    const colorDarkTeal = new THREE.Color(0x08333c);    // resting dark teal
    const colorDarkCharcoal = new THREE.Color(0x030708);// resting dark shadow
    const tempTargetColor = new THREE.Color();
    const tempTargetEmissive = new THREE.Color();

    // Reusable math vectors
    const cursor3D = new THREE.Vector3();
    const cursor3DLocal = new THREE.Vector3();
    const sphereObj = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.35);
    const hitVec = new THREE.Vector3();
    const closestRayPoint = new THREE.Vector3();

    // Fallback procedural particle points
    let particlePoints: THREE.Points | null = null;
    let particlePositions: Float32Array | null = null;
    let particleInitialRadii: Float32Array | null = null;
    let particlePhase: Float32Array | null = null;

    /* -------------------------------------------------------------
     * Screen-Space Proximity Controller with Hysteresis
     * ------------------------------------------------------------- */
    let screenCursorX = -9999;
    let screenCursorY = -9999;
    let prevScreenCursorX = -9999;
    let prevScreenCursorY = -9999;
    let isCursorNearHysteresis = false;
    let targetProximityInfluence = 0.0;
    let smoothedProximityInfluence = 0.0;
    let smoothedVoiceInfluence = 0.0;

    const onPointerMove = (e: PointerEvent) => {
      if (isDisposed) return;
      screenCursorX = e.clientX;
      screenCursorY = e.clientY;
    };

    const onPointerLeave = () => {
      screenCursorX = -9999;
      screenCursorY = -9999;
      isCursorNearHysteresis = false;
      targetProximityInfluence = 0.0;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('mouseleave', onPointerLeave, { passive: true });

    // Fallback procedural particle sphere (used only if external model is missing)
    const createProceduralParticleSphere = () => {
      const particleCount = isSoftwareGl ? 2200 : 5400;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const radii = new Float32Array(particleCount);
      const phases = new Float32Array(particleCount);

      const colorCore = new THREE.Color(0xa5f3fc);
      const colorMid = new THREE.Color(0x00f2fe);
      const colorOuter = new THREE.Color(0x0891b2);
      const tempColor = new THREE.Color();
      const baseRadius = 1.35;

      for (let i = 0; i < particleCount; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const radiusJitter = baseRadius * (0.95 + Math.random() * 0.1);

        const x = radiusJitter * Math.sin(phi) * Math.cos(theta);
        const y = radiusJitter * Math.sin(phi) * Math.sin(theta);
        const z = radiusJitter * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        radii[i] = radiusJitter;
        phases[i] = Math.random() * Math.PI * 2;

        const ratio = Math.random();
        if (ratio < 0.4) {
          tempColor.copy(colorCore).lerp(colorMid, ratio * 2.5);
        } else {
          tempColor.copy(colorMid).lerp(colorOuter, (ratio - 0.4) * 1.66);
        }

        colors[i * 3] = tempColor.r;
        colors[i * 3 + 1] = tempColor.g;
        colors[i * 3 + 2] = tempColor.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.052,
        map: pearlTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true,
        opacity: 0.92,
      });

      const points = new THREE.Points(geometry, material);
      particlePoints = points;
      particlePositions = positions;
      particleInitialRadii = radii;
      particlePhase = phases;

      orbGroup.add(points);
    };

    const loader = new GLTFLoader();

    // Handler when 3D model is loaded
    const handleModelSuccess = (gltf: any, source: 'external-file' | 'local-upload', fileName: string) => {
      if (isDisposed) return;

      while (orbGroup.children.length > 0) {
        const child = orbGroup.children[0];
        orbGroup.remove(child);
      }
      dotMeshes.length = 0;

      const model = gltf.scene || gltf.scenes?.[0];
      if (!model) return;

      let vertexCount = 0;
      model.traverse((child: any) => {
        if (child.isMesh) {
          dotMeshes.push(child);
          if (child.geometry) {
            vertexCount += child.geometry.attributes.position?.count || 0;
          }
        }
      });

      // Frame model to comfortable ~2.6 unit diameter
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      model.position.sub(center);

      const targetDiameter = 2.6;
      if (maxDim > 0) {
        const scaleFactor = targetDiameter / maxDim;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }

      // Initialize each bead mesh with luxury resting material
      dotMeshes.forEach((mesh, index) => {
        const pos = mesh.position;
        const dist = pos.length();
        const isLitHemisphere = pos.x + pos.y * 0.5 > -0.2;

        // Base resting color: dark moody teal on lit hemisphere, dark charcoal on shadow hemisphere
        const baseColor = new THREE.Color();
        if (isLitHemisphere) {
          const ratio = Math.min(Math.max((pos.x + pos.y) / 2.0, 0), 1);
          baseColor.copy(colorDarkTeal).lerp(new THREE.Color(0x0e4b55), ratio);
        } else {
          baseColor.copy(colorDarkCharcoal);
        }

        const baseEmissive = isLitHemisphere ? new THREE.Color(0x02161a) : new THREE.Color(0x000000);

        mesh.material = new THREE.MeshPhysicalMaterial({
          color: baseColor.clone(),
          emissive: baseEmissive.clone(),
          emissiveIntensity: 0.04,
          roughness: 0.28,
          metalness: 0.2,
          clearcoat: 0.9,
          clearcoatRoughness: 0.1,
          map: pearlTexture,
          toneMapped: true,
        });

        mesh.userData.baseColor = baseColor;
        mesh.userData.baseEmissive = baseEmissive;
        mesh.userData.phase = (index / Math.max(dotMeshes.length, 1)) * Math.PI * 4;
        mesh.userData.distance = dist;
      });

      // Bind all pre-built animations from the .glb file
      let animationCount = 0;
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip: THREE.AnimationClip) => {
          const action = mixer?.clipAction(clip);
          if (action) {
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
          }
        });
        animationCount = gltf.animations.length;
      }

      orbGroup.add(model);
      customModelLoaded = true;

      onModelStatusChange({
        loaded: true,
        source,
        fileName,
        vertexCount,
        hasAnimations: animationCount > 0,
        animationCount,
        error: null,
      });
    };

    // Load model: checks sphere.glb first, then aura_sphere.glb
    const loadDefaultModel = () => {
      const pathsToTry = ['/models/sphere.glb', '/models/aura_sphere.glb'];

      const tryLoad = (index: number) => {
        if (index >= pathsToTry.length) {
          if (!customModelLoaded && !isDisposed) {
            createProceduralParticleSphere();
            onModelStatusChange({
              loaded: false,
              source: 'standin-procedural',
              fileName: 'sphere.glb',
              vertexCount: particlePositions ? particlePositions.length / 3 : 0,
              hasAnimations: false,
              animationCount: 0,
              error: null,
            });
          }
          return;
        }

        const currentPath = pathsToTry[index];
        const fileName = currentPath.split('/').pop() || 'sphere.glb';

        loader.load(
          currentPath,
          (gltf) => {
            handleModelSuccess(gltf, 'external-file', fileName);
          },
          undefined,
          () => {
            tryLoad(index + 1);
          }
        );
      };

      tryLoad(0);
    };

    // External file upload support
    if (externalGlbFile) {
      const fileUrl = URL.createObjectURL(externalGlbFile);
      loader.load(
        fileUrl,
        (gltf) => {
          handleModelSuccess(gltf, 'local-upload', externalGlbFile.name);
          URL.revokeObjectURL(fileUrl);
        },
        undefined,
        (err) => {
          URL.revokeObjectURL(fileUrl);
          onModelStatusChange({
            loaded: false,
            source: 'standin-procedural',
            fileName: externalGlbFile.name,
            error: `Failed to parse ${externalGlbFile.name}: ${(err as any)?.message || 'Invalid format'}`,
          });
          if (orbGroup.children.length === 0) {
            createProceduralParticleSphere();
          }
        }
      );
    } else {
      loadDefaultModel();
    }

    // Unified Animation Controller Loop
    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();

    const animate = () => {
      if (isDisposed) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      /* -----------------------------------------------------------
       * 1. WHOLE-ORB SUBTLE DIAGONAL DRIFT
       * ----------------------------------------------------------- */
      const driftTime = elapsed * 0.25;
      const idleDiagonalX = Math.sin(driftTime) * 0.04 + Math.sin(driftTime * 0.6) * 0.02;
      const idleDiagonalY = Math.cos(driftTime * 0.9) * 0.035 + Math.cos(driftTime * 0.5) * 0.015;

      orbGroup.rotation.y += delta * 0.05;
      orbGroup.rotation.x = Math.sin(elapsed * 0.18) * 0.03;

      /* -----------------------------------------------------------
       * 2. SCREEN-SPACE PROXIMITY CALCULATION & HYSTERESIS
       * ----------------------------------------------------------- */
      const rect = container.getBoundingClientRect();
      const visibleHeightUnits = 2 * Math.tan(((45 * Math.PI) / 180) / 2) * 3.8;
      const pixelsPerUnit = rect.height / visibleHeightUnits;
      const visibleOrbRadiusPixels = (2.6 / 2) * pixelsPerUnit;

      const orbScreenCenterX = rect.left + rect.width / 2 + orbGroup.position.x * pixelsPerUnit;
      const orbScreenCenterY = rect.top + rect.height / 2 - orbGroup.position.y * pixelsPerUnit;

      const dx = screenCursorX - orbScreenCenterX;
      const dy = screenCursorY - orbScreenCenterY;
      const screenDistToOrb = Math.hypot(dx, dy);
      const distFromOrbEdge = Math.max(0, screenDistToOrb - visibleOrbRadiusPixels);

      // Strict Hysteresis: enter at 120px, exit at 150px
      const enterThreshold = 120;
      const exitThreshold = 150;

      if (screenCursorX > -9000) {
        if (!isCursorNearHysteresis) {
          if (distFromOrbEdge < enterThreshold) {
            isCursorNearHysteresis = true;
          }
        } else {
          if (distFromOrbEdge > exitThreshold) {
            isCursorNearHysteresis = false;
          }
        }
      } else {
        isCursorNearHysteresis = false;
      }

      if (isCursorNearHysteresis) {
        const rawNorm = 1.0 - Math.min(distFromOrbEdge / enterThreshold, 1.0);
        targetProximityInfluence = THREE.MathUtils.smoothstep(rawNorm, 0.0, 1.0);
      } else {
        targetProximityInfluence = 0.0;
      }

      // Smooth damping on proximity influence (attack ~250ms, release ~700ms)
      const proximityRampSpeed = targetProximityInfluence > smoothedProximityInfluence ? 4.5 : 2.0;
      smoothedProximityInfluence = THREE.MathUtils.damp(
        smoothedProximityInfluence,
        targetProximityInfluence,
        proximityRampSpeed,
        delta
      );

      // Parallax lean towards cursor ONLY when proximity is active
      const normalizedNdcX = ((screenCursorX - rect.left) / rect.width) * 2 - 1;
      const normalizedNdcY = -(((screenCursorY - rect.top) / rect.height) * 2 - 1);

      const targetPosX = idleDiagonalX + (isCursorNearHysteresis ? normalizedNdcX * 0.06 * smoothedProximityInfluence : 0);
      const targetPosY = idleDiagonalY + (isCursorNearHysteresis ? normalizedNdcY * 0.05 * smoothedProximityInfluence : 0);
      orbGroup.position.x = THREE.MathUtils.damp(orbGroup.position.x, targetPosX, 2.5, delta);
      orbGroup.position.y = THREE.MathUtils.damp(orbGroup.position.y, targetPosY, 2.5, delta);

      // Project cursor into 3D space when proximity influence is present
      if (smoothedProximityInfluence > 0.01 && screenCursorX > -9000) {
        raycaster.setFromCamera(new THREE.Vector2(normalizedNdcX, normalizedNdcY), camera);
        sphereObj.center.copy(orbGroup.position);
        if (raycaster.ray.intersectSphere(sphereObj, hitVec)) {
          cursor3D.copy(hitVec);
        } else {
          raycaster.ray.closestPointToPoint(orbGroup.position, closestRayPoint);
          cursor3D.copy(closestRayPoint);
        }
        orbGroup.worldToLocal(cursor3DLocal.copy(cursor3D));
      }

      /* -----------------------------------------------------------
       * 3. PRE-BUILT .GLB ANIMATION & SMOOTH CURSOR INTERACTION
       * ----------------------------------------------------------- */
      if (mixer) {
        if (!isCursorNearHysteresis) {
          // NORMAL STATE: Keep pre-built animations playing continuously as given in .glb
          mixer.update(delta);
        } else {
          // PROXIMITY STATE: Stop normal continuous auto-play.
          // Interact smoothly with cursor: advance time continuously with mouse velocity
          let mouseVelocity = 0;
          if (prevScreenCursorX > -9000 && screenCursorX > -9000) {
            mouseVelocity = Math.hypot(screenCursorX - prevScreenCursorX, screenCursorY - prevScreenCursorY);
          }
          // Smoothly advance animation proportionally to cursor movement (NO teleporting/jumping)
          if (mouseVelocity > 0.5) {
            mixer.update(Math.min(mouseVelocity * 0.0015, 0.04));
          }
        }
      }

      prevScreenCursorX = screenCursorX;
      prevScreenCursorY = screenCursorY;

      /* -----------------------------------------------------------
       * 4. VOICE REACTIVITY: ONLY WHEN AI SPEAKS
       * ----------------------------------------------------------- */
      const state = assistantStateRef.current;
      let rawVoiceLevel = 0;

      // Voice reactivity is strictly active ONLY when AI speaks
      if (state === 'speaking') {
        const realSpeechAmp = luxuryAudio.getSpeechAmplitude();
        if (realSpeechAmp > 0.01) {
          rawVoiceLevel = realSpeechAmp * 1.5;
        } else {
          // Subtle speech cadence envelope fallback
          const speechEnvelope =
            Math.sin(elapsed * 7.0) * 0.4 +
            Math.sin(elapsed * 14.0) * 0.3 +
            Math.sin(elapsed * 21.0) * 0.15;
          rawVoiceLevel = Math.max(0, speechEnvelope) * 0.5;
        }
      } else {
        // Inactive during listening, thinking, idle, and ended
        rawVoiceLevel = 0;
      }

      const voiceAttack = 8.0;
      const voiceRelease = 3.0;
      const vSpeed = rawVoiceLevel > smoothedVoiceInfluence ? voiceAttack : voiceRelease;
      smoothedVoiceInfluence = THREE.MathUtils.damp(smoothedVoiceInfluence, rawVoiceLevel, vSpeed, delta);

      // Core illumination modulated by voice (only when AI speaks) and proximity
      const combinedExcitation = Math.min(smoothedProximityInfluence * 0.7 + smoothedVoiceInfluence * 0.8, 1.0);
      coreGlowLight.intensity = 1.1 + combinedExcitation * 1.5;
      coreGlowLight.color.setHex(0x00f2fe); // electric cyan

      // Subtle whole-orb breathing only when AI speaks
      const wholeOrbScale = 1.0 + 0.015 * smoothedVoiceInfluence;
      orbGroup.scale.set(wholeOrbScale, wholeOrbScale, wholeOrbScale);

      /* -----------------------------------------------------------
       * 5. CONTROLLED BRIGHTNESS & GLOW REGIONS
       * ----------------------------------------------------------- */
      if (dotMeshes.length > 0) {
        const interactionRadius = 1.35;

        for (let i = 0; i < dotMeshes.length; i++) {
          const mesh = dotMeshes[i];
          const pos = mesh.position;

          // A. IDLE BEHAVIOR: Shifting glowing regions in cyan, turquoise, and emerald
          const p1 = Math.sin(pos.x * 2.2 + elapsed * 0.35) * Math.cos(pos.y * 2.2 + elapsed * 0.25) * Math.sin(pos.z * 2.2 + elapsed * 0.4);
          const p2 = Math.cos(pos.x * 3.0 - elapsed * 0.3) * Math.sin(pos.z * 3.0 + elapsed * 0.45);
          const organicGlowField = Math.max(0, p1 * 0.6 + p2 * 0.4);

          let beadEmissiveIntensity = 0.04;
          tempTargetColor.copy(mesh.userData.baseColor);
          tempTargetEmissive.copy(mesh.userData.baseEmissive);

          if (organicGlowField > 0.15) {
            const glowT = (organicGlowField - 0.15) / 0.85;
            beadEmissiveIntensity = 0.04 + glowT * 0.28;
            if (glowT > 0.65) {
              tempTargetEmissive.copy(colorEmerald); // occasional emerald highlight
              tempTargetColor.lerp(colorEmerald, 0.35);
            } else if (glowT > 0.3) {
              tempTargetEmissive.copy(colorCyan);
              tempTargetColor.lerp(colorTurquoise, 0.4);
            } else {
              tempTargetEmissive.copy(colorTurquoise);
            }
          }

          // B. PROXIMITY BRIGHTNESS HIGHLIGHT (near cursor)
          if (smoothedProximityInfluence > 0.01) {
            const dist = pos.distanceTo(cursor3DLocal);

            if (dist < interactionRadius) {
              const norm = dist / interactionRadius;
              const proximity = Math.pow(1 - norm, 1.4) * smoothedProximityInfluence;

              if (proximity > 0.45) {
                tempTargetColor.lerp(colorWhite, proximity * 0.8);
                tempTargetEmissive.lerp(colorWhite, proximity * 0.9);
                beadEmissiveIntensity = Math.max(beadEmissiveIntensity, 0.65 + proximity * 0.6);
              } else if (proximity > 0.15) {
                tempTargetColor.lerp(colorCyan, proximity * 0.7);
                tempTargetEmissive.lerp(colorCyan, proximity * 0.8);
                beadEmissiveIntensity = Math.max(beadEmissiveIntensity, 0.3 + proximity * 0.5);
              } else {
                tempTargetEmissive.lerp(colorTurquoise, proximity * 0.5);
                beadEmissiveIntensity = Math.max(beadEmissiveIntensity, 0.12 + proximity * 0.3);
              }
            }
          }

          // C. VOICE MODULATION ON BRIGHTNESS (Only when AI speaks)
          if (state === 'speaking' && smoothedVoiceInfluence > 0.01) {
            const harmonicPulse = Math.sin(elapsed * 7.5 + mesh.userData.phase + mesh.userData.distance * 3.0) * 0.5 + 0.5;
            beadEmissiveIntensity += smoothedVoiceInfluence * 0.25 * harmonicPulse;
            tempTargetEmissive.lerp(colorCyan, smoothedVoiceInfluence * 0.3);
          }

          // Update material properties smoothly
          const mat = mesh.material as THREE.MeshPhysicalMaterial;
          if (mat) {
            mat.color.lerp(tempTargetColor, 0.18);
            mat.emissive.lerp(tempTargetEmissive, 0.18);
            mat.emissiveIntensity = THREE.MathUtils.lerp(
              mat.emissiveIntensity,
              Math.min(beadEmissiveIntensity, 1.8),
              0.18
            );
          }
        }
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize observer with subpixel jitter guard
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    const handleResize = () => {
      if (!container || isDisposed) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) return;
      lastWidth = width;
      lastHeight = height;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mouseleave', onPointerLeave);
      cancelAnimationFrame(animationFrameId);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      pearlTexture.dispose();
      ambientLight.dispose();
      keyLight.dispose();
      fillLight.dispose();
      rimLight.dispose();
      coreGlowLight.dispose();

      orbGroup.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat: any) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [externalGlbFile, onModelStatusChange]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full select-none z-0 cursor-default"
      aria-label="3D Particle Sphere Visualizer"
    />
  );
};
