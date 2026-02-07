import React, { useState, useRef, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, useHelper, Line } from '@react-three/drei';
import * as THREE from 'three';
import * as Icons from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { compareDrawings, scanImageStructure, compareLineSets } from '../services/geminiService';

// --- Helper Functions for VP Calculation ---
const HORIZON_Z = -100; // Far distance for horizon line

// Calculate VP position on the horizon plane (Z = -100)
// This finds the world-space coordinate where a parallel line extending from the camera intersects the horizon plane.
const getVanishingPoint = (camera: THREE.Camera, rotation: number, axis: 'x' | 'z'): THREE.Vector3 | null => {
  const dir = new THREE.Vector3(axis === 'x' ? 1 : 0, 0, axis === 'z' ? 1 : 0);
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);

  // We want the direction that points 'into' the screen (away from camera Z)
  // Camera is at +Z, looking towards -Z.
  // So we want the component with negative Z.
  if (dir.z > 0) dir.negate();

  // If parallel to horizon plane (horizontal), VP is at infinity (no intersection)
  if (Math.abs(dir.z) < 0.001) return null;

  const t = (HORIZON_Z - camera.position.z) / dir.z;

  // Intersection point
  const x = camera.position.x + dir.x * t;
  const y = camera.position.y + dir.y * t;

  return new THREE.Vector3(x, y, HORIZON_Z);
};


interface CameraControllerProps {
  fov: number;
  preset: string;
  distance: number;
  height: number;
}

const CameraController = ({ fov, preset, distance, height }: CameraControllerProps) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.far = 10000; // Extend far plane to see the horizon
      camera.updateProjectionMatrix();
    }
  }, [fov, camera]);

  useEffect(() => {
    if (preset === 'free') {
      setIsLocked(false);
      // Reset to a reasonable free-look angle
      camera.position.set(10, 10, 10);
      camera.lookAt(0, 0, 0);
    } else {
      setIsLocked(true);
      // Fixed frontal view for 1pt/2pt (simulating "looking straight at horizon")
      // We raise slightly (y=2) to see the top face
      camera.position.set(0, height, distance);
      camera.lookAt(0, 0, 0);
      camera.rotation.set(0, 0, 0); // Force strictly forward-facing for 1pt/2pt alignment

      // Manual lookAt adjustment if needed, but atomic set is safer
      // Re-orient to ensure horizon is flat
      camera.lookAt(0, 0, 0);
    }
  }, [preset, distance, camera, height]);

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={!isLocked}
      enablePan={!isLocked}
      enableRotate={!isLocked}
      minDistance={5}
      maxDistance={40}
    />
  );
};

// --- Horizon Helper Component ---
const HorizonHelper = ({ camera }: { camera: THREE.Camera }) => {
  const lineRef = useRef<THREE.Line>(null);

  // Use a very wide line to simulate infinite horizon
  const points = useMemo(() => [
    new THREE.Vector3(-10000, 0, 0),
    new THREE.Vector3(10000, 0, 0)
  ], []);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame(() => {
    if (lineRef.current) {
      // The horizon line is always at the specific distance (HORIZON_Z)
      // and at the height of the camera (Eye Level).
      // We also center it on the camera's X so it spans the view.
      lineRef.current.position.set(camera.position.x, camera.position.y, HORIZON_Z);
    }
  });

  return (
    <line ref={lineRef as any}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="red" opacity={0.5} transparent />
    </line>
  );
};

interface VPHelpersProps {
  camera: THREE.Camera;
  rotation: number;
  cubePos: [number, number, number];
  preset: string;
}



const VPHelpers = ({ camera, rotation, cubePos, preset }: VPHelpersProps) => {
  const meshRef1 = useRef<THREE.Mesh>(null);
  const meshRef2 = useRef<THREE.Mesh>(null);
  const lineRef1 = useRef<THREE.LineSegments>(null);
  const lineRef2 = useRef<THREE.LineSegments>(null);
  const lineRef3 = useRef<THREE.LineSegments>(null);

  useFrame(() => {
    const vpX = getVanishingPoint(camera, rotation, 'x');
    const vpZ = getVanishingPoint(camera, rotation, 'z');

    // Calculate world corners
    const halfSize = 1.25;
    const corners = [];
    for (let x of [-1, 1]) {
      for (let y of [-1, 1]) {
        for (let z of [-1, 1]) {
          const v = new THREE.Vector3(x * halfSize, y * halfSize, z * halfSize);
          v.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
          v.add(new THREE.Vector3(...cubePos));
          corners.push(v);
        }
      }
    }
    // Logic: In 1pt, we see the front face (4 corners). We want lines from these 4 corners to VP.
    // That makes 4 lines.

    const updateLines = (vp: THREE.Vector3, lineRef: React.RefObject<THREE.LineSegments>, color: string) => {
      if (!lineRef.current) return;

      lineRef.current.visible = true;
      const positions = lineRef.current.geometry.attributes.position;

      // We want 4 lines. 
      // Which 4 corners? 
      // Let's picking the 4 "top/bottom left/right" relative to the view is hard.
      // Let's just draw from 4 specific corners. 
      // For VP-Z (Depth), we want lines extending from the front face (min-Z?)
      // But rotation makes "front" relative.
      // 
      // Improved visual: Draw from ALL 8 corners? User might find 8 lines cluttered.
      // But user specifically said "four vanishing point lines".
      // This likely refers to the 4 edges converging.
      // Let's try drawing all 8 for a moment, or better, calculate the 4 'outer' ones? Hard.
      // 
      // Let's try drawing from the 4 corners that are 'furthest' from VP? Or closest?
      // Let's just draw from the 4 corners of the +/- X/Y face.
      // 
      // Actually, for Z-VP, the 4 edges are formed by:
      // (-1,-1,z), (1,-1,z), (-1,1,z), (1,1,z)
      // We can just pick one end of each edge? 
      // Let's pick the end 'closest' to the camera?
      // Or just draw from both? No 8 lines.
      // 
      // Let's draw from the point `p` such that the vector `p -> VP` doesn't pass through the other point?
      // i.e. The point further from VP?
      // Actually, if we draw from the point FURTHEST from VP, the line goes through the cube (along the edge) to the VP.
      // This effectively highlights the edge AND the extension. This is usually desired.

      let idx = 0;

      // For Z-VP: Iterate the 4 X/Y combinations
      // (-hs, -hs), (hs, -hs), (-hs, hs), (hs, hs)

      const sets = [
        [-halfSize, -halfSize],
        [halfSize, -halfSize],
        [-halfSize, halfSize],
        [halfSize, halfSize]
      ];

      sets.forEach(([c1, c2]) => {
        // For Z-VP: c1=x, c2=y. Z varies.
        // We have two endpoints for this edge: at local Z = -hs and Z = hs.
        // We want to draw from *one* of them to the VP.
        // Actually, drawing from the one visually 'closest' to avoiding passing through the cube?
        // Or just draw from both? No 8 lines.
        // 
        // Let's draw from the point `p` such that the vector `p -> VP` doesn't pass through the other point?
        // i.e. The point further from VP?
        // Actually, if we draw from the point FURTHEST from VP, the line goes through the cube (along the edge) to the VP.
        // This effectively highlights the edge AND the extension. This is usually desired.

        let pFar = new THREE.Vector3(0, 0, 0);
        let pNear = new THREE.Vector3(0, 0, 0);
        let maxDist = -1;

        // Check both ends of the edge
        [-halfSize, halfSize].forEach(v3 => {
          let localPos = new THREE.Vector3(0, 0, 0);
          if (color === 'orange') { // Z-VP
            localPos.set(c1, c2, v3);
          } else { // X-VP (Cyan) -> c1=z, c2=y. X varies.
            localPos.set(v3, c2, c1);
          }

          localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
          localPos.add(new THREE.Vector3(...cubePos));

          const d = localPos.distanceTo(vp);
          if (d > maxDist) {
            maxDist = d;
            pFar.copy(localPos);
          }
        });

        positions.setXYZ(idx++, pFar.x, pFar.y, pFar.z);
        positions.setXYZ(idx++, vp.x, vp.y, vp.z);
      });

      positions.needsUpdate = true;
    };


    // --- Update VP 1 (Cyan / X-axis) ---
    // Only visible in 2pt
    if (meshRef1.current && lineRef1.current) {
      if ((preset === '2pt' || preset === '3pt') && vpX) {
        meshRef1.current.visible = true;
        meshRef1.current.position.copy(vpX);
        updateLines(vpX, lineRef1, 'cyan');
      } else {
        meshRef1.current.visible = false;
        lineRef1.current.visible = false;
      }
    }

    // --- Update VP 2 (Orange / Z-axis) ---
    // Visible in 1pt (Center) and 2pt (Right side usually)
    if (meshRef2.current && lineRef2.current) {
      if (vpZ) {
        meshRef2.current.visible = true;
        meshRef2.current.position.copy(vpZ);
        updateLines(vpZ, lineRef2, 'orange');
      } else {
        meshRef2.current.visible = false;
        lineRef2.current.visible = false;
      }
    }


    // --- Update VP 3 (Green / Y-axis) ---
    // Visible in 3pt (Vertical convergence)
    if (lineRef3.current) {
      if (preset === '3pt') {
        const dirY = camera.position.y >= 0 ? -1 : 1; // If looking down, converge down. If looking up, converge up.

        lineRef3.current.visible = true;
        const positions = lineRef3.current.geometry.attributes.position;
        let idx = 0;

        const halfSize = 1.25;
        // 4 Vertical edges: (+-hs, ?, +-hs)
        const corners = [
          [-halfSize, -halfSize], // x, z
          [halfSize, -halfSize],
          [-halfSize, halfSize],
          [halfSize, halfSize]
        ];

        corners.forEach(([x, z]) => {
          // Edge goes from y=-hs to y=hs.

          // Vertical Edge at (x, z)
          const pTop = new THREE.Vector3(x, halfSize, z);
          const pBottom = new THREE.Vector3(x, -halfSize, z);

          pTop.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation).add(new THREE.Vector3(...cubePos));
          pBottom.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation).add(new THREE.Vector3(...cubePos));

          // Extend
          const extension = 10000;

          if (dirY === -1) {
            // Converge Down
            positions.setXYZ(idx++, pTop.x, pTop.y, pTop.z); // Start at top
            positions.setXYZ(idx++, pTop.x, pTop.y - extension, pTop.z); // Go way down
          } else {
            // Converge Up
            positions.setXYZ(idx++, pBottom.x, pBottom.y, pBottom.z); // Start at bottom
            positions.setXYZ(idx++, pBottom.x, pBottom.y + extension, pBottom.z); // Go way up
          }
        });
        positions.needsUpdate = true;
      } else {
        lineRef3.current.visible = false;
      }
    }
  });

  return (
    <>
      <mesh ref={meshRef1}>
        <sphereGeometry args={[1]} />
        <meshBasicMaterial color="cyan" />
      </mesh>
      <lineSegments ref={lineRef1 as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={8}
            array={new Float32Array(24)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="cyan" opacity={0.5} transparent />
      </lineSegments>

      <mesh ref={meshRef2}>
        <sphereGeometry args={[1]} />
        <meshBasicMaterial color="orange" />
      </mesh>
      <lineSegments ref={lineRef2 as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={8}
            array={new Float32Array(24)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="orange" opacity={0.5} transparent />
      </lineSegments>

      <lineSegments ref={lineRef3 as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={8}
            array={new Float32Array(24)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#32CD32" opacity={0.5} transparent />
      </lineSegments>
    </>
  );
};

interface SceneContentProps {
  onCapture: (data: string, lines: string, analysis: string, meta?: any) => void;
  triggerCapture: boolean;
  showGuides: boolean;
  preset: string;
  cubePos: [number, number, number];
  cubeRotation: number;
  interactionMode: 'move' | 'rotate';
  onCubeMove: (pos: [number, number, number]) => void;
  onCubeRotate: (rad: number) => void;
}

const SceneContent = ({ onCapture, triggerCapture, showGuides, preset, cubePos, cubeRotation, interactionMode, onCubeMove, onCubeRotate }: SceneContentProps) => {
  const { gl, scene, camera } = useThree();
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startRotation = useRef(0);
  const dragOffset = useRef(new THREE.Vector3());
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  const edgeGeometry = useMemo(() => new THREE.BoxGeometry(2.5, 2.5, 2.5), []);
  const cubeMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const cubeMesh = useRef<THREE.Mesh>(null);

  // When capturing, we want a clean shot of the cube without guides
  const areHelpersVisible = !triggerCapture;

  useEffect(() => {
    if (triggerCapture) {
      const originalInfo = {
        background: scene.background,
        pixelRatio: gl.getPixelRatio()
      };

      // --- BOOST RESOLUTION FOR AI ---
      gl.setPixelRatio(3);
      gl.setSize(gl.domElement.clientWidth, gl.domElement.clientHeight, false);

      // --- 1. Solid Render (Reference) ---
      // Force white background for "paper" look
      scene.background = new THREE.Color('#ffffff');
      gl.render(scene, camera);

      // Helper for cropping
      const getCroppedImage = (minX: number, minY: number, width: number, height: number) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return null;
        // The source buffer is big now.
        // minX etc are in the new coordinate space (calculated below).
        ctx.drawImage(gl.domElement, minX, minY, width, height, 0, 0, width, height);
        return tempCanvas.toDataURL('image/png');
      };

      // Calculate Cube Bounding Box in Screen Space
      // gl.domElement.width is now the boosted width
      const width = gl.domElement.width;
      const height = gl.domElement.height;
      const halfSize = 1.25; // Half of cube size (2.5)

      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;

      const edgesX: [number, number, number, number][] = [];
      const edgesZ: [number, number, number, number][] = [];

      const projectVec = (v: THREE.Vector3) => {
        const vec = v.clone();
        vec.project(camera);
        const px = (vec.x + 1) / 2 * width;
        const py = -(vec.y - 1) / 2 * height;
        return [px, py];
      };

      // Define edges (start corner -> end corner)
      // Cube is +/- halfSize
      const hs = halfSize;

      // X-Edges (Parallel to X axis)
      const xSegments = [
        [new THREE.Vector3(-hs, -hs, -hs), new THREE.Vector3(hs, -hs, -hs)],
        [new THREE.Vector3(-hs, hs, -hs), new THREE.Vector3(hs, hs, -hs)],
        [new THREE.Vector3(-hs, -hs, hs), new THREE.Vector3(hs, -hs, hs)],
        [new THREE.Vector3(-hs, hs, hs), new THREE.Vector3(hs, hs, hs)],
      ];

      // Z-Edges (Parallel to Z axis)
      const zSegments = [
        [new THREE.Vector3(-hs, -hs, -hs), new THREE.Vector3(-hs, -hs, hs)],
        [new THREE.Vector3(hs, -hs, -hs), new THREE.Vector3(hs, -hs, hs)],
        [new THREE.Vector3(-hs, hs, -hs), new THREE.Vector3(-hs, hs, hs)],
        [new THREE.Vector3(hs, hs, -hs), new THREE.Vector3(hs, hs, hs)],
      ];

      const processEdges = (segments: THREE.Vector3[][], output: [number, number, number, number][]) => {
        segments.forEach(seg => {
          const start = seg[0].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cubeRotation).add(new THREE.Vector3(...cubePos));
          const end = seg[1].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cubeRotation).add(new THREE.Vector3(...cubePos));

          const [x1, y1] = projectVec(start);
          const [x2, y2] = projectVec(end);
          output.push([x1, y1, x2, y2]);

          // Update Bounds
          minX = Math.min(minX, x1, x2);
          maxX = Math.max(maxX, x1, x2);
          minY = Math.min(minY, y1, y2);
          maxY = Math.max(maxY, y1, y2);
        });
      };

      processEdges(xSegments, edgesX);
      processEdges(zSegments, edgesZ);

      // Also process vertical edges just for bounding box
      const ySegments = [
        [new THREE.Vector3(-hs, -hs, -hs), new THREE.Vector3(-hs, hs, -hs)],
        [new THREE.Vector3(hs, -hs, -hs), new THREE.Vector3(hs, hs, -hs)],
        [new THREE.Vector3(-hs, -hs, hs), new THREE.Vector3(-hs, hs, hs)],
        [new THREE.Vector3(hs, -hs, hs), new THREE.Vector3(hs, hs, hs)],
      ];
      ySegments.forEach(seg => {
        const start = seg[0].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cubeRotation).add(new THREE.Vector3(...cubePos));
        const end = seg[1].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cubeRotation).add(new THREE.Vector3(...cubePos));
        const [x1, y1] = projectVec(start);
        const [x2, y2] = projectVec(end);
        minX = Math.min(minX, x1, x2);
        maxX = Math.max(maxX, x1, x2);
        minY = Math.min(minY, y1, y2);
        maxY = Math.max(maxY, y1, y2);
      });

      // Add Padding
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const padding = Math.max(contentWidth, contentHeight) * 0.1; // 10% of object size

      minX = Math.max(0, Math.floor(minX - padding));
      minY = Math.max(0, Math.floor(minY - padding));
      maxX = Math.min(width, Math.ceil(maxX + padding));
      maxY = Math.min(height, Math.ceil(maxY + padding));

      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;

      const solidData = getCroppedImage(minX, minY, cropWidth, cropHeight);

      // --- 2. Analysis Render (Wireframe on White) ---
      // This gives the AI a clean blueprint
      scene.background = new THREE.Color('#ffffff');
      if (cubeMaterial.current) cubeMaterial.current.visible = false;

      gl.clear();
      gl.render(scene, camera);

      const analysisData = getCroppedImage(minX, minY, cropWidth, cropHeight);

      // --- 3. Wireframe Render (Overlay) ---
      // Transparent BG for UI
      scene.background = null;
      // Faces still hidden
      gl.clear();
      gl.render(scene, camera);

      const wireframeData = getCroppedImage(minX, minY, cropWidth, cropHeight);

      // Restore
      if (cubeMaterial.current) cubeMaterial.current.visible = true;
      scene.background = originalInfo.background;
      gl.setPixelRatio(originalInfo.pixelRatio); // Restore original DPR

      // --- Calculate VP Positions (Screen Space) ---
      const camZ = camera.position.z;

      // Helper function to project a point
      const projectPoint = (x: number, y: number, z: number) => {
        const vec = new THREE.Vector3(x, y, z);
        vec.project(camera);
        const px = (vec.x + 1) / 2 * width;
        const py = -(vec.y - 1) / 2 * height;
        // Adjust for crop
        return [px - minX, py - minY] as [number, number];
      };

      let vpLeftCoords: [number, number] | null = null;
      let vpRightCoords: [number, number] | null = null;
      // Horizon Y in screen space (project center of horizon)
      const horizonCenter = projectPoint(0, 0, HORIZON_Z);
      const horizonY = horizonCenter[1];

      if (preset === '1pt') {
        // 1pt: Center VP corresponds to Z axis
        const vp = getVanishingPoint(camera, cubeRotation, 'z');
        if (vp) vpLeftCoords = projectPoint(vp.x, vp.y, vp.z);
      } else if (preset === '2pt') {
        const vp1 = getVanishingPoint(camera, cubeRotation, 'x');
        const vp2 = getVanishingPoint(camera, cubeRotation, 'z');

        if (vp1) {
          const coords = projectPoint(vp1.x, vp1.y, vp1.z);
          // Assign to Left/Right based on screen X
          if (!vpLeftCoords || coords[0] < vpLeftCoords[0]) {
            vpRightCoords = vpLeftCoords; // Push existing to right if new is more left? Simplified below
            vpLeftCoords = coords;
          } else {
            vpRightCoords = coords;
          }
        }
        if (vp2) {
          const coords = projectPoint(vp2.x, vp2.y, vp2.z);
          if (!vpLeftCoords) {
            vpLeftCoords = coords;
          } else if (coords[0] < vpLeftCoords[0]) {
            vpRightCoords = vpLeftCoords;
            vpLeftCoords = coords;
          } else {
            vpRightCoords = coords;
          }
        }
      }

      const meta = {
        vpLeft: vpLeftCoords,
        vpRight: vpRightCoords,
        horizonY: horizonY,
        edgesX: edgesX.map(e => [e[0] - minX, e[1] - minY, e[2] - minX, e[3] - minY]),
        edgesZ: edgesZ.map(e => [e[0] - minX, e[1] - minY, e[2] - minX, e[3] - minY]),
        width: cropWidth,
        height: cropHeight
      };

      if (solidData && wireframeData && analysisData) {
        onCapture(solidData, wireframeData, analysisData, meta);
      }
    }
  }, [triggerCapture, gl, scene, camera, onCapture, cubePos, cubeRotation, preset]);

  // Handle Dragging
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (preset !== '1pt' && preset !== '2pt' && preset !== '3pt') return;
    e.stopPropagation();
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Calculate offset from current cube pos to intersection point on plane
    // Intersect plane z=0
    const pointOnPlane = new THREE.Vector3();
    e.ray.intersectPlane(dragPlane, pointOnPlane);
    dragOffset.current.copy(new THREE.Vector3(...cubePos)).sub(pointOnPlane);

    if (interactionMode === 'rotate') {
      startX.current = e.clientX;
      startRotation.current = cubeRotation;
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (preset !== '1pt' && preset !== '2pt' && preset !== '3pt') return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if ((preset !== '1pt' && preset !== '2pt' && preset !== '3pt') || !isDragging.current) return;
    e.stopPropagation();

    if (interactionMode === 'move') {
      // Project ray to plane at z=0 using mathematical plane, not object surface
      const pointOnPlane = new THREE.Vector3();
      e.ray.intersectPlane(dragPlane, pointOnPlane);
      if (pointOnPlane) {
        const newPos = pointOnPlane.add(dragOffset.current);
        onCubeMove([newPos.x, newPos.y, 0]);
      }
    } else {
      const deltaX = e.clientX - startX.current;
      const sensitivity = 0.005;
      onCubeRotate(startRotation.current + (deltaX * sensitivity));
    }
  };

  const totalRotation = cubeRotation;

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />

      <gridHelper
        args={[10000, 200, 0xdddddd, 0xeeeeee]}
        position={[0, -1.25, 0]}
        visible={areHelpersVisible && showGuides}
      />

      {(preset === '1pt' || preset === '2pt' || preset === '3pt') && areHelpersVisible && (
        // Horizon Line - Always visible
        <HorizonHelper camera={camera} />
      )}

      {/* Vanishing Point Metrics (Debug/Visual) */}
      {(preset === '1pt' || preset === '2pt' || preset === '3pt') && areHelpersVisible && showGuides && (
        <VPHelpers camera={camera} rotation={cubeRotation} cubePos={cubePos} preset={preset} />
      )}

      <mesh
        ref={cubeMesh}
        position={preset === 'free' ? [0, 0, 0] : cubePos}
        rotation={[0, totalRotation, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        {triggerCapture ? (
          <meshBasicMaterial ref={cubeMaterial as any} color="#ffffff" />
        ) : (
          <meshStandardMaterial ref={cubeMaterial as any} color="#ffffff" roughness={0.9} metalness={0.1} />
        )}
        {/* Manual Thick Lines using drei/Line */}
        <Line
          points={[
            [-1.25, -1.25, -1.25], [1.25, -1.25, -1.25],
            [1.25, -1.25, -1.25], [1.25, -1.25, 1.25],
            [1.25, -1.25, 1.25], [-1.25, -1.25, 1.25],
            [-1.25, -1.25, 1.25], [-1.25, -1.25, -1.25],
            [-1.25, 1.25, -1.25], [1.25, 1.25, -1.25],
            [1.25, 1.25, -1.25], [1.25, 1.25, 1.25],
            [1.25, 1.25, 1.25], [-1.25, 1.25, 1.25],
            [-1.25, 1.25, 1.25], [-1.25, 1.25, -1.25],
            [-1.25, -1.25, -1.25], [-1.25, 1.25, -1.25],
            [1.25, -1.25, -1.25], [1.25, 1.25, -1.25],
            [1.25, -1.25, 1.25], [1.25, 1.25, 1.25],
            [-1.25, -1.25, 1.25], [-1.25, 1.25, 1.25]
          ]}
          segments
          color="#1a1a1a"
          lineWidth={2}
        />
      </mesh>

      <mesh
        visible={false}
        position={[0, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial />
      </mesh>

      <Environment preset="city" />
    </>
  );
};

// --- Image Cropper Component ---
interface ImageCropperProps {
  imageSrc: string;
  targetAspectRatio: number; // width / height
  targetWidth?: number; // Exact output width
  targetHeight?: number; // Exact output height
  onConfirm: (croppedImage: string) => void;
  onCancel: () => void;
}

const ScanningOverlay = ({ edgesX, edgesZ }: { edgesX: number[][], edgesZ: number[][] }) => {
  const [visibleCount, setVisibleCount] = useState(0);

  // Flatten all edges
  const allEdges = useMemo(() => {
    return [
      ...edgesX.map(e => ({ ...e, color: 'cyan' })),
      ...edgesZ.map(e => ({ ...e, color: 'orange' }))
    ];
  }, [edgesX, edgesZ]);

  useEffect(() => {
    // Reset
    setVisibleCount(0);
    const interval = setInterval(() => {
      setVisibleCount(prev => {
        // Loop: If we reach end, pause briefly then restart
        if (prev >= allEdges.length + 20) return 0; // +20 ticks pause
        return prev + 1;
      });
    }, 50); // Speed of edge appearance
    return () => clearInterval(interval);
  }, [allEdges]);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      {allEdges.slice(0, visibleCount).filter((_, i) => i < allEdges.length).map((edge, i) => (
        <line
          key={i}
          x1={edge[0]} y1={edge[1]}
          x2={edge[2]} y2={edge[3]}
          stroke={edge.color}
          strokeWidth="4"
          strokeLinecap="round"
          className="animate-pulse"
        />
      ))}
    </svg>
  );
};

// Generic "Laser" scan for User Drawing
const LaserScanOverlay = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded">
      <div className="w-full h-full bg-gradient-to-b from-transparent via-sketch-blue/20 to-transparent"
        style={{
          animation: 'scan 2s linear infinite',
          backgroundSize: '100% 200%',
        }}>
      </div>
      <div className="absolute left-0 right-0 h-1 bg-sketch-blue/50 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
        style={{ animation: 'scan-line 2s linear infinite' }}>
      </div>
      <style>{`
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
                @keyframes scan-line {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}</style>
    </div>
  );
};

const ImageCropper = ({ imageSrc, targetAspectRatio, targetWidth, targetHeight, onConfirm, onCancel }: ImageCropperProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [imageSrc]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleConfirm = () => {
    if (!imgRef.current || !containerRef.current) return;

    const canvas = document.createElement('canvas');
    // We want reasonably high resolution
    let outputWidth = 1000;
    let outputHeight = 1000 / targetAspectRatio;

    // If exact target dimensions provided, use them
    if (targetWidth && targetHeight) {
      outputWidth = targetWidth;
      outputHeight = targetHeight;
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The container is the "viewport". 
    // We need to map the visible portion of the image in the viewport to the canvas.
    // The image has transform: translate(position.x, position.y) scale(scale).
    // Viewport size:
    const viewportRect = containerRef.current.getBoundingClientRect();

    // Calculate image render rect relative to viewport
    // Center is (viewport.w/2, viewport.h/2).
    // Initial image position is centered.
    // But our simple drag implementation uses translate relative to top-left?
    // Let's refine the CSS/Logic mapping.
    // CSS: Image is absolute, centered?
    // Let's rely on the DOM rects.

    const imgRect = imgRef.current.getBoundingClientRect();

    // Scale factor between Viewport pixel size and Output Canvas size
    const DOMtoCanvasScale = outputWidth / viewportRect.width;

    // Source (Image) coordinates:
    // We want the part of the image overlapping with viewportRect.
    // Intersection of imgRect and viewportRect.

    // Actually, easier way: 
    // Draw the image onto the canvas using the same transforms?
    // Canvas (0,0) corresponds to Viewport (0,0).

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate position relative to viewport
    const x = (imgRect.left - viewportRect.left) * DOMtoCanvasScale;
    const y = (imgRect.top - viewportRect.top) * DOMtoCanvasScale;
    const w = imgRect.width * DOMtoCanvasScale;
    const h = imgRect.height * DOMtoCanvasScale;

    ctx.drawImage(imgRef.current, x, y, w, h);

    onConfirm(canvas.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-sm p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-hand font-bold text-lg text-pencil">Crop User Photo</h3>
        <p className="text-xs text-pencil/60">Drag & Zoom to fit the cube inside the box.</p>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-gray-300 overflow-hidden border-2 border-pencil rounded shadow-inner select-none">

        {/* Viewport Mask / Reference Frame */}
        {/* We fix the viewport to the target Aspect Ratio using CSS aspect-ratio */}
        <div
          ref={containerRef}
          className="relative bg-white overflow-hidden shadow-2xl border-4 border-sketch-blue border-dashed"
          style={{
            aspectRatio: `${targetAspectRatio}`,
            width: targetAspectRatio >= 1 ? '80%' : 'auto',
            height: targetAspectRatio < 1 ? '80%' : 'auto',
            maxHeight: '400px',
            maxWidth: '100%'
          }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="crop target"
            draggable={false}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center',
              cursor: isDragging ? 'grabbing' : 'grab',
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              userSelect: 'none',
              touchAction: 'none'
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Icons.ZoomOut size={20} className="text-pencil" />
        <input
          type="range"
          min="0.5" max="3" step="0.1"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="flex-1 accent-sketch-blue"
        />
        <Icons.ZoomIn size={20} className="text-pencil" />
      </div>

      <div className="mt-4 flex gap-4">
        <button onClick={onCancel} className="flex-1 btn-secondary">
          Cancel
        </button>
        <button onClick={handleConfirm} className="flex-1 btn-primary">
          Confirm Crop
        </button>
      </div>
    </div>
  );
};

type Step = 'pose' | 'draw' | 'crop' | 'result';

const CritiqueZone: React.FC = () => {
  const [step, setStep] = useState<Step>('pose');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceLines, setReferenceLines] = useState<string | null>(null);
  const [referenceAnalysis, setReferenceAnalysis] = useState<string | null>(null);
  const [userDrawing, setUserDrawing] = useState<string | null>(null);
  const [tempUploadedImage, setTempUploadedImage] = useState<string | null>(null);
  const [triggerCapture, setTriggerCapture] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [lineSets, setLineSets] = useState<{
    leftSet: { start: [number, number], end: [number, number] }[],
    rightSet: { start: [number, number], end: [number, number] }[],
    verticalSet: { start: [number, number], end: [number, number] }[],
    refLeftSet: { start: [number, number], end: [number, number] }[],
    refRightSet: { start: [number, number], end: [number, number] }[],
    refVerticalSet: { start: [number, number], end: [number, number] }[]
  }>({ leftSet: [], rightSet: [], verticalSet: [], refLeftSet: [], refRightSet: [], refVerticalSet: [] });
  const [grade, setGrade] = useState<string | null>(null);

  const [captureMeta, setCaptureMeta] = useState<{
    vpLeft: [number, number] | null,
    vpRight: [number, number] | null,
    horizonY: number | null,
    edgesX?: [number, number, number, number][],
    edgesZ?: [number, number, number, number][],
    width?: number,
    height?: number
  }>({ vpLeft: null, vpRight: null, horizonY: null });

  const [showAIVision, setShowAIVision] = useState(true);
  const [showRefVision, setShowRefVision] = useState(true);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState('Analyzing perspective geometry...');



  const [fov, setFov] = useState(55);
  const [cubeDepth, setCubeDepth] = useState(0);
  const [cameraHeight, setCameraHeight] = useState(0);

  const [preset, setPreset] = useState('1pt');
  const [showGuides, setShowGuides] = useState(true);
  const [cubePos, setCubePos] = useState<[number, number, number]>([0, 0, 0]);
  const [cubeRotation, setCubeRotation] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'move' | 'rotate'>('move');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (data: string, lines: string, analysis: string, meta?: any) => {
    setReferenceImage(data);
    setReferenceLines(lines);
    setReferenceAnalysis(analysis);
    if (meta) setCaptureMeta(meta);
    setTriggerCapture(false);
    setStep('draw');
  };

  const triggerSceneCapture = () => {
    setTriggerCapture(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        // setUserDrawing(ev.target?.result as string); // OLD
        setTempUploadedImage(ev.target?.result as string);
        setStep('crop'); // Go to crop step
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = (croppedImage: string) => {
    setUserDrawing(croppedImage);
    setTempUploadedImage(null);
    runComparison(croppedImage); // Pass image directly to ensure state is ready? Or use useEffect.
    // Actually, setting state is async. Better to trigger comparison via effect or pass data.
    // The existing runComparison uses state `userDrawing`.
    // Let's modify runComparison to accept optional arg.
  };

  const runComparison = async (overrideUserDrawing?: string) => {
    const drawingToUse = overrideUserDrawing || userDrawing;
    if (!referenceImage || !drawingToUse) return;
    setIsAnalyzing(true);
    // userDrawing state might not be updated yet if called from crop confirm
    // so we assume drawingToUse is valid
    if (drawingToUse !== userDrawing) setUserDrawing(drawingToUse);

    setStep('result');
    try {
      if (!referenceAnalysis) return;

      // STEP 1: Scan Reference
      setLoadingMessage("Step 1/3: Scanning Reference Model...");
      // Use referenceImage (Solid) instead of referenceAnalysis (Wireframe) to ensure we only compare visible edges
      const refResult = await scanImageStructure(referenceImage, "Reference Model");
      setLineSets(prev => ({
        ...prev,
        refLeftSet: refResult.leftSet || [],
        refRightSet: refResult.rightSet || [],
        refVerticalSet: refResult.verticalSet || []
      }));

      // STEP 2: Scan User Drawing
      setLoadingMessage("Step 2/3: Scanning Your Drawing...");
      const userResult = await scanImageStructure(drawingToUse, "User Drawing");
      setLineSets(prev => ({
        ...prev,
        leftSet: userResult.leftSet || [],
        rightSet: userResult.rightSet || [],
        verticalSet: userResult.verticalSet || []
      }));

      // STEP 3: Compare
      setLoadingMessage("Step 3/3: Comparing Geometry...");
      const finalResult = await compareLineSets(refResult, userResult, `Perspective Mode: ${preset}`);

      console.log("AI Analysis Result:", finalResult); // DEBUG Log

      setAnalysis(finalResult.feedback);
      setGrade(finalResult.grade);

      // Ensure local state matches final result if needed, but we populated it progressively above.

    } catch (error) {
      setAnalysis("Error analyzing images. Please try again.");
      setLineSets({ leftSet: [], rightSet: [], verticalSet: [], refLeftSet: [], refRightSet: [], refVerticalSet: [] });
      setGrade(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetFlow = () => {
    setStep('pose');
    setReferenceImage(null);
    setReferenceLines(null);
    setReferenceAnalysis(null);
    setUserDrawing(null);
    setAnalysis(null);
    setGrade(null);
    setLineSets({ leftSet: [], rightSet: [], verticalSet: [], refLeftSet: [], refRightSet: [], refVerticalSet: [] });
    setCaptureMeta({ vpLeft: null, vpRight: null, horizonY: null });
    setIsAnalyzing(false);
  };

  const handlePresetChange = (newPreset: string) => {
    setPreset(newPreset);
    setCubePos([0, 0, 0]);
    setCubeRotation((newPreset === '2pt' || newPreset === '3pt') ? Math.PI / 4 : 0);
    setInteractionMode('move');
    if (newPreset === '1pt' || newPreset === '2pt' || newPreset === '3pt') {
      setShowGuides(true);
    } else {
      setShowGuides(false);
    }

    // Reset height for 1pt/2pt (Strict horizontal view)
    if (newPreset === '1pt' || newPreset === '2pt') {
      setCameraHeight(0);
    } else if (newPreset === '3pt') {
      setCameraHeight(5);
    }
  };

  const resetAngle = () => {
    setCubePos([0, 0, 0]);
    setCubeRotation((preset === '2pt' || preset === '3pt') ? Math.PI / 4 : 0);
    if (preset === '3pt') {
      setCameraHeight(5);
    } else if (preset === '1pt' || preset === '2pt') {
      setCameraHeight(0);
    }
  };

  if (step === 'pose') {
    return (
      <div className="h-full flex flex-col bg-paper relative">
        <div className="flex-1 w-full relative">
          <Canvas gl={{ preserveDrawingBuffer: true }}>
            <Suspense fallback={null}>
              <CameraController fov={fov} preset={preset} distance={15} height={cameraHeight} />
              <SceneContent
                onCapture={handleCapture}
                triggerCapture={triggerCapture}
                showGuides={showGuides}
                preset={preset}
                cubePos={[cubePos[0], cubePos[1], cubePos[2] - cubeDepth]}
                cubeRotation={cubeRotation}
                interactionMode={interactionMode}
                onCubeMove={setCubePos}
                onCubeRotate={setCubeRotation}
              />
            </Suspense>
          </Canvas>

          <div className="absolute top-4 left-4 right-4 flex flex-col items-center pointer-events-none gap-4">
            <div className="bg-paper/90 backdrop-blur shadow-sketch rounded-lg p-2 flex gap-2 pointer-events-auto border-2 border-pencil">
              {['1pt', '2pt', '3pt', 'free'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handlePresetChange(mode)}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold uppercase tracking-wider transition-all border-2 border-transparent ${preset === mode
                    ? 'bg-sketch-orange text-pencil border-pencil shadow-sm transform -rotate-1'
                    : 'text-pencil hover:bg-sketch-yellow hover:border-pencil hover:-rotate-1'
                    }`}
                >
                  {mode === 'free' ? 'Free' : mode.replace('pt', '-Point')}
                </button>
              ))}
            </div>

            <div className="bg-paper/90 backdrop-blur shadow-sketch rounded-lg px-4 py-2 flex items-center gap-4 pointer-events-auto flex-wrap justify-center border-2 border-pencil mt-2">
              {(preset === '1pt' || preset === '2pt' || preset === '3pt') && (
                <>
                  <div className="flex items-center gap-1 pr-4 border-r-2 border-pencil">
                    <button
                      onClick={resetAngle}
                      className="p-1.5 rounded hover:bg-sketch-yellow border-2 border-transparent hover:border-pencil transition-all text-pencil transform active:scale-95"
                      title="Reset View"
                    >
                      <Icons.RotateCcw />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 pr-4 border-r-2 border-pencil">
                    <button
                      onClick={() => setInteractionMode('move')}
                      className={`p-1.5 rounded border-2 transition-all ${interactionMode === 'move' ? 'bg-sketch-blue border-pencil shadow-sm' : 'border-transparent hover:border-pencil hover:bg-sketch-yellow'}`}
                      title="Move Mode"
                    >
                      <Icons.Move />
                    </button>
                    {(preset === '2pt' || preset === '3pt') && (
                      <button
                        onClick={() => setInteractionMode('rotate')}
                        className={`p-1.5 rounded border-2 transition-all ${interactionMode === 'rotate' ? 'bg-sketch-blue border-pencil shadow-sm' : 'border-transparent hover:border-pencil hover:bg-sketch-yellow'}`}
                        title="Rotate Mode"
                      >
                        <Icons.RefreshCw />
                      </button>
                    )}
                  </div>
                </>
              )}

              {preset === 'free' && (
                <div className="pr-4 border-r-2 border-pencil">
                  <span className="text-sm font-bold text-pencil font-hand">Orbit Camera</span>
                </div>
              )}

              <div className="flex items-center gap-2 pr-4 border-r-2 border-pencil">
                <span className="text-sm font-bold text-pencil font-hand">Depth</span>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  value={cubeDepth}
                  onChange={(e) => setCubeDepth(Number(e.target.value))}
                  className="w-16 h-2 bg-pencil rounded-lg appearance-none cursor-pointer accent-sketch-orange"
                />
              </div>

              <div className="flex items-center gap-2 pr-4 border-r-2 border-pencil">
                <span className="text-sm font-bold text-pencil font-hand">Lens</span>
                <input
                  type="range"
                  min="15"
                  max="100"
                  value={fov}
                  onChange={(e) => setFov(Number(e.target.value))}
                  className="w-16 h-2 bg-pencil rounded-lg appearance-none cursor-pointer accent-sketch-orange"
                />
              </div>

              {preset === '3pt' && (
                <div className="flex items-center gap-2 pr-4 border-r-2 border-pencil">
                  <span className="text-sm font-bold text-pencil font-hand">Height</span>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="1"
                    value={cameraHeight}
                    onChange={(e) => setCameraHeight(Number(e.target.value))}
                    className="w-16 h-2 bg-pencil rounded-lg appearance-none cursor-pointer accent-sketch-orange"
                  />
                </div>
              )}

              {(preset === '1pt' || preset === '2pt' || preset === '3pt') && (
                <div className="pl-2">
                  <button
                    onClick={() => setShowGuides(!showGuides)}
                    className={`text-sm font-bold font-hand px-3 py-1 rounded-md border-2 transition-all ${showGuides
                      ? 'bg-sketch-red text-pencil border-pencil shadow-sm'
                      : 'bg-paper text-pencil border-dashed border-pencil hover:bg-sketch-yellow'
                      }`}
                  >
                    {showGuides ? 'Hide Guides' : 'Show Guides'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-24 w-full text-center pointer-events-none">
            <span className="bg-pencil text-paper px-4 py-2 transform -rotate-2 inline-block shadow-sketch rounded-sm text-sm font-hand">
              {preset === 'free'
                ? 'Drag to orbit • Pinch to zoom'
                : interactionMode === 'move'
                  ? 'Drag cube to move'
                  : 'Drag horizontally to rotate cube'
              }
            </span>
          </div>
        </div>

        <div className="p-6 bg-paper border-t-2 border-pencil z-10 flex justify-center">
          <button
            onClick={triggerSceneCapture}
            className="w-full max-w-md bg-sketch-blue text-pencil py-4 rounded-xl font-bold text-xl shadow-sketch hover:shadow-sketch-hover hover:-translate-y-1 transition-all flex items-center justify-center gap-2 border-2 border-pencil"
          >
            <Icons.Camera />
            Capture & Draw
          </button>
        </div>
      </div>
    );
  }

  if (step === 'draw') {
    return (
      <div className="h-full flex flex-col bg-paper p-4 md:p-6 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="flex justify-between items-center border-b-2 border-pencil pb-4 border-dashed">
            <h2 className="text-3xl font-heading text-pencil transform -rotate-1">Your Reference</h2>
            <button onClick={resetFlow} className="text-sm font-bold font-hand text-pencil hover:text-sketch-red underline">Cancel</button>
          </div>
          <div className="bg-white p-2 rounded-sm shadow-sketch border-2 border-pencil">
            <div className="bg-white border-2 border-pencil/10">
              <img src={referenceImage!} alt="Reference" className="w-full aspect-[4/3] object-contain" />
            </div>
          </div>
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-4 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden h-48 ${userDrawing ? 'border-sketch-blue bg-sketch-blue/10' : 'border-pencil/30 hover:border-pencil hover:bg-sketch-yellow/20'}`}
            >
              {userDrawing ? (
                <img src={userDrawing} className="absolute inset-0 w-full h-full object-contain p-2" alt="upload" />
              ) : (
                <>
                  <div className="text-pencil mb-2"><Icons.Upload /></div>
                  <p className="text-pencil font-hand text-xl">Tap to paste your sketch</p>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <button onClick={() => runComparison()} disabled={!userDrawing} className="w-full bg-sketch-orange text-pencil py-4 rounded-xl font-bold text-2xl font-heading transform hover:-rotate-1 shadow-sketch hover:shadow-sketch-hover hover:-translate-y-1 border-2 border-pencil disabled:opacity-50 disabled:shadow-none transition-all">Check Accuracy</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'crop' && tempUploadedImage) {
    console.log('Capture Meta for Crop:', captureMeta);
    return (
      <div className="h-full flex flex-col bg-paper p-4 md:p-6 overflow-hidden">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col space-y-4">
          <div className="flex justify-between items-center border-b-2 border-pencil pb-4 border-dashed shrink-0">
            <h2 className="text-3xl font-heading text-pencil transform -rotate-1">Crop Your Drawing</h2>
            <button
              onClick={() => {
                setTempUploadedImage(null);
                setStep('draw');
              }}
              className="text-sm font-bold font-hand text-pencil hover:text-sketch-red underline"
            >
              Cancel
            </button>
          </div>




          <div className="flex-1 min-h-0 flex gap-4">
            {/* Reference Image Column */}
            <div className="w-1/3 bg-white p-2 rounded-sm shadow-sketch border-2 border-pencil overflow-hidden flex flex-col">
              <h3 className="font-hand font-bold text-center mb-2 text-pencil">Model Reference</h3>
              <div className="flex-1 relative bg-gray-50 border border-pencil/20 rounded">
                <img
                  src={referenceImage!}
                  alt="Model Reference"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
              <p className="text-xs text-center mt-2 text-pencil/60 font-hand">Match this shape</p>
            </div>

            {/* Cropper Column */}
            <div className="flex-1 bg-white p-2 rounded-sm shadow-sketch border-2 border-pencil relative">
              <ImageCropper
                imageSrc={tempUploadedImage}
                targetAspectRatio={(captureMeta.width && captureMeta.height) ? (captureMeta.width / captureMeta.height) : 1}
                targetWidth={captureMeta.width}
                targetHeight={captureMeta.height}
                onConfirm={handleCropConfirm}
                onCancel={() => {
                  setTempUploadedImage(null);
                  setStep('draw');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full bg-paper p-4 md:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="flex justify-between items-center border-b-2 border-pencil pb-4 border-dashed">
          <h2 className="text-3xl font-heading text-pencil">Accuracy Report</h2>
          <button onClick={resetFlow} className="text-sketch-blue font-bold font-hand text-lg hover:underline">New Practice</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-2 rounded-sm border-2 border-pencil shadow-sketch">
            <p className="text-xs font-bold font-hand text-pencil mb-1 uppercase tracking-wide text-center">Model</p>
            <div className="relative w-full" style={{ aspectRatio: (captureMeta.width && captureMeta.height) ? `${captureMeta.width}/${captureMeta.height}` : 'auto' }}>
              <img src={referenceImage!} className="w-full h-full object-contain" alt="ref" />
              {isAnalyzing && (
                <LaserScanOverlay />
              )}
              {/* AI Reference Vision Layer (Detected Model Lines) */}
              {showRefVision && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                  {/* Left Set (Purple) */}
                  {lineSets.refLeftSet && lineSets.refLeftSet.map((line, i) => (
                    <line
                      key={`rl-${i}`}
                      x1={line.start[0]} y1={line.start[1]}
                      x2={line.end[0]} y2={line.end[1]}
                      stroke="#A020F0" strokeWidth="4" opacity="0.8" strokeLinecap="round" strokeDasharray="8,4"
                    />
                  ))}
                  {/* Right Set (Gold) */}
                  {lineSets.refRightSet && lineSets.refRightSet.map((line, i) => (
                    <line
                      key={`rr-${i}`}
                      x1={line.start[0]} y1={line.start[1]}
                      x2={line.end[0]} y2={line.end[1]}
                      stroke="#FFD700" strokeWidth="4" opacity="0.8" strokeLinecap="round" strokeDasharray="8,4"
                    />
                  ))}
                  {/* Vertical Set (Pink) */}
                  {lineSets.refVerticalSet && lineSets.refVerticalSet.map((line, i) => (
                    <line
                      key={`rv-${i}`}
                      x1={line.start[0]} y1={line.start[1]}
                      x2={line.end[0]} y2={line.end[1]}
                      stroke="#FF1493" strokeWidth="4" opacity="0.8" strokeLinecap="round" strokeDasharray="8,4"
                    />
                  ))}
                </svg>
              )}
            </div>
            {/* Ref Vision Toggle - Centered Below Image */}
            <div className="flex justify-center mt-2">
              <div className="text-xs font-hand text-pencil bg-paper/50 backdrop-blur p-1 rounded-full border border-pencil/50 w-fit px-3 shadow-sm hover:bg-paper transition-all">
                <label className="flex items-center gap-1 cursor-pointer hover:text-sketch-blue transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={showRefVision}
                    onChange={(e) => setShowRefVision(e.target.checked)}
                    className="accent-sketch-blue cursor-pointer w-3 h-3"
                  />
                  <span>AI Ref Vision</span>
                </label>
              </div>
            </div>
          </div>
          <div className="bg-white p-2 rounded-sm border-2 border-pencil shadow-sketch relative group">

            <div className="hidden">
              <div className="flex justify-center text-xs font-hand text-pencil bg-paper/80 backdrop-blur p-1 rounded-full border border-pencil mx-auto w-fit px-4 shadow-sm">
                <label className="flex items-center gap-1 cursor-pointer hover:text-sketch-orange transition-colors">
                  <input
                    type="checkbox"
                    checked={showAIVision}
                    onChange={(e) => setShowAIVision(e.target.checked)}
                    className="accent-sketch-orange cursor-pointer"
                  />
                  <span>AI Vision (Detected)</span>
                </label>

              </div>
              <div className="flex justify-center text-xs font-hand text-pencil bg-paper/80 backdrop-blur p-1 rounded-full border border-pencil mx-auto w-fit px-4 shadow-sm">
                <label className="flex items-center gap-1 cursor-pointer hover:text-sketch-blue transition-colors">
                  <input
                    type="checkbox"
                    checked={showRefVision}
                    onChange={(e) => setShowRefVision(e.target.checked)}
                    className="accent-sketch-blue cursor-pointer"
                  />
                  <span>AI Ref (Model)</span>
                </label>
              </div>
            </div>

            <p className="text-xs font-bold font-hand text-pencil mb-1 uppercase tracking-wide text-center">Your Drawing</p>
            <div className="relative w-full" style={{ aspectRatio: (captureMeta.width && captureMeta.height) ? `${captureMeta.width}/${captureMeta.height}` : 'auto' }}>
              <img src={userDrawing!} className="w-full h-full object-contain" alt="user" />

              {/* Scanning Effect while analyzing */}
              {isAnalyzing && <LaserScanOverlay />}

              {/* AI Vision Layer (Detected Lines) */}
              {showAIVision && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                  {/* Left Set (Cyan) */}
                  {lineSets.leftSet && lineSets.leftSet.map((line, i) => (
                    <line
                      key={`l-${i}`}
                      x1={line.start[0]} y1={line.start[1]}
                      x2={line.end[0]} y2={line.end[1]}
                      stroke="cyan" strokeWidth="4" opacity="0.8" strokeLinecap="round"
                    />
                  ))}
                  {/* Right Set (Orange) */}
                  {lineSets.rightSet && lineSets.rightSet.map((line, i) => (
                    <line
                      key={`r-${i}`}
                      x1={line.start[0]} y1={line.start[1]}
                      x2={line.end[0]} y2={line.end[1]}
                      stroke="orange" strokeWidth="4" opacity="0.8" strokeLinecap="round"
                    />
                  ))}
                  {/* Vertical Set (Green) */}
                  {lineSets.verticalSet && lineSets.verticalSet.map((line, i) => (
                    <line
                      key={`v-${i}`}
                      x1={line.start[0]} y1={line.start[1]}
                      x2={line.end[0]} y2={line.end[1]}
                      stroke="#32CD32" strokeWidth="4" opacity="0.8" strokeLinecap="round"
                    />
                  ))}
                </svg>
              )}


            </div>
            {/* AI Vision Toggle - Centered Below Image */}
            <div className="flex justify-center mt-2">
              <div className="text-xs font-hand text-pencil bg-paper/50 backdrop-blur p-1 rounded-full border border-pencil/50 w-fit px-3 shadow-sm hover:bg-paper transition-all">
                <label className="flex items-center gap-1 cursor-pointer hover:text-sketch-orange transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={showAIVision}
                    onChange={(e) => setShowAIVision(e.target.checked)}
                    className="accent-sketch-orange cursor-pointer w-3 h-3"
                  />
                  <span>AI Vision</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-paper rounded-sm shadow-sketch border-2 border-pencil p-6 min-h-[300px] relative">
          <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-sketch-yellow border-2 border-pencil z-0"></div>
          <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-sketch-blue border-2 border-pencil z-0"></div>

          <div className="relative z-10">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-48 gap-4 text-pencil">
                <div className="animate-spin text-sketch-orange"><Icons.Loader /></div>
                <p className="font-hand text-xl animate-pulse text-center">
                  {loadingMessage}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {grade && (
                  <div className="flex justify-center">
                    <div className={`
                      w-16 h-16 rounded-full flex items-center justify-center border-4 border-pencil shadow-sketch transform -rotate-3
                      ${grade === 'A' ? 'bg-green-400 text-white' : ''}
                      ${grade === 'B' ? 'bg-blue-400 text-white' : ''}
                      ${grade === 'C' ? 'bg-yellow-400 text-white' : ''}
                      ${grade === 'D' ? 'bg-orange-400 text-white' : ''}
                      ${grade === 'F' ? 'bg-red-500 text-white' : ''}
                    `}>
                      <span className="font-heading text-4xl">{grade}</span>
                    </div>
                  </div>
                )}
                <MarkdownRenderer content={analysis || "No analysis available."} className="font-hand text-lg" />

                {/* Technical Details Section */}
                <details className="mt-4 border-t-2 border-pencil/20 pt-2">
                  <summary className="cursor-pointer font-bold font-hand text-pencil/60 hover:text-pencil flex items-center gap-2">
                    <Icons.Info size={16} /> Technical Analysis Data
                  </summary>
                  <div className="mt-2 text-xs font-mono bg-black/5 p-2 rounded text-pencil/80 overflow-x-auto">
                    <p><strong>Mode:</strong> {preset}</p>
                    <p><strong>Camera:</strong> Depth: {cubeDepth}, Lens: {fov}</p>
                    <div className="my-1 border-b border-pencil/10"></div>
                    <p><strong>Ground Truth Geometry:</strong></p>
                    <ul className="list-disc pl-4">
                      <li>X-Edges (Horizontal/Left): {captureMeta.edgesX?.length || 0}</li>
                      <li>Z-Edges (Depth/Right): {captureMeta.edgesZ?.length || 0}</li>
                      <li>VP Left: {captureMeta.vpLeft ? `[${Math.round(captureMeta.vpLeft[0])}, ${Math.round(captureMeta.vpLeft[1])}]` : 'N/A'}</li>
                      <li>VP Right: {captureMeta.vpRight ? `[${Math.round(captureMeta.vpRight[0])}, ${Math.round(captureMeta.vpRight[1])}]` : 'N/A'}</li>
                    </ul>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default CritiqueZone;