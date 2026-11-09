/**
 * 3D Interactive Hero Experience
 * - Three.js WebGL viewport with studio lighting & origami faceted materials
 * - Auto-loads 'assets/amrita.glb' when present; falls back to procedural origami bust
 * - Smooth cursor / touch parallax physics with inertia
 * - Google MediaPipe Hand Gesture Control via webcam (100% on-device)
 */

(function () {
  const container = document.getElementById('hero3dCanvasContainer');
  if (!container) return;

  // Scene setup
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
  let targetRotation = { x: 0, y: 0 };
  let currentRotation = { x: 0, y: 0 };
  let isDragging = false;
  let prevPointer = { x: 0, y: 0 };
  let dragVelocity = { x: 0, y: 0 };
  let handTrackingActive = false;
  let handCamera = null;
  let handModel = null;
  let lastHandDetectedTime = 0;

  // 1. Procedural Origami Faceted Bust (Default until amrita.glb is uploaded)
  function createOrigamiBust() {
    const bustGroup = new THREE.Group();

    // Material with paper/origami flat-shaded aesthetic
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

    // Face / Cranium (deformed icosahedron for faceted planes)
    const headGeom = new THREE.IcosahedronGeometry(1.05, 2);
    const pos = headGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Elongate head vertically
      y *= 1.25;

      // Flatten sides slightly
      x *= 0.88;

      // Chin taper
      if (y < -0.3) {
        x *= Math.max(0.4, 1.0 + (y + 0.3) * 0.9);
        z *= Math.max(0.5, 1.0 + (y + 0.3) * 0.7);
      }

      // Nose bridge protrusion
      if (z > 0.4 && y > -0.2 && y < 0.35 && Math.abs(x) < 0.25) {
        z += 0.24 * (1 - Math.abs(x) / 0.25);
      }

      // Cheekbones definition
      if (z > 0.2 && y > -0.15 && y < 0.25 && Math.abs(x) > 0.35) {
        x *= 1.12;
        z += 0.1;
      }

      // Flatten back of skull
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

    // Hair origami shell (wrap over top, sides, and back)
    const hairGeom = new THREE.IcosahedronGeometry(1.18, 1);
    const hPos = hairGeom.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      let x = hPos.getX(i);
      let y = hPos.getY(i) * 1.3;
      let z = hPos.getZ(i);

      // Only cover top, sides, back (cut out front face)
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

  // 2. Try loading amrita.glb; fall back to procedural origami bust
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

          // Normalize bounding box & scale
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.4 / maxDim;

          model.scale.set(scale, scale, scale);
          model.position.sub(center.multiplyScalar(scale));

          // Ensure flat shading or optimal material appearance
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
        (err) => {
          // GLB not yet uploaded, use origami bust
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

  // 3. Mouse Parallax & Inertia Dragging
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
      targetRotation.y = normX * 0.55;
      targetRotation.x = -normY * 0.35;
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

  // Window Resize
  function onResize() {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // 4. Render Loop with Elastic Spring Physics
  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Idle floating breathing wave
    const elapsedTime = clock.getElapsedTime();
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

    // Smooth lerp interpolation
    const lerpSpeed = handTrackingActive ? 0.14 : 0.07;
    currentRotation.x += (targetRotation.x - currentRotation.x) * lerpSpeed;
    currentRotation.y += (targetRotation.y - currentRotation.y) * lerpSpeed;

    headGroup.rotation.x = currentRotation.x;
    headGroup.rotation.y = currentRotation.y;
    headGroup.rotation.z = -currentRotation.y * 0.12 + idleTilt;
    headGroup.position.y = idleFloatY;

    renderer.render(scene, camera);
  }
  animate();

  // 5. MediaPipe Hands Integration
  const handToggleBtn = document.getElementById('handControlToggle');
  const handStatusText = document.getElementById('handStatusText');
  const videoElement = document.getElementById('handWebcamVideo');

  async function initHandTracking() {
    if (!videoElement || typeof Hands === 'undefined') {
      alert('MediaPipe library is still loading or not supported in this browser.');
      return;
    }

    try {
      handStatusText.textContent = 'Starting camera...';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      videoElement.srcObject = stream;
      await videoElement.play();

      handModel = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      handModel.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });

      handModel.onResults((results) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          lastHandDetectedTime = performance.now();
          const landmarks = results.multiHandLandmarks[0];

          // Wrist (0), Middle MCP (9), Index Tip (8)
          const wrist = landmarks[0];
          const middleKnuckle = landmarks[9];

          // Normalize hand position (invert x since webcam is mirrored)
          const normX = (1 - middleKnuckle.x) * 2 - 1;
          const normY = -(middleKnuckle.y * 2 - 1);

          targetRotation.y = normX * 1.1;
          targetRotation.x = normY * 0.7;

          handStatusText.textContent = 'Hand active • Move to turn';
          handToggleBtn.classList.add('tracking');
        } else {
          if (performance.now() - lastHandDetectedTime > 1500) {
            handStatusText.textContent = 'Show hand to camera';
            handToggleBtn.classList.remove('tracking');
          }
        }
      });

      handCamera = new Camera(videoElement, {
        onFrame: async () => {
          if (handTrackingActive && handModel) {
            await handModel.send({ image: videoElement });
          }
        },
        width: 320,
        height: 240,
      });

      handCamera.start();
      handTrackingActive = true;
      handToggleBtn.classList.add('active');
      handStatusText.textContent = 'Show hand to camera';
    } catch (err) {
      console.error('Camera access denied or error:', err);
      handStatusText.textContent = 'Camera blocked (Click to retry)';
      handTrackingActive = false;
      handToggleBtn.classList.remove('active');
    }
  }

  function stopHandTracking() {
    handTrackingActive = false;
    if (handCamera) {
      handCamera.stop();
    }
    if (videoElement && videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoElement.srcObject = null;
    }
    handToggleBtn.classList.remove('active', 'tracking');
    handStatusText.textContent = 'Camera off • Mouse control active';
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
