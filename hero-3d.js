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
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 5.2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Lighting (Studio papercraft lighting)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
  keyLight.position.set(4, 5, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.7);
  fillLight.position.set(-4, -2, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfef3c7, 0.9);
  rimLight.position.set(0, 4, -4);
  scene.add(rimLight);

  // Pivot group to hold head
  const headGroup = new THREE.Group();
  scene.add(headGroup);

  // State
  let currentModel = null;
  let targetRotation = { x: 0, y: 0, z: 0 };
  let currentRotation = { x: 0, y: 0, z: 0 };
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
    if (typeof THREE.GLTFLoader !== 'undefined') {
      const loader = new THREE.GLTFLoader();
      loader.load(
        'assets/amrita.glb',
        (gltf) => {
          console.log('Custom amrita.glb model loaded successfully!');
          while (headGroup.children.length > 0) {
            headGroup.remove(headGroup.children[0]);
          }
          const model = gltf.scene;

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.4 / maxDim;

          model.scale.set(scale, scale, scale);
          model.position.sub(center.multiplyScalar(scale));

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          headGroup.add(model);
          currentModel = model;
          updateModelBadge(true);
        },
        undefined,
        () => {
          useFallbackBust();
        }
      );
    } else {
      useFallbackBust();
    }
  }

  function useFallbackBust() {
    while (headGroup.children.length > 0) {
      headGroup.remove(headGroup.children[0]);
    }
    const bust = createOrigamiBust();
    headGroup.add(bust);
    currentModel = bust;
    updateModelBadge(false);
  }

  function updateModelBadge(isCustom) {
    const badge = document.getElementById('modelStatusBadge');
    if (badge) {
      if (isCustom) {
        badge.innerHTML = '<span>•</span> Custom 3D Face Active';
        badge.classList.add('is-custom');
      } else {
        badge.innerHTML = '<span>•</span> 3D Origami Face • Drop amrita.glb to replace';
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
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'grab';
  });

  // Touch support
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
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
  });

  // Resize
  function onResize() {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

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

      // Draw tracking indicator on PiP canvas
      if (canvasCtx) {
        const cx = palmX * pipCanvas.width;
        const cy = palmY * pipCanvas.height;

        // Glowing palm point
        canvasCtx.beginPath();
        canvasCtx.arc(cx, cy, 14, 0, Math.PI * 2);
        canvasCtx.fillStyle = 'rgba(16, 185, 129, 0.3)';
        canvasCtx.fill();

        canvasCtx.beginPath();
        canvasCtx.arc(cx, cy, 6, 0, Math.PI * 2);
        canvasCtx.fillStyle = '#10b981';
        canvasCtx.fill();

        // Line to wrist
        canvasCtx.beginPath();
        canvasCtx.moveTo(cx, cy);
        canvasCtx.lineTo(wrist.x * pipCanvas.width, wrist.y * pipCanvas.height);
        canvasCtx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
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
      if (handStatusText) handStatusText.textContent = 'Hand active • Move to turn';
      if (pipStatusText) pipStatusText.textContent = 'Hand detected ✓';
      if (pipStatusDot) pipStatusDot.classList.add('active');
      if (handToggleBtn) handToggleBtn.classList.add('tracking');
    } else {
      // No hand in view
      if (performance.now() - lastHandDetectedTime > 1200) {
        if (handStatusText) handStatusText.textContent = 'Hold hand in front of camera';
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

    if (handStatusText) handStatusText.textContent = 'Requesting camera...';

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
        if (handStatusText) handStatusText.textContent = 'Loading AI model...';
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
      if (handStatusText) handStatusText.textContent = 'Hold hand in front of camera';

      // 4. Start frame loop
      animFrameId = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      console.error('Webcam error:', err);
      if (handStatusText) handStatusText.textContent = 'Camera blocked (Click to retry)';
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
    if (handStatusText) handStatusText.textContent = 'Camera off • Mouse control active';

    // Re-center smoothly
    targetRotation = { x: 0, y: 0, z: 0 };
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
