import React, { useState, useRef, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import * as Icons from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { compareDrawings } from '../services/geminiService';
import { recordCritique, getDifficulty, DIFFICULTY_CONFIG } from '../services/storageService';
import { savePhoto } from '../services/photoStorage';
import Camera from './Camera';

// --- Helper Functions for VP Calculation ---
const HORIZON_Z = -100;

const getVanishingPoint = (camera: THREE.Camera, rotation: number, axis: 'x' | 'z'): THREE.Vector3 | null => {
  const dir = new THREE.Vector3(axis === 'x' ? 1 : 0, 0, axis === 'z' ? 1 : 0);
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
  if (dir.z > 0) dir.negate();
  if (Math.abs(dir.z) < 0.001) return null;
  const t = (HORIZON_Z - camera.position.z) / dir.z;
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
      camera.far = 10000;
      camera.updateProjectionMatrix();
    }
  }, [fov, camera]);

  useEffect(() => {
    if (preset === 'free') {
      setIsLocked(false);
      camera.position.set(10, 10, 10);
      camera.lookAt(0, 0, 0);
    } else {
      setIsLocked(true);
      camera.position.set(0, height, distance);
      camera.lookAt(0, 0, 0);
      camera.rotation.set(0, 0, 0);
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

const HorizonHelper = ({ camera }: { camera: THREE.Camera }) => {
  const lineRef = useRef<THREE.Line>(null);
  const points = useMemo(() => [
    new THREE.Vector3(-10000, 0, 0),
    new THREE.Vector3(10000, 0, 0)
  ], []);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame(() => {
    if (lineRef.current) {
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

  useFrame(() => {
    const vpX = getVanishingPoint(camera, rotation, 'x');
    const vpZ = getVanishingPoint(camera, rotation, 'z');
    const halfSize = 1.25;

    const updateLines = (vp: THREE.Vector3, lineRef: React.RefObject<THREE.LineSegments>, color: string) => {
      if (!lineRef.current) return;
      lineRef.current.visible = true;
      const positions = lineRef.current.geometry.attributes.position;
      let idx = 0;
      const sets = [
        [-halfSize, -halfSize], [halfSize, -halfSize],
        [-halfSize, halfSize], [halfSize, halfSize]
      ];

      sets.forEach(([c1, c2]) => {
        let pFar = new THREE.Vector3(0, 0, 0);
        let maxDist = -1;

        [-halfSize, halfSize].forEach(v3 => {
          let localPos = new THREE.Vector3(0, 0, 0);
          if (color === 'orange') { 
            localPos.set(c1, c2, v3);
          } else { 
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

    if (meshRef1.current && lineRef1.current) {
      if (preset === '2pt' && vpX) {
        meshRef1.current.visible = true;
        meshRef1.current.position.copy(vpX);
        updateLines(vpX, lineRef1, 'cyan');
      } else {
        meshRef1.current.visible = false;
        lineRef1.current.visible = false;
      }
    }

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
  });

  return (
    <>
      <mesh ref={meshRef1}><sphereGeometry args={[1]} /><meshBasicMaterial color="cyan" /></mesh>
      <lineSegments ref={lineRef1 as any}>
        <bufferGeometry><bufferAttribute attach="attributes-position" count={8} array={new Float32Array(24)} itemSize={3} /></bufferGeometry>
        <lineBasicMaterial color="cyan" opacity={0.5} transparent />
      </lineSegments>

      <mesh ref={meshRef2}><sphereGeometry args={[1]} /><meshBasicMaterial color="orange" /></mesh>
      <lineSegments ref={lineRef2 as any}>
        <bufferGeometry><bufferAttribute attach="attributes-position" count={8} array={new Float32Array(24)} itemSize={3} /></bufferGeometry>
        <lineBasicMaterial color="orange" opacity={0.5} transparent />
      </lineSegments>
    </>
  );
};

interface SceneContentProps {
  onCapture: (data: string, lines: string, meta?: any) => void;
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
  const areHelpersVisible = !triggerCapture;

  useEffect(() => {
    if (triggerCapture) {
      const originalInfo = { background: scene.background };
      scene.background = new THREE.Color('#ffffff');
      gl.render(scene, camera);

      const getCroppedImage = (minX: number, minY: number, width: number, height: number) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(gl.domElement, minX, minY, width, height, 0, 0, width, height);
        return tempCanvas.toDataURL('image/png');
      };

      const width = gl.domElement.width;
      const height = gl.domElement.height;
      const halfSize = 1.25;

      let minX = width, maxX = 0, minY = height, maxY = 0;
      const edgesX: [number, number, number, number][] = [];
      const edgesZ: [number, number, number, number][] = [];

      const projectVec = (v: THREE.Vector3) => {
        const vec = v.clone();
        vec.project(camera);
        const px = (vec.x + 1) / 2 * width;
        const py = -(vec.y - 1) / 2 * height;
        return [px, py];
      };

      const hs = halfSize;
      const xSegments = [
        [new THREE.Vector3(-hs, -hs, -hs), new THREE.Vector3(hs, -hs, -hs)],
        [new THREE.Vector3(-hs, hs, -hs), new THREE.Vector3(hs, hs, -hs)],
        [new THREE.Vector3(-hs, -hs, hs), new THREE.Vector3(hs, -hs, hs)],
        [new THREE.Vector3(-hs, hs, hs), new THREE.Vector3(hs, hs, hs)],
      ];
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
          minX = Math.min(minX, x1, x2);
          maxX = Math.max(maxX, x1, x2);
          minY = Math.min(minY, y1, y2);
          maxY = Math.max(maxY, y1, y2);
        });
      };

      processEdges(xSegments, edgesX);
      processEdges(zSegments, edgesZ);

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

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const padding = Math.max(contentWidth, contentHeight) * 0.1;

      minX = Math.max(0, Math.floor(minX - padding));
      minY = Math.max(0, Math.floor(minY - padding));
      maxX = Math.min(width, Math.ceil(maxX + padding));
      maxY = Math.min(height, Math.ceil(maxY + padding));
      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;

      const solidData = getCroppedImage(minX, minY, cropWidth, cropHeight);

      scene.background = null;
      if (cubeMaterial.current) cubeMaterial.current.visible = false;
      gl.clear();
      gl.render(scene, camera);
      const wireframeData = getCroppedImage(minX, minY, cropWidth, cropHeight);
      if (cubeMaterial.current) cubeMaterial.current.visible = true;
      scene.background = originalInfo.background;

      const projectPoint = (x: number, y: number, z: number) => {
        const vec = new THREE.Vector3(x, y, z);
        vec.project(camera);
        const px = (vec.x + 1) / 2 * width;
        const py = -(vec.y - 1) / 2 * height;
        return [px - minX, py - minY] as [number, number];
      };

      let vpLeftCoords: [number, number] | null = null;
      let vpRightCoords: [number, number] | null = null;
      const horizonCenter = projectPoint(0, 0, HORIZON_Z);
      const horizonY = horizonCenter[1];

      if (preset === '1pt') {
        const vp = getVanishingPoint(camera, cubeRotation, 'z');
        if (vp) vpLeftCoords = projectPoint(vp.x, vp.y, vp.z);
      } else if (preset === '2pt') {
        const vp1 = getVanishingPoint(camera, cubeRotation, 'x');
        const vp2 = getVanishingPoint(camera, cubeRotation, 'z');
        if (vp1) {
          const coords = projectPoint(vp1.x, vp1.y, vp1.z);
          if (!vpLeftCoords || coords[0] < vpLeftCoords[0]) {
            vpRightCoords = vpLeftCoords;
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

      if (solidData && wireframeData) {
        onCapture(solidData, wireframeData, meta);
      }
    }
  }, [triggerCapture, gl, scene, camera, onCapture, cubePos, cubeRotation, preset]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (preset !== '1pt' && preset !== '2pt') return;
    e.stopPropagation();
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pointOnPlane = new THREE.Vector3();
    e.ray.intersectPlane(dragPlane, pointOnPlane);
    dragOffset.current.copy(new THREE.Vector3(...cubePos)).sub(pointOnPlane);
    if (interactionMode === 'rotate') {
      startX.current = e.clientX;
      startRotation.current = cubeRotation;
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (preset !== '1pt' && preset !== '2pt') return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if ((preset !== '1pt' && preset !== '2pt') || !isDragging.current) return;
    e.stopPropagation();
    if (interactionMode === 'move') {
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

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <gridHelper args={[10000, 200, 0xdddddd, 0xeeeeee]} position={[0, -1.25, 0]} visible={areHelpersVisible && showGuides} />
      {(preset === '1pt' || preset === '2pt') && areHelpersVisible && showGuides && <HorizonHelper camera={camera} />}
      {(preset === '1pt' || preset === '2pt') && areHelpersVisible && showGuides && <VPHelpers camera={camera} rotation={cubeRotation} cubePos={cubePos} preset={preset} />}
      <mesh ref={cubeMesh} position={preset === 'free' ? [0, 0, 0] : cubePos} rotation={[0, cubeRotation, 0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        {triggerCapture ? <meshBasicMaterial ref={cubeMaterial as any} color="#ffffff" /> : <meshStandardMaterial ref={cubeMaterial as any} color="#ffffff" roughness={0.9} metalness={0.1} />}
        <lineSegments><edgesGeometry args={[edgeGeometry]} /><lineBasicMaterial color="#2D2D2D" linewidth={2} /></lineSegments>
      </mesh>
      <mesh visible={false} position={[0, 0, 0]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}><planeGeometry args={[100, 100]} /><meshBasicMaterial /></mesh>
      <Environment preset="city" />
    </>
  );
};

type Step = 'pose' | 'draw' | 'result';
const STEP_CONFIG = [
  { key: 'pose', label: 'Set up your reference', icon: Icons.Box },
  { key: 'draw', label: 'Upload your drawing', icon: Icons.Upload },
  { key: 'result', label: 'See results', icon: Icons.CheckCircle }
] as const;

interface StepIndicatorProps {
  currentStep: Step;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const currentIndex = STEP_CONFIG.findIndex(s => s.key === currentStep);
  return (
    <div className="flex items-center justify-center gap-1 md:gap-2 py-3 px-2 bg-paper border-b-2 border-pencil border-dashed">
      {STEP_CONFIG.map((stepInfo, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        return (
          <React.Fragment key={stepInfo.key}>
            <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 rounded-lg transition-all ${isActive ? 'bg-sketch-orange border-2 border-pencil shadow-sm transform -rotate-1' : isCompleted ? 'bg-sketch-blue/30 border-2 border-pencil/30' : 'bg-paper border-2 border-pencil/20'}`}>
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${isActive ? 'bg-pencil text-paper' : isCompleted ? 'bg-sketch-blue text-pencil' : 'bg-pencil/20 text-pencil/50'}`}>
                {isCompleted ? <Icons.Check size={14} /> : index + 1}
              </div>
              <span className={`hidden md:block text-sm font-hand ${isActive ? 'text-pencil font-bold' : isCompleted ? 'text-pencil/70' : 'text-pencil/40'}`}>{stepInfo.label}</span>
            </div>
            {index < STEP_CONFIG.length - 1 && <div className={`w-4 md:w-8 h-0.5 ${index < currentIndex ? 'bg-sketch-blue' : 'bg-pencil/20'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface CritiqueZoneProps {
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

const CritiqueZone: React.FC<CritiqueZoneProps> = ({ difficulty: difficultyProp }) => {
  const [step, setStep] = useState<Step>('pose');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceLines, setReferenceLines] = useState<string | null>(null);
  const [userDrawing, setUserDrawing] = useState<string | null>(null);
  const [triggerCapture, setTriggerCapture] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [lineSets, setLineSets] = useState<{
    leftSet: { start: [number, number], end: [number, number] }[],
    rightSet: { start: [number, number], end: [number, number] }[],
    verticalSet: { start: [number, number], end: [number, number] }[]
  }>({ leftSet: [], rightSet: [], verticalSet: [] });

  const [captureMeta, setCaptureMeta] = useState<{
    vpLeft: [number, number] | null,
    vpRight: [number, number] | null,
    horizonY: number | null,
    edgesX?: [number, number, number, number][],
    edgesZ?: [number, number, number, number][],
    width?: number,
    height?: number
  }>({ vpLeft: null, vpRight: null, horizonY: null });

  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [analysisError, setAnalysisError] = useState<{ type: 'network' | 'timeout' | 'parse' | 'unknown'; message: string } | null>(null);
  const [showPerspectiveLines, setShowPerspectiveLines] = useState(true);

  // -- NEW STATE for Saving --
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const [fov, setFov] = useState(55);
  const [cameraDistance, setCameraDistance] = useState(15);
  const [cameraHeight, setCameraHeight] = useState(0);
  const [preset, setPreset] = useState('1pt');
  const [showGuides, setShowGuides] = useState(() => {
    const difficulty = getDifficulty();
    return DIFFICULTY_CONFIG[difficulty].showGuides;
  });

  useEffect(() => {
    if (difficultyProp) {
      setShowGuides(DIFFICULTY_CONFIG[difficultyProp].showGuides);
    }
  }, [difficultyProp]);

  const LOADING_PHASES = ["Analyzing your lines...", "Checking convergence points...", "Comparing with reference...", "Generating feedback..."];

  useEffect(() => {
    if (!isAnalyzing) {
      setLoadingPhase(0);
      setLoadingStartTime(null);
      setElapsedTime(0);
      return;
    }
    setLoadingStartTime(Date.now());
    setLoadingPhase(0);
    const phaseInterval = setInterval(() => {
      setLoadingPhase(prev => (prev + 1) % LOADING_PHASES.length);
    }, 2500);
    const timeInterval = setInterval(() => {
      if (loadingStartTime) setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
    }, 1000);
    return () => {
      clearInterval(phaseInterval);
      clearInterval(timeInterval);
    };
  }, [isAnalyzing, loadingStartTime]);

  const [cubePos, setCubePos] = useState<[number, number, number]>([0, 0, 0]);
  const [cubeRotation, setCubeRotation] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'move' | 'rotate'>('move');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  const handleArchiveSelect = (imageData: string) => {
    setUserDrawing(imageData);
    setShowArchiveModal(false);
  };

  const handleCapture = (data: string, lines: string, meta?: any) => {
    setReferenceImage(data);
    setReferenceLines(lines);
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
        setUserDrawing(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // -- NEW: Save Function --
  const handleSaveResult = async () => {
    if (!userDrawing || !analysis || isSaving || hasSaved) return;

    setIsSaving(true);
    try {
      // Save the photo along with the analysis text
      await savePhoto(userDrawing, analysis);
      setHasSaved(true);
    } catch (err) {
      console.error('Failed to save result:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const runComparison = async () => {
    if (!referenceImage || !userDrawing) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setHasSaved(false); // Reset saved state for new analysis

    try {
      const result = await compareDrawings(referenceImage, userDrawing);
      if (!result.feedback || result.feedback.includes("Failed to compare")) {
        setAnalysisError({ type: 'parse', message: 'Could not parse the AI response. Please try again.' });
        setIsAnalyzing(false);
        return;
      }
      setAnalysis(result.feedback);
      setLineSets({
        leftSet: result.leftSet || [],
        rightSet: result.rightSet || [],
        verticalSet: result.verticalSet || []
      });
      recordCritique();
      setStep('result');
    } catch (error: any) {
      let errorInfo: { type: 'network' | 'timeout' | 'parse' | 'unknown'; message: string };
      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        errorInfo = { type: 'network', message: 'Network error. Please check your connection and try again.' };
      } else if (error?.message?.includes('timeout') || error?.name === 'AbortError') {
        errorInfo = { type: 'timeout', message: 'Request timed out. The AI is taking too long to respond.' };
      } else if (error?.message?.includes('JSON') || error?.message?.includes('parse')) {
        errorInfo = { type: 'parse', message: 'Failed to parse AI response. Please try again.' };
      } else {
        errorInfo = { type: 'unknown', message: 'Something went wrong. Please try again.' };
      }
      setAnalysisError(errorInfo);
      setAnalysis(null);
      setLineSets({ leftSet: [], rightSet: [], verticalSet: [] });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetFlow = () => {
    setStep('pose');
    setReferenceImage(null);
    setReferenceLines(null);
    setUserDrawing(null);
    setAnalysis(null);
    setLineSets({ leftSet: [], rightSet: [], verticalSet: [] });
    setCaptureMeta({ vpLeft: null, vpRight: null, horizonY: null });
    setIsAnalyzing(false);
    setAnalysisError(null);
    setShowPerspectiveLines(true);
    setHasSaved(false);
  };

  const handlePresetChange = (newPreset: string) => {
    setPreset(newPreset);
    setCubePos([0, 0, 0]);
    setCubeRotation(newPreset === '2pt' ? Math.PI / 4 : 0);
    setInteractionMode('move');
    if (newPreset === '1pt' || newPreset === '2pt') {
      setShowGuides(true);
    } else {
      setShowGuides(false);
    }
  };

  const resetAngle = () => {
    setCubePos([0, 0, 0]);
    setCubeRotation(preset === '2pt' ? Math.PI / 4 : 0);
  };

  if (step === 'pose') {
      return (
        <div className="h-full flex flex-col bg-paper relative">
          <StepIndicator currentStep={step} />
          <div className="flex-1 w-full relative">
            <Canvas gl={{ preserveDrawingBuffer: true }}>
              <Suspense fallback={null}>
                <CameraController fov={fov} preset={preset} distance={cameraDistance} height={cameraHeight} />
                <SceneContent onCapture={handleCapture} triggerCapture={triggerCapture} showGuides={showGuides} preset={preset} cubePos={cubePos} cubeRotation={cubeRotation} interactionMode={interactionMode} onCubeMove={setCubePos} onCubeRotate={setCubeRotation} />
              </Suspense>
            </Canvas>
  
            <div className="absolute top-4 left-4 right-4 flex flex-col items-center pointer-events-none gap-4">
              <div className="bg-paper/90 backdrop-blur shadow-sketch rounded-lg p-2 flex gap-2 pointer-events-auto border-2 border-pencil">
                {['1pt', '2pt', 'free'].map((mode) => (
                  <button key={mode} onClick={() => handlePresetChange(mode)} className={`px-4 py-1.5 rounded-md text-sm font-bold uppercase tracking-wider transition-all border-2 border-transparent ${preset === mode ? 'bg-sketch-orange text-pencil border-pencil shadow-sm transform -rotate-1' : 'text-pencil hover:bg-sketch-yellow hover:border-pencil hover:-rotate-1'}`}>{mode === 'free' ? 'Free' : mode.replace('pt', '-Point')}</button>
                ))}
              </div>
              <div className="bg-paper/90 backdrop-blur shadow-sketch rounded-lg px-4 py-2 flex items-center gap-4 pointer-events-auto flex-wrap justify-center border-2 border-pencil mt-2">
                {(preset === '1pt' || preset === '2pt') && (
                  <>
                    <div className="flex items-center gap-1 pr-4 border-r-2 border-pencil">
                      <button onClick={resetAngle} className="p-1.5 rounded hover:bg-sketch-yellow border-2 border-transparent hover:border-pencil transition-all text-pencil transform active:scale-95" title="Reset View"><Icons.RotateCcw /></button>
                    </div>
                    <div className="flex items-center gap-1 pr-4 border-r-2 border-pencil">
                      <button onClick={() => setInteractionMode('move')} className={`p-1.5 rounded border-2 transition-all ${interactionMode === 'move' ? 'bg-sketch-blue border-pencil shadow-sm' : 'border-transparent hover:border-pencil hover:bg-sketch-yellow'}`} title="Move Mode"><Icons.Move /></button>
                      <button onClick={() => setInteractionMode('rotate')} className={`p-1.5 rounded border-2 transition-all ${interactionMode === 'rotate' ? 'bg-sketch-blue border-pencil shadow-sm' : 'border-transparent hover:border-pencil hover:bg-sketch-yellow'}`} title="Rotate Mode"><Icons.RefreshCw /></button>
                    </div>
                  </>
                )}
                {preset === 'free' && <div className="pr-4 border-r-2 border-pencil"><span className="text-sm font-bold text-pencil font-hand">Orbit Camera</span></div>}
                <div className="flex items-center gap-2 pr-4 border-r-2 border-pencil"><span className="text-sm font-bold text-pencil font-hand">Dist</span><input type="range" min="5" max="50" value={cameraDistance} onChange={(e) => setCameraDistance(Number(e.target.value))} className="w-16 h-2 bg-pencil rounded-lg appearance-none cursor-pointer accent-sketch-orange" /></div>
                <div className="flex items-center gap-2 pr-4 border-r-2 border-pencil"><span className="text-sm font-bold text-pencil font-hand">Lens</span><input type="range" min="15" max="100" value={fov} onChange={(e) => setFov(Number(e.target.value))} className="w-16 h-2 bg-pencil rounded-lg appearance-none cursor-pointer accent-sketch-orange" /></div>
                <div className="flex items-center gap-2 pr-4 border-r-2 border-pencil"><span className="text-sm font-bold text-pencil font-hand">Height</span><input type="range" min="-5" max="10" step="0.5" value={cameraHeight} onChange={(e) => setCameraHeight(Number(e.target.value))} className="w-16 h-2 bg-pencil rounded-lg appearance-none cursor-pointer accent-sketch-orange" /></div>
                {(preset === '1pt' || preset === '2pt') && <div className="pl-2"><button onClick={() => setShowGuides(!showGuides)} className={`text-sm font-bold font-hand px-3 py-1 rounded-md border-2 transition-all ${showGuides ? 'bg-sketch-red text-pencil border-pencil shadow-sm' : 'bg-paper text-pencil border-dashed border-pencil hover:bg-sketch-yellow'}`}>{showGuides ? 'Hide Guides' : 'Show Guides'}</button></div>}
              </div>
            </div>
            <div className="absolute bottom-24 w-full text-center pointer-events-none">
              <span className="bg-pencil text-paper px-4 py-2 transform -rotate-2 inline-block shadow-sketch rounded-sm text-sm font-hand">
                {preset === 'free' ? 'Drag to orbit • Pinch to zoom' : interactionMode === 'move' ? 'Drag cube to move' : 'Drag horizontally to rotate cube'}
              </span>
            </div>
          </div>
          <div className="p-6 bg-paper border-t-2 border-pencil z-10 flex justify-center">
            <button onClick={triggerSceneCapture} className="w-full max-w-md bg-sketch-blue text-pencil py-4 rounded-xl font-bold text-xl shadow-sketch hover:shadow-sketch-hover hover:-translate-y-1 transition-all flex items-center justify-center gap-2 border-2 border-pencil">
              <Icons.Camera /> Capture & Draw
            </button>
          </div>
        </div>
      );
  }

  if (step === 'draw') {
    return (
        <div className="h-full flex flex-col bg-paper overflow-y-auto">
          <StepIndicator currentStep={step} />
          {isAnalyzing && (
            <div className="fixed inset-0 z-50 bg-pencil/80 flex items-center justify-center p-4">
              <div className="bg-paper w-full max-w-sm rounded-xl border-2 border-pencil shadow-sketch p-6 text-center">
                <div className="animate-spin text-sketch-orange mb-4 flex justify-center"><Icons.Loader size={48} /></div>
                <p className="font-hand text-xl text-pencil mb-2">{LOADING_PHASES[loadingPhase]}</p>
                <div className="w-full bg-pencil/20 h-2 rounded-full overflow-hidden mb-3"><div className="h-full bg-sketch-orange transition-all duration-500" style={{ width: `${((loadingPhase + 1) / LOADING_PHASES.length) * 100}%` }} /></div>
                {elapsedTime >= 5 && <p className="text-sm text-pencil/60 font-hand">Elapsed: {elapsedTime}s</p>}
                {elapsedTime >= 15 && <button onClick={() => { setIsAnalyzing(false); setAnalysisError({ type: 'timeout', message: 'Analysis cancelled. Try again?' }); }} className="mt-4 px-4 py-2 bg-sketch-red text-pencil font-bold font-hand rounded-lg border-2 border-pencil hover:bg-sketch-red/80 transition-all">Cancel</button>}
              </div>
            </div>
          )}
          {analysisError && !isAnalyzing && (
            <div className="mx-4 mt-4 p-4 bg-sketch-red/20 border-2 border-sketch-red rounded-lg">
              <div className="flex items-start gap-3">
                <Icons.AlertCircle className="text-sketch-red flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-bold text-pencil font-hand">{analysisError.message}</p>
                  <button onClick={runComparison} className="mt-2 px-4 py-1.5 bg-sketch-orange text-pencil font-bold font-hand text-sm rounded-lg border-2 border-pencil hover:shadow-sketch transition-all flex items-center gap-2"><Icons.RefreshCw size={14} /> Retry</button>
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 p-4 md:p-6">
            {showArchiveModal && (
              <div className="fixed inset-0 z-50 bg-pencil/80 flex items-center justify-center p-4">
                <div className="bg-paper w-full max-w-lg max-h-[90vh] rounded-xl border-2 border-pencil shadow-sketch overflow-hidden flex flex-col">
                  <div className="p-4 border-b-2 border-pencil border-dashed flex justify-between items-center bg-white">
                    <h3 className="text-xl font-heading text-pencil">Select from Archive</h3>
                    <button onClick={() => setShowArchiveModal(false)} className="text-pencil hover:text-sketch-red font-bold"><Icons.X size={24} /></button>
                  </div>
                  <div className="flex-1 overflow-hidden"><Camera selectMode={true} onSelectPhoto={handleArchiveSelect} /></div>
                </div>
              </div>
            )}
            <div className="max-w-md mx-auto w-full space-y-6">
              <div className="flex justify-between items-center border-b-2 border-pencil pb-4 border-dashed">
                <h2 className="text-3xl font-heading text-pencil transform -rotate-1">Your Reference</h2>
                <button onClick={resetFlow} className="text-sm font-bold font-hand text-pencil hover:text-sketch-red underline">Cancel</button>
              </div>
              <div className="bg-white p-2 rounded-sm shadow-sketch border-2 border-pencil">
                <div className="bg-white border-2 border-pencil/10"><img src={referenceImage!} alt="Reference" className="w-full aspect-[4/3] object-contain" /></div>
              </div>
              <div className="space-y-4">
                <div onClick={() => fileInputRef.current?.click()} className={`border-4 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden h-48 ${userDrawing ? 'border-sketch-blue bg-sketch-blue/10' : 'border-pencil/30 hover:border-pencil hover:bg-sketch-yellow/20'}`}>
                  {userDrawing ? <img src={userDrawing} className="absolute inset-0 w-full h-full object-contain p-2" alt="upload" /> : <><div className="text-pencil mb-2"><Icons.Upload /></div><p className="text-pencil font-hand text-xl">Tap to upload your sketch</p></>}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <button onClick={() => setShowArchiveModal(true)} className="w-full bg-white text-pencil py-3 rounded-xl font-bold text-lg font-hand border-2 border-pencil shadow-sketch hover:bg-sketch-yellow/20 transition-all flex items-center justify-center gap-2"><Icons.Image size={20} /> Select from Archive</button>
                <button onClick={runComparison} disabled={!userDrawing || isAnalyzing} className="w-full bg-sketch-orange text-pencil py-4 rounded-xl font-bold text-2xl font-heading transform hover:-rotate-1 shadow-sketch hover:shadow-sketch-hover hover:-translate-y-1 border-2 border-pencil disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2">{isAnalyzing ? <><Icons.Loader className="animate-spin" size={24} /> Analyzing...</> : 'Check Accuracy'}</button>
              </div>
            </div>
          </div>
        </div>
      );
  }

  return (
    <div className="h-full bg-paper overflow-y-auto flex flex-col">
      <StepIndicator currentStep={step} />
      <div className="flex-1 p-4 md:p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="flex justify-between items-center border-b-2 border-pencil pb-4 border-dashed">
          <h2 className="text-2xl md:text-3xl font-heading text-pencil">Accuracy Report</h2>
          <div className="flex gap-2">
            {/* NEW: Save Button */}
            <button
              onClick={handleSaveResult}
              disabled={isSaving || hasSaved}
              className={`text-sm font-bold font-hand px-3 py-1.5 rounded-md border-2 transition-all flex items-center gap-1 ${hasSaved 
                ? 'bg-green-100 text-green-700 border-green-700 cursor-default' 
                : 'bg-white text-pencil border-pencil hover:bg-sketch-yellow'}`}
            >
              {hasSaved ? <Icons.Check size={16} /> : <Icons.Save size={16} />}
              {hasSaved ? 'Saved' : 'Save Result'}
            </button>
            <button onClick={resetFlow} className="text-sketch-blue font-bold font-hand text-lg hover:underline flex items-center gap-1">
              <Icons.Plus size={18} />
              New Practice
            </button>
          </div>
        </div>

        {/* Images Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white p-3 rounded-sm border-2 border-pencil shadow-sketch transform md:-rotate-1">
            <p className="text-xs font-bold font-hand text-pencil mb-2 uppercase tracking-wide text-center">Reference Model</p>
            <img src={referenceImage!} className="w-full h-48 md:h-56 object-contain" alt="ref" />
          </div>

          <div className="bg-white p-3 rounded-sm border-2 border-pencil shadow-sketch transform md:rotate-1">
            <p className="text-xs font-bold font-hand text-pencil mb-2 uppercase tracking-wide text-center">Your Drawing + Overlay</p>
            <div className="relative w-full h-48 md:h-56" style={{ aspectRatio: (captureMeta.width && captureMeta.height) ? `${captureMeta.width}/${captureMeta.height}` : 'auto' }}>
              <img src={userDrawing!} className="w-full h-full object-contain" alt="user" />
              <img src={referenceLines!} className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-200" style={{ opacity: overlayOpacity }} alt="reference overlay" />
              {showPerspectiveLines && captureMeta.width && captureMeta.height && (
                <svg viewBox={`0 0 ${captureMeta.width} ${captureMeta.height}`} className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  {captureMeta.horizonY !== null && <line x1="-10000" y1={captureMeta.horizonY} x2="10000" y2={captureMeta.horizonY} stroke="red" strokeWidth="2" strokeDasharray="10 10" opacity="0.3" />}
                  {captureMeta.edgesZ && captureMeta.edgesZ.map((edge, i) => {
                    let targetVP = null;
                    if (preset === '1pt') targetVP = captureMeta.vpLeft;
                    else targetVP = captureMeta.vpRight;
                    if (!targetVP) return null;
                    const midX = (edge[0] + edge[2]) / 2;
                    const midY = (edge[1] + edge[3]) / 2;
                    return <line key={`z-${i}`} x1={midX} y1={midY} x2={targetVP[0]} y2={targetVP[1]} stroke="orange" strokeWidth="1" opacity="0.2" />;
                  })}
                  {captureMeta.edgesX && captureMeta.edgesX.map((edge, i) => {
                    const targetVP = captureMeta.vpLeft;
                    if (preset !== '2pt' || !targetVP) return null;
                    const midX = (edge[0] + edge[2]) / 2;
                    const midY = (edge[1] + edge[3]) / 2;
                    return <line key={`x-${i}`} x1={midX} y1={midY} x2={targetVP[0]} y2={targetVP[1]} stroke="cyan" strokeWidth="1" opacity="0.2" />;
                  })}
                </svg>
              )}
            </div>

            <div className="mt-3 pt-3 border-t-2 border-pencil/20 border-dashed space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-hand text-pencil whitespace-nowrap">Overlay: {Math.round(overlayOpacity * 100)}%</span>
                <input type="range" min="0" max="1" step="0.1" value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))} className="flex-1 h-2 bg-pencil/20 rounded-lg appearance-none cursor-pointer accent-sketch-orange" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showPerspectiveLines} onChange={(e) => setShowPerspectiveLines(e.target.checked)} className="w-4 h-4 rounded border-2 border-pencil accent-sketch-blue" />
                <span className="text-xs font-bold font-hand text-pencil">Show perspective guides</span>
              </label>
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
                <p className="font-hand text-xl animate-pulse">Analyzing lines & angles...</p>
              </div>
            ) : (
              <MarkdownRenderer content={analysis || "No analysis available."} className="font-hand text-lg" />
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CritiqueZone;