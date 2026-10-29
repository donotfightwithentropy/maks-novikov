import * as THREE from "three";

/**
 * Порт `RoomEnvironment` из three.js (examples/jsm/environments).
 * Собирает сцену-«комнату» из плоскостей со светящимися материалами —
 * она рендерится в кубическую карту через PMREMGenerator и служит IBL-окружением.
 *
 * Отличие от апстрима: вся комната сдвинута вниз (`position.y = -3.5`),
 * чтобы основной свет приходил сверху-сбоку под нужным углом.
 */
class RoomEnvironmentScene extends THREE.Scene {
  constructor() {
    super();

    this.name = "RoomEnvironment";
    this.position.y = -3.5;

    const geometry = new THREE.BoxGeometry();
    geometry.deleteAttribute("uv");

    // TODO: проверить класс (в бандле два разных биндинга материала)
    const roomMaterial = new THREE.MeshStandardMaterial({
      side: THREE.BackSide,
    });
    const boxMaterial = new THREE.MeshStandardMaterial();

    const mainLight = new THREE.PointLight(0xffffff, 900, 28, 2);
    mainLight.position.set(0.418, 16.199, 0.3);
    this.add(mainLight);

    // Сама «комната» — вывернутый наизнанку бокс
    const room = new THREE.Mesh(geometry, roomMaterial);
    room.position.set(-0.757, 13.219, 0.717);
    room.scale.set(31.713, 28.305, 28.591);
    this.add(room);

    // Шесть «коробок» внутри комнаты одним instanced-меш
    const boxes = new THREE.InstancedMesh(geometry, boxMaterial, 6);

    const dummy = new THREE.Object3D();

    dummy.position.set(-10.906, 2.009, 1.846);
    dummy.rotation.set(0, -0.195, 0);
    dummy.scale.set(2.328, 7.905, 4.651);
    dummy.updateMatrix();
    boxes.setMatrixAt(0, dummy.matrix);

    dummy.position.set(-5.607, -0.754, -0.758);
    dummy.rotation.set(0, 0.994, 0);
    dummy.scale.set(1.97, 1.534, 3.955);
    dummy.updateMatrix();
    boxes.setMatrixAt(1, dummy.matrix);

    dummy.position.set(6.167, 0.857, 7.803);
    dummy.rotation.set(0, 0.561, 0);
    dummy.scale.set(3.927, 6.285, 3.687);
    dummy.updateMatrix();
    boxes.setMatrixAt(2, dummy.matrix);

    dummy.position.set(-2.017, 0.018, 6.124);
    dummy.rotation.set(0, 0.333, 0);
    dummy.scale.set(2.002, 4.566, 2.064);
    dummy.updateMatrix();
    boxes.setMatrixAt(3, dummy.matrix);

    dummy.position.set(2.291, -0.756, -2.621);
    dummy.rotation.set(0, -0.286, 0);
    dummy.scale.set(1.546, 1.552, 1.496);
    dummy.updateMatrix();
    boxes.setMatrixAt(4, dummy.matrix);

    dummy.position.set(-2.193, -0.369, -5.547);
    dummy.rotation.set(0, 0.516, 0);
    dummy.scale.set(3.875, 3.487, 2.986);
    dummy.updateMatrix();
    boxes.setMatrixAt(5, dummy.matrix);

    this.add(boxes);

    // Светящиеся плоскости — «софтбоксы» комнаты
    const light1 = new THREE.Mesh(geometry, createAreaLightMaterial(50));
    light1.position.set(-16.116, 14.37, 8.208);
    light1.scale.set(0.1, 2.428, 2.739);
    this.add(light1);

    const light2 = new THREE.Mesh(geometry, createAreaLightMaterial(50));
    light2.position.set(-16.109, 18.021, -8.207);
    light2.scale.set(0.1, 2.425, 2.751);
    this.add(light2);

    const light3 = new THREE.Mesh(geometry, createAreaLightMaterial(17));
    light3.position.set(14.904, 12.198, -1.832);
    light3.scale.set(0.15, 4.265, 6.331);
    this.add(light3);

    const light4 = new THREE.Mesh(geometry, createAreaLightMaterial(43));
    light4.position.set(-0.462, 8.89, 14.52);
    light4.scale.set(4.38, 5.441, 0.088);
    this.add(light4);

    const light5 = new THREE.Mesh(geometry, createAreaLightMaterial(20));
    light5.position.set(3.235, 11.486, -12.541);
    light5.scale.set(2.5, 2, 0.1);
    this.add(light5);

    // Потолок
    const light6 = new THREE.Mesh(geometry, createAreaLightMaterial(100));
    light6.position.set(0, 20, 0);
    light6.scale.set(1, 0.1, 1);
    this.add(light6);
  }

  dispose() {
    const resources = new Set<
      THREE.BufferGeometry | THREE.Material | THREE.Material[]
    >();

    this.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        resources.add(mesh.geometry);
        resources.add(mesh.material);
      }
    });

    for (const resource of resources) {
      (resource as THREE.BufferGeometry | THREE.Material).dispose();
    }
  }
}

// TODO: проверить класс (в бандле отдельный от MeshStandardMaterial биндинг)
function createAreaLightMaterial(intensity: number) {
  return new THREE.MeshPhysicalMaterial({
    color: 0,
    emissive: 16777215,
    emissiveIntensity: intensity,
  });
}

export { RoomEnvironmentScene };

export function RoomEnvironment(): RoomEnvironmentScene {
  return new RoomEnvironmentScene();
}
