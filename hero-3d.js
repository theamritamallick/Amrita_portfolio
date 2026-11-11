/**
 * 3D Interactive Hero Experience
 * - Three.js WebGL viewport with studio papercraft lighting
 * - Auto-loads 'assets/amrita.glb' when present; falls back to procedural origami bust
 * - Smooth cursor / touch parallax physics with inertia
 * - Google MediaPipe Hand Gesture Control via webcam with real-time PiP feedback
 */

(function () {
  const container = document.getElementById('hero3dCanvasContainer');
  if (!container) return;

  // 1. Three.js Scene Setup
  const initialWidth = container.clientWidth || 400;
  const initialHeight = container.clientHeight || 320;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, initialWidth / initialHeight, 0.1, 1000);
  camera.position.set(0, 0, 5.2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(initialWidth, initialHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Lighting (Studio Dark dramatic portrait lighting)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
  keyLight.position.set(4, 5, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
  fillLight.position.set(-4, -2, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 1.4);
  rimLight.position.set(0, 4, -4);
  scene.add(rimLight);

  // Pivot group to hold head
  const headGroup = new THREE.Group();
  scene.add(headGroup);

  // State
  let currentModel = null;
  let baseModelScale = { x: 1, y: 1, z: 1 };
  let targetRotation = { x: 0, y: 0, z: 0 };
  let currentRotation = { x: 0, y: 0, z: 0 };
  let targetSqueeze = 0;
  let currentSqueeze = 0;
  let squeezeVelocity = 0;
  let isDragging = false;
  let prevPointer = { x: 0, y: 0 };
  let dragVelocity = { x: 0, y: 0 };
  let handTrackingActive = false;
  let handModel = null;
  let animFrameId = null;
  let isProcessingFrame = false;
  let lastHandDetectedTime = 0;

  // 2. Procedural Origami Faceted Bust (Live Placeholder)
  function createOrigamiBust() {
    const bustGroup = new THREE.Group();

    const paperMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8f4ec,
      roughness: 0.55,
      metalness: 0.05,
      flatShading: true,
    });

    const hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x242832,
      roughness: 0.65,
      metalness: 0.08,
      flatShading: true,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0xecd8c6,
      roughness: 0.5,
      metalness: 0.05,
      flatShading: true,
    });

    // Face / Cranium
    const headGeom = new THREE.IcosahedronGeometry(1.05, 2);
    const pos = headGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i) * 1.25;
      let z = pos.getZ(i);

      x *= 0.88;

      if (y < -0.3) {
        x *= Math.max(0.4, 1.0 + (y + 0.3) * 0.9);
        z *= Math.max(0.5, 1.0 + (y + 0.3) * 0.7);
      }

      if (z > 0.4 && y > -0.2 && y < 0.35 && Math.abs(x) < 0.25) {
        z += 0.24 * (1 - Math.abs(x) / 0.25);
      }

      if (z > 0.2 && y > -0.15 && y < 0.25 && Math.abs(x) > 0.35) {
        x *= 1.12;
        z += 0.1;
      }

      if (z < -0.3) {
        z *= 0.82;
      }

      pos.setXYZ(i, x, y, z);
    }
    headGeom.computeVertexNormals();

    const headMesh = new THREE.Mesh(headGeom, paperMaterial);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    bustGroup.add(headMesh);

    // Hair origami shell
    const hairGeom = new THREE.IcosahedronGeometry(1.18, 1);
    const hPos = hairGeom.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      let x = hPos.getX(i);
      let y = hPos.getY(i) * 1.3;
      let z = hPos.getZ(i);

      if (z > 0.45 && y < 0.4) {
        z -= 0.6;
        y += 0.3;
      }

      if (y > 0.4) {
        y += 0.15;
      }
      hPos.setXYZ(i, x * 0.96, y, z * 0.96);
    }
    hairGeom.computeVertexNormals();
    const hairMesh = new THREE.Mesh(hairGeom, hairMaterial);
    bustGroup.add(hairMesh);

    // Neck & Collar base
    const neckGeom = new THREE.CylinderGeometry(0.38, 0.58, 0.85, 7);
    neckGeom.computeVertexNormals();
    const neckMesh = new THREE.Mesh(neckGeom, accentMaterial);
    neckMesh.position.y = -1.35;
    bustGroup.add(neckMesh);

    bustGroup.position.y = 0.2;
    return bustGroup;
  }

  // 3. Load Model (amrita.glb if available; fallback bust if not)
  function loadModel() {
    // Start with fallback bust so scene is never blank
    useFallbackBust();

    if (typeof THREE.GLTFLoader !== 'undefined') {
      const loader = new THREE.GLTFLoader();
      const badge = document.getElementById('modelStatusBadge');
      if (badge) {
        badge.innerHTML = '<span>•</span> Loading 3D Face...';
      }

      loader.load(
        'assets/amrita.glb',
        (gltf) => {
          console.log('Custom amrita.glb loaded successfully!');
          while (headGroup.children.length > 0) {
            headGroup.remove(headGroup.children[0]);
          }
          const model = gltf.scene;

          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.5 / maxDim;

          baseModelScale = { x: scale, y: scale, z: scale };
          model.scale.set(scale, scale, scale);
          model.position.set(-center.x * scale, -center.y * scale + 0.1, -center.z * scale);

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = Math.min(child.material.roughness || 0.6, 0.7);
                child.material.needsUpdate = true;
              }
            }
          });

          headGroup.add(model);
          currentModel = model;
          updateModelBadge(true);
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            const badgeEl = document.getElementById('modelStatusBadge');
            if (badgeEl) {
              badgeEl.innerHTML = `<span>•</span> Loading 3D Face (${pct}%)`;
            }
          }
        },
        (err) => {
          console.warn('amrita.glb not loaded, using fallback origami bust:', err);
          updateModelBadge(false);
        }
      );
    }
  }

  function useFallbackBust() {
    while (headGroup.children.length > 0) {
      headGroup.remove(headGroup.children[0]);
    }
    const bust = createOrigamiBust();
    baseModelScale = { x: 1, y: 1, z: 1 };
    headGroup.add(bust);
    currentModel = bust;
    updateModelBadge(false);
  }

  function updateModelBadge(isCustom) {
    const badge = document.getElementById('modelStatusBadge');
    if (badge) {
      if (isCustom) {
        badge.innerHTML = '<span>•</span> 3D Face Active';
        badge.classList.add('is-custom');
      } else {
        badge.innerHTML = '<span>•</span> 3D Origami Face';
        badge.classList.remove('is-custom');
      }
    }
  }

  loadModel();

  // 4. Mouse Parallax & Dragging
  window.addEventListener('mousemove', (e) => {
    if (handTrackingActive) return; // Hand tracking takes priority when active

    if (isDragging) {
      const deltaX = e.clientX - prevPointer.x;
      const deltaY = e.clientY - prevPointer.y;
      targetRotation.y += deltaX * 0.008;
      targetRotation.x += deltaY * 0.008;
      dragVelocity.x = deltaX * 0.008;
      dragVelocity.y = deltaY * 0.008;
      prevPointer = { x: e.clientX, y: e.clientY };
    } else {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      targetRotation.y = normX * 0.65;
      targetRotation.x = -normY * 0.4;
      targetRotation.z = 0;
    }
  });

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevPointer = { x: e.clientX, y: e.clientY };
    container.style.cursor = 'grabbing';
    if (!handTrackingActive) {
      targetSqueeze = 0.45; // Hold click to squeeze!
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'grab';
    if (!handTrackingActive) {
      targetSqueeze = 0; // Release to bounce back
    }
  });

  // Touch support
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (!handTrackingActive) {
        targetSqueeze = 0.45;
      }
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - prevPointer.x;
      const deltaY = e.touches[0].clientY - prevPointer.y;
      targetRotation.y += deltaX * 0.01;
      targetRotation.x += deltaY * 0.01;
      prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDragging = false;
    if (!handTrackingActive) {
      targetSqueeze = 0;
    }
  });

  // Resize
  function onResize() {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      onResize();
    });
    resizeObserver.observe(container);
  }

  // 5. Render Loop with Smooth Spring Physics
  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Idle floating wave
    const idleFloatY = Math.sin(elapsedTime * 1.4) * 0.04;
    const idleTilt = Math.sin(elapsedTime * 0.9) * 0.02;

    if (!isDragging && !handTrackingActive) {
      dragVelocity.x *= 0.92;
      dragVelocity.y *= 0.92;
      targetRotation.y += dragVelocity.x;
      targetRotation.x += dragVelocity.y;
    }

    // Clamp vertical tilt
    targetRotation.x = Math.max(-0.65, Math.min(0.65, targetRotation.x));

    // Smooth lerp
    const lerpSpeed = handTrackingActive ? 0.12 : 0.07;
    currentRotation.x += (targetRotation.x - currentRotation.x) * lerpSpeed;
    currentRotation.y += (targetRotation.y - currentRotation.y) * lerpSpeed;
    currentRotation.z += (targetRotation.z - currentRotation.z) * lerpSpeed;

    // Damped harmonic spring for squeeze squash & stretch
    const springK = 0.22;
    const damping = 0.78;
    squeezeVelocity += (targetSqueeze - currentSqueeze) * springK;
    squeezeVelocity *= damping;
    currentSqueeze += squeezeVelocity;

    if (currentModel) {
      // Squash & Stretch deformation:
      // X narrows (squishes cheeks inwards)
      // Y compresses downwards (squashes vertically)
      // Z pushes outwards (preserves natural volume)
      const sqX = 1 - 0.28 * currentSqueeze;
      const sqY = 1 - 0.32 * currentSqueeze;
      const sqZ = 1 + 0.22 * currentSqueeze;

      currentModel.scale.set(
        baseModelScale.x * sqX,
        baseModelScale.y * sqY,
        baseModelScale.z * sqZ
      );
    }

    headGroup.rotation.x = currentRotation.x;
    headGroup.rotation.y = currentRotation.y;
    headGroup.rotation.z = currentRotation.z + idleTilt;
    headGroup.position.y = idleFloatY;

    renderer.render(scene, camera);
  }
  animate();

  // 6. MediaPipe Hand Tracking (Native, robust frame loop with PiP feedback)
  const handToggleBtn = document.getElementById('handControlToggle');
  const handStatusText = document.getElementById('handStatusText');
  const videoElement = document.getElementById('handWebcamVideo');
  const pipContainer = document.getElementById('webcamPreviewPip');
  const pipCanvas = document.getElementById('handLandmarksCanvas');
  const pipStatusDot = document.getElementById('pipStatusDot');
  const pipStatusText = document.getElementById('pipStatusText');

  let canvasCtx = null;
  if (pipCanvas) {
    canvasCtx = pipCanvas.getContext('2d');
  }

  // Handle detection results
  function handleHandResults(results) {
    if (!handTrackingActive) return;

    // Adjust canvas resolution to match video
    if (pipCanvas && videoElement.videoWidth) {
      if (pipCanvas.width !== videoElement.videoWidth || pipCanvas.height !== videoElement.videoHeight) {
        pipCanvas.width = videoElement.videoWidth;
        pipCanvas.height = videoElement.videoHeight;
      }
    }

    if (canvasCtx) {
      canvasCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      lastHandDetectedTime = performance.now();
      const landmarks = results.multiHandLandmarks[0];

      // Key landmark points
      const wrist = landmarks[0];
      const indexMcp = landmarks[5];
      const middleMcp = landmarks[9];
      const pinkyMcp = landmarks[17];
      const middleTip = landmarks[12];

      // Calculate Palm Center
      const palmX = (wrist.x + indexMcp.x + middleMcp.x + pinkyMcp.x) / 4;
      const palmY = (wrist.y + indexMcp.y + middleMcp.y + pinkyMcp.y) / 4;

      // Squeeze Detection: calculate distance of fingertips to palm center
      // Finger tips: 4 (thumb), 8 (index), 12 (middle), 16 (ring), 20 (pinky)
      const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
      let totalTipDist = 0;
      for (let i = 0; i < tips.length; i++) {
        const dX = tips[i].x - palmX;
        const dY = tips[i].y - palmY;
        totalTipDist += Math.sqrt(dX * dX + dY * dY);
      }
      const avgTipDist = totalTipDist / tips.length;

      // When hand is open, avg distance is ~0.34+; clenched fist is ~0.14 or less
      const openThreshold = 0.35;
      const fistThreshold = 0.14;
      const rawSqueeze = (openThreshold - avgTipDist) / (openThreshold - fistThreshold);
      targetSqueeze = THREE.MathUtils.clamp(rawSqueeze, 0, 1);

      // Draw tracking indicator on PiP canvas
      if (canvasCtx) {
        const cx = palmX * pipCanvas.width;
        const cy = palmY * pipCanvas.height;

        // Visual feedback circle on palm: contracts and turns pink/purple when squeezing!
        const indicatorRadius = Math.max(5, 14 * (1 - 0.45 * targetSqueeze));
        canvasCtx.beginPath();
        canvasCtx.arc(cx, cy, indicatorRadius + 6, 0, Math.PI * 2);
        canvasCtx.fillStyle = targetSqueeze > 0.35 ? 'rgba(236, 72, 153, 0.35)' : 'rgba(16, 185, 129, 0.25)';
        canvasCtx.fill();

        canvasCtx.beginPath();
        canvasCtx.arc(cx, cy, indicatorRadius, 0, Math.PI * 2);
        canvasCtx.fillStyle = targetSqueeze > 0.35 ? '#ec4899' : '#10b981';
        canvasCtx.fill();

        // Line to wrist
        canvasCtx.beginPath();
        canvasCtx.moveTo(cx, cy);
        canvasCtx.lineTo(wrist.x * pipCanvas.width, wrist.y * pipCanvas.height);
        canvasCtx.strokeStyle = targetSqueeze > 0.35 ? 'rgba(236, 72, 153, 0.7)' : 'rgba(16, 185, 129, 0.6)';
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
      }

      // X mapping: in mirrored video, moving hand to your right moves palmX towards 0
      const rawNormX = (0.5 - palmX) * 2; // -1 (left) to +1 (right)
      const rawNormY = (0.5 - palmY) * 2; // -1 (down) to +1 (up)

      // Hand tilt (wrist to middle knuckle angle)
      const dx = middleMcp.x - wrist.x;
      const dy = middleMcp.y - wrist.y;
      const tiltAngle = Math.atan2(dx, -dy); // In radians

      // Apply target rotations with smooth dampening
      targetRotation.y = THREE.MathUtils.clamp(rawNormX * 1.25, -1.2, 1.2);
      targetRotation.x = THREE.MathUtils.clamp(-rawNormY * 0.8, -0.6, 0.6);
      targetRotation.z = THREE.MathUtils.clamp(-tiltAngle * 0.35, -0.4, 0.4);

      // Status updates
      if (targetSqueeze > 0.35) {
        if (handStatusText) handStatusText.textContent = 'Squeezing! ✊';
        if (pipStatusText) pipStatusText.textContent = 'Squeezing! ✊';
      } else {
        if (handStatusText) handStatusText.textContent = 'Tracking hand ✓';
        if (pipStatusText) pipStatusText.textContent = 'Hand detected ✓';
      }
      if (pipStatusDot) pipStatusDot.classList.add('active');
      if (handToggleBtn) handToggleBtn.classList.add('tracking');
    } else {
      targetSqueeze = 0;
      // No hand in view
      if (performance.now() - lastHandDetectedTime > 1200) {
        if (handStatusText) handStatusText.textContent = 'Hold hand up';
        if (pipStatusText) pipStatusText.textContent = 'Waiting for hand...';
        if (pipStatusDot) pipStatusDot.classList.remove('active');
        if (handToggleBtn) handToggleBtn.classList.remove('tracking');
      }
    }
  }

  // Native Detection Frame Loop
  async function runDetectionLoop() {
    if (!handTrackingActive) return;

    if (videoElement && videoElement.readyState >= 2 && !isProcessingFrame && handModel) {
      isProcessingFrame = true;
      try {
        await handModel.send({ image: videoElement });
      } catch (err) {
        console.warn('Frame detection note:', err);
      }
      isProcessingFrame = false;
    }

    if (handTrackingActive) {
      animFrameId = requestAnimationFrame(runDetectionLoop);
    }
  }

  // Start Camera & Model
  async function initHandTracking() {
    if (!videoElement) return;

    if (handStatusText) handStatusText.textContent = 'Requesting...';

    try {
      // 1. Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      videoElement.srcObject = stream;
      await new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play().then(resolve).catch(resolve);
        };
      });

      // 2. Initialize MediaPipe Hands if not ready
      if (!handModel && typeof Hands !== 'undefined') {
        if (handStatusText) handStatusText.textContent = 'Loading AI...';
        handModel = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        handModel.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        handModel.onResults(handleHandResults);
      }

      // 3. Show PiP Preview Window
      handTrackingActive = true;
      if (pipContainer) pipContainer.classList.add('active');
      if (handToggleBtn) handToggleBtn.classList.add('active');
      if (handStatusText) handStatusText.textContent = 'Hold hand up';

      // 4. Start frame loop
      animFrameId = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      console.error('Webcam error:', err);
      if (handStatusText) handStatusText.textContent = 'Camera blocked';
      if (pipContainer) pipContainer.classList.remove('active');
      if (handToggleBtn) handToggleBtn.classList.remove('active', 'tracking');
      handTrackingActive = false;
    }
  }

  // Stop Camera
  function stopHandTracking() {
    handTrackingActive = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    if (videoElement && videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoElement.srcObject = null;
    }

    if (canvasCtx && pipCanvas) {
      canvasCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
    }

    if (pipContainer) pipContainer.classList.remove('active');
    if (handToggleBtn) handToggleBtn.classList.remove('active', 'tracking');
    if (pipStatusDot) pipStatusDot.classList.remove('active');
    if (handStatusText) handStatusText.textContent = 'Move & squeeze';

    // Re-center smoothly
    targetRotation = { x: 0, y: 0, z: 0 };
    targetSqueeze = 0;
  }

  if (handToggleBtn) {
    handToggleBtn.addEventListener('click', () => {
      if (!handTrackingActive) {
        initHandTracking();
      } else {
        stopHandTracking();
      }
    });
  }
})();
