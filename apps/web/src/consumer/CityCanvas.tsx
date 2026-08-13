import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CitySkyline, prefersReducedMotion, seeded } from "./motion";

const INK = 0x146447;
const PAPER = 0xffffff;
const FOREST = 0x146447;
const TERRACOTTA = 0xe77800;

type Structure = { mesh: THREE.Object3D; bornAt: number };

function makeBlock(width: number, height: number, depth: number, fill: number, line: number): THREE.Object3D {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const body = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: fill, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  body.position.y = height / 2;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: line }));
  edges.position.y = height / 2;
  group.add(body, edges);
  return group;
}

function makeTree(index: number): THREE.Object3D {
  const group = new THREE.Group();
  const trunkGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.1);
  const trunk = new THREE.Mesh(trunkGeometry, new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  trunk.position.y = 0.25;
  const trunkEdges = new THREE.LineSegments(new THREE.EdgesGeometry(trunkGeometry), new THREE.LineBasicMaterial({ color: INK }));
  trunkEdges.position.y = 0.25;
  const canopyGeometry = new THREE.IcosahedronGeometry(0.34 + seeded(index * 7) * 0.14, 0);
  const canopy = new THREE.Mesh(canopyGeometry, new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  canopy.position.y = 0.78;
  const canopyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(canopyGeometry), new THREE.LineBasicMaterial({ color: FOREST }));
  canopyEdges.position.y = 0.78;
  group.add(trunk, trunkEdges, canopy, canopyEdges);
  return group;
}

/* grid cells spiralling out from the centre so the city grows outward */
function cellPosition(order: number): [number, number] {
  const cells: Array<[number, number]> = [];
  for (let radius = 0; radius <= 5; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      for (let z = -radius; z <= radius; z += 1) {
        if (Math.max(Math.abs(x), Math.abs(z)) === radius) cells.push([x, z]);
      }
    }
  }
  return cells[order % cells.length] ?? [0, 0];
}

export function structureBudget(points: number): { buildings: number; trees: number } {
  return {
    buildings: Math.min(5 + Math.floor(points / 10), 22),
    trees: Math.min(4 + Math.floor(points / 8), 26),
  };
}

/**
 * Ink-drawn living city: paper-filled, ink-outlined low-poly blocks that grow
 * with the verified point balance. Drag to rotate; idles on a slow turn.
 * Falls back to the static SVG skyline when WebGL is unavailable.
 */
export function CityCanvas({ points, fallback = "skyline" }: { points: number; fallback?: "skyline" | "empty" }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const pointsRef = useRef(points);
  const syncRef = useRef<((balance: number) => void) | null>(null);

  useEffect(() => {
    pointsRef.current = points;
    syncRef.current?.(points);
  }, [points]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || webglFailed) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setWebglFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    host.dataset.interactive = "true";
    host.dataset.hovered = "false";
    host.dataset.replaying = "false";

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
    camera.position.set(11, 8.6, 11);
    camera.lookAt(0, 0.7, 0);

    const city = new THREE.Group();
    const structuresLayer = new THREE.Group();
    scene.add(city);
    city.add(makeBlock(5.2, 0.18, 5.2, PAPER, INK));
    city.add(structuresLayer);

    const structures: Structure[] = [];
    let builtBuildings = 0;
    let builtTrees = 0;
    const reduceMotion = prefersReducedMotion();

    function centerStructureFootprint() {
      if (structures.length === 0) return;
      const bounds = new THREE.Box3();
      const itemBounds = new THREE.Box3();
      const center = new THREE.Vector3();
      structuresLayer.position.set(0, 0, 0);
      structuresLayer.updateMatrixWorld(true);
      for (const structure of structures) {
        const animatedScale = structure.mesh.scale.clone();
        structure.mesh.scale.setScalar(1);
        structure.mesh.updateMatrixWorld(true);
        itemBounds.setFromObject(structure.mesh, true);
        bounds.union(itemBounds);
        structure.mesh.scale.copy(animatedScale);
      }
      bounds.getCenter(center);
      structuresLayer.position.set(-center.x, 0, -center.z);
      structuresLayer.updateMatrixWorld(true);
    }

    function syncStructures(balance: number) {
      const budget = structureBudget(balance);
      const now = performance.now();
      while (builtBuildings < budget.buildings) {
        const index = builtBuildings;
        const [cx, cz] = cellPosition(index * 2);
        const height = 0.55 + seeded(index * 13) * 1.9 + Math.min(index * 0.05, 0.8);
        const width = 0.62 + seeded(index * 29) * 0.3;
        const landmark = index % 7 === 3;
        const block = makeBlock(width, height, width, PAPER, landmark ? TERRACOTTA : INK);
        block.position.set(cx * 0.92 + (seeded(index * 3) - 0.5) * 0.22, 0.09, cz * 0.92 + (seeded(index * 5) - 0.5) * 0.22);
        structuresLayer.add(block);
        structures.push({ mesh: block, bornAt: reduceMotion ? 0 : now + structures.length * 60 });
        if (reduceMotion) block.scale.setScalar(1);
        else block.scale.setScalar(0.001);
        builtBuildings += 1;
      }
      while (builtTrees < budget.trees) {
        const index = builtTrees;
        const [cx, cz] = cellPosition(index * 2 + 1);
        const tree = makeTree(index);
        tree.position.set(cx * 0.92 + (seeded(index * 11) - 0.5) * 0.34, 0.09, cz * 0.92 + (seeded(index * 17) - 0.5) * 0.34);
        structuresLayer.add(tree);
        structures.push({ mesh: tree, bornAt: reduceMotion ? 0 : now + structures.length * 60 });
        if (reduceMotion) tree.scale.setScalar(1);
        else tree.scale.setScalar(0.001);
        builtTrees += 1;
      }
      centerStructureFootprint();
      renderer.render(scene, camera);
    }
    syncRef.current = syncStructures;
    syncStructures(pointsRef.current);

    function resize() {
      if (!host) return;
      const { clientWidth, clientHeight } = host;
      if (clientWidth === 0 || clientHeight === 0) return;
      const aspect = clientWidth / clientHeight;
      const minimumSceneWidth = 6.8;
      const minimumSceneHeight = 5.7;
      const viewHeight = Math.max(minimumSceneHeight, minimumSceneWidth / aspect);
      const viewCenterY = 0.65;
      const viewWidth = viewHeight * aspect;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewCenterY + viewHeight / 2;
      camera.bottom = viewCenterY - viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      renderer.render(scene, camera);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let dragging = false;
    let hovering = false;
    let hoverBlend = 0;
    let lastX = 0;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerMoved = false;
    let replaying = false;
    let spin = 0;
    const replayGrowth = () => {
      if (reduceMotion || structures.length === 0) return;
      const now = performance.now();
      structures.forEach((structure, index) => {
        structure.mesh.scale.setScalar(0.001);
        structure.bornAt = now + index * 45;
      });
      replaying = true;
      host.dataset.replaying = "true";
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerMoved = false;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      lastX = event.clientX;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 6) pointerMoved = true;
      spin = (event.clientX - lastX) * 0.008;
      city.rotation.y += spin;
      lastX = event.clientX;
    };
    const onPointerUp = () => {
      if (dragging && !pointerMoved) replayGrowth();
      dragging = false;
    };
    const onPointerEnter = () => { hovering = true; host.dataset.hovered = "true"; };
    const onPointerLeave = () => { hovering = false; dragging = false; host.dataset.hovered = "false"; };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerenter", onPointerEnter);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    let running = true;
    let lastTime = performance.now();
    function frame(time: number) {
      if (!running) return;
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const hoverTarget = hovering && !reduceMotion ? 1 : 0;
      hoverBlend += (hoverTarget - hoverBlend) * Math.min(1, delta * 8);
      const hoverScale = 1 + hoverBlend * 0.045;
      city.scale.setScalar(hoverScale);
      city.position.y = hoverBlend * 0.06;
      if (!dragging) {
        spin *= 0.94;
        city.rotation.y += (reduceMotion ? 0 : delta * (0.14 + hoverBlend * 0.2)) + spin;
      }
      for (const structure of structures) {
        if (structure.bornAt === 0) continue;
        const progress = Math.min(Math.max((time - structure.bornAt) / 520, 0), 1);
        const overshoot = 1 + 2.2 * Math.pow(progress - 1, 3) + 1.2 * Math.pow(progress - 1, 2);
        structure.mesh.scale.setScalar(Math.max(progress === 1 ? 1 : overshoot, 0.001));
        if (progress === 1) structure.bornAt = 0;
      }
      if (replaying && structures.every((structure) => structure.bornAt === 0)) {
        replaying = false;
        if (host) host.dataset.replaying = "false";
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const setRunning = (shouldRun: boolean) => {
      if (shouldRun && !running) { running = true; lastTime = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!shouldRun && running) { running = false; cancelAnimationFrame(raf); }
    };
    const onVisibility = () => setRunning(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    const intersection = new IntersectionObserver(([entry]) => {
      setRunning(Boolean(entry?.isIntersecting) && document.visibilityState === "visible");
    });
    intersection.observe(host);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      syncRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      intersection.disconnect();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerenter", onPointerEnter);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      delete host.dataset.interactive;
      delete host.dataset.hovered;
      delete host.dataset.replaying;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const material = object.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [webglFailed]);

  if (webglFailed) return fallback === "skyline" ? <CitySkyline /> : <div className="city-motif city-unavailable" aria-hidden="true" />;
  return <div ref={hostRef} className="city-motif" aria-hidden="true" />;
}
