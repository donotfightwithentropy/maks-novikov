"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { RoomEnvironment } from "./RoomEnvironment";

const MODEL_URL = "models/nuetel-keyboard.glb";
/** Максимальный наклон группы от курсора — 10° в радианах */
const MAX_TILT = (10 * Math.PI) / 180;
/** Множитель интенсивности источников света, импортированных из .glb */
const LIGHT_INTENSITY_SCALE = 9e-4;
const MATERIAL_ROUGHNESS = 0.22;
const MATERIAL_METALNESS = 0.04;
const MATERIAL_ENV_MAP_INTENSITY = 0.6;

/**
 * Загрузка .glb: обычный URL — через `load`, data-URI — вручную через `parse`
 * (GLTFLoader не умеет base64 с произвольным mime-типом).
 */
const loadScene = (loader: GLTFLoader, url: string): Promise<THREE.Group> =>
  new Promise((resolve, reject) => {
    const onLoad = (gltf: GLTF) => resolve(gltf.scene);

    if (url.startsWith("data:")) {
      try {
        const binary = atob(url.slice(url.indexOf(",") + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        loader.parse(bytes.buffer, "", onLoad, reject);
      } catch (error) {
        reject(error);
      }
    } else {
      loader.load(url, onLoad, undefined, reject);
    }
  });

type Props = {
  anchorRef: React.RefObject<HTMLElement | null>;
  className?: string;
};

export default function NuetelScene({ anchorRef, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // WebGL недоступен — просто ничего не рисуем
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0, 0);
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // IBL: комната → PMREM
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRenderTarget = pmremGenerator.fromScene(RoomEnvironment(), 0.04);
    scene.environment = envRenderTarget.texture;
    scene.environmentIntensity = 0.5;

    const camera = new THREE.PerspectiveCamera(16.46, 16 / 9, 0.1, 1e3);
    camera.position.set(-0.2575, 2.9414, 9.6991);

    // tiltGroup вращается от курсора, pivotGroup компенсирует центр модели
    const tiltGroup = new THREE.Group();
    const pivotGroup = new THREE.Group();
    tiltGroup.add(pivotGroup);
    scene.add(tiltGroup);

    let ready = false;
    const loader = new GLTFLoader();

    loadScene(loader, MODEL_URL)
      .then((model) => {
        model.updateMatrixWorld(true);

        // Камеру берём из самой модели (её выставил дизайнер в Blender)
        model.traverse((object) => {
          const cameraNode = object as THREE.PerspectiveCamera;
          if (cameraNode.isPerspectiveCamera) {
            cameraNode.getWorldPosition(camera.position);
            cameraNode.getWorldQuaternion(camera.quaternion);
            camera.fov = cameraNode.fov;
            object.visible = false;
          }
        });

        // Свет вынимаем из иерархии модели и переносим в сцену,
        // запекая мировую трансформацию и пересчитывая интенсивность
        const lights: THREE.Light[] = [];
        model.traverse((object) => {
          if ((object as THREE.Light).isLight) {
            lights.push(object as THREE.Light);
          }
        });

        for (const light of lights) {
          light.removeFromParent();
          light.position.setFromMatrixPosition(light.matrixWorld);
          light.quaternion.setFromRotationMatrix(light.matrixWorld);
          light.intensity *= LIGHT_INTENSITY_SCALE;
          scene.add(light);
        }

        model.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;

          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          for (const material of materials) {
            const standard = material as THREE.MeshStandardMaterial;
            if (!standard || !("roughness" in standard)) continue;
            standard.roughness = MATERIAL_ROUGHNESS;
            standard.metalness = MATERIAL_METALNESS;
            standard.envMapIntensity = MATERIAL_ENV_MAP_INTENSITY;
            standard.needsUpdate = true;
          }
        });

        pivotGroup.add(model);

        // Центрируем модель в точке вращения
        const center = new THREE.Box3()
          .setFromObject(model)
          .getCenter(new THREE.Vector3());
        tiltGroup.position.copy(center);
        pivotGroup.position.copy(center).negate();

        ready = true;
      })
      .catch(() => {});

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let targetTiltX = 0;
    let targetTiltY = 0;
    let tiltX = 0;
    let tiltY = 0;

    const onPointerMove = (event: PointerEvent) => {
      targetTiltY =
        THREE.MathUtils.clamp(
          (event.clientX / window.innerWidth) * 2 - 1,
          -1,
          1,
        ) * MAX_TILT;
      targetTiltX =
        THREE.MathUtils.clamp(
          (event.clientY / window.innerHeight) * 2 - 1,
          -1,
          1,
        ) * MAX_TILT;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let frameId = 0;
    let lastTime = performance.now();

    const tick = (time: number) => {
      frameId = requestAnimationFrame(tick);

      const delta = Math.min((time - lastTime) / 1e3, 0.1);
      lastTime = time;
      if (!ready) return;

      const width = container.clientWidth;
      const height = container.clientHeight;
      const anchorRect = anchorRef.current?.getBoundingClientRect();

      const setVisible = (visible: boolean) => {
        renderer.domElement.style.visibility = visible ? "visible" : "hidden";
      };

      // Якорь далеко за пределами вьюпорта — не рисуем
      if (
        !anchorRect ||
        !width ||
        !height ||
        anchorRect.bottom < -200 ||
        anchorRect.top > height + 200
      ) {
        return setVisible(false);
      }
      setVisible(true);

      // Экспоненциальное сглаживание наклона, независимое от fps
      const lerpFactor = 1 - Math.exp(-delta * 5);
      tiltX += (targetTiltX - tiltX) * lerpFactor;
      tiltY += (targetTiltY - tiltY) * lerpFactor;
      tiltGroup.rotation.set(tiltX, tiltY, 0);

      const canvasRect = container.getBoundingClientRect();
      const parentRect = container.parentElement?.getBoundingClientRect();

      // Обрезаем рендер по границам родителя (scissor в координатах WebGL — снизу)
      if (parentRect) {
        const scissorLeft = Math.max(0, parentRect.left - canvasRect.left);
        const scissorRight = Math.min(width, parentRect.right - canvasRect.left);
        const scissorBottom = Math.max(0, canvasRect.bottom - parentRect.bottom);
        const scissorTop = Math.min(height, canvasRect.bottom - parentRect.top);

        if (scissorRight <= scissorLeft || scissorTop <= scissorBottom) {
          return setVisible(false);
        }

        renderer.setScissorTest(true);
        renderer.setScissor(
          scissorLeft,
          scissorBottom,
          scissorRight - scissorLeft,
          scissorTop - scissorBottom,
        );
      }

      // Камера «живёт» в системе якоря: канвас — окно внутри полного кадра якоря
      camera.aspect = anchorRect.width / anchorRect.height;
      camera.setViewOffset(
        anchorRect.width,
        anchorRect.height,
        canvasRect.left - anchorRect.left,
        canvasRect.top - anchorRect.top,
        width,
        height,
      );
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      renderer.render(scene, camera);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      envRenderTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [anchorRef]);

  return <div ref={containerRef} className={className} aria-hidden />;
}
