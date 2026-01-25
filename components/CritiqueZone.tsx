import * as THREE from 'three';
import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { compareDrawings } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import { Icons } from './Icon';

// --- 3D Components ---

const EYE_Z_INITIAL = 15;
const HORIZON_Z = -30;

/**
 * Calculates VP X-coordinate on the plane Z = HORIZON_Z
 * based on the current camera Z position.
 */
const calculateVPPosition = (cameraZ: number, rotationRad: number, type: 'center' | 'left' | 'right') => {
  const D = cameraZ - HORIZON_Z;
  const theta = rotationRad;

  if (type === 'center' || type === 'left') {
    // Corresponds to depth axis (-sin, 0, -cos)
    // x = -D * tan(theta)
    return -D * Math.tan(theta);
  } else {
    // Right VP for 2pt (width axis)
    // Corresponds to width axis (cos, 0, -sin)
    // x = D * cot(theta)
    // Avoid infinity
    const eps = 0.0001;
    const t = Math.abs(theta) < eps ? eps : theta;
    return D * (1 / Math.tan(t));
  }
};

// Dynamic Markers Component
const PerspectiveMarkers = ({ preset, totalRotation, visible = true }: { preset: string, totalRotation: number, visible?: boolean }) => {
  const { camera } = useThree();
  const centerRef = useRef<THREE.Mesh>(null);
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);

  useFrame(() => {
    const camZ = camera.position.z;

    // Horizon Line is at Y=0 (Eye Level)
    if (lineRef.current) {
      lineRef.current.position.y = 0;
    }

    if (preset === '1pt') {
      if (centerRef.current) {
        const x = calculateVPPosition(camZ, totalRotation, 'center');
        centerRef.current.position.set(x, 0, HORIZON_Z);
        centerRef.current.visible = Math.abs(x) < 5000;
      }
    } else if (preset === '2pt') {
      if (leftRef.current) {
        const x = calculateVPPosition(camZ, totalRotation, 'left');
        leftRef.current.position.set(x, 0, HORIZON_Z);
        leftRef.current.visible = Math.abs(x) < 5000;
      }
      if (rightRef.current) {
        const x = calculateVPPosition(camZ, totalRotation, 'right');
        rightRef.current.position.set(x, 0, HORIZON_Z);
        rightRef.current.visible = Math.abs(x) < 5000;
      }
    }
  });

  if (!visible || preset === 'free') return null;

  return (
    <group>
      {/* The Horizon Line */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <float32BufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-5000, 0, HORIZON_Z, 5000, 0, HORIZON_Z]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#94a3b8" linewidth={1} />
      </line>

      {preset === '1pt' && (
        <mesh ref={centerRef}>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}

      {preset === '2pt' && (
        <>
          <mesh ref={leftRef}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh ref={rightRef}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </>
      )}
    </group>
  );
};

// Perspective Guides Component
const PerspectiveGuides = ({ enabled, preset, cubePos, totalRotation }: { enabled: boolean, preset: string, cubePos: [number, number, number], totalRotation: number }) => {
  const ref = useRef<THREE.LineSegments>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!ref.current) return;

    if (!enabled || (preset !== '1pt' && preset !== '2pt')) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;

    const positions: number[] = [];
    const currentPos = new THREE.Vector3(...cubePos);
    const s = 1.25; // Cube half-size
    const camZ = camera.position.z;

    // Calculate actual 3D positions of Vanishing Points on the Horizon Plane (Y=0)
    let vp1: THREE.Vector3 | null = null; // Center or Left
    let vp2: THREE.Vector3 | null = null; // Right

    if (preset === '1pt') {
      const x = calculateVPPosition(camZ, totalRotation, 'center');
      vp1 = new THREE.Vector3(x, 0, HORIZON_Z);
    } else if (preset === '2pt') {
      const xLeft = calculateVPPosition(camZ, totalRotation, 'left');
      vp1 = new THREE.Vector3(xLeft, 0, HORIZON_Z);

      const xRight = calculateVPPosition(camZ, totalRotation, 'right');
      vp2 = new THREE.Vector3(xRight, 0, HORIZON_Z);
    }

    // Define all 8 corners in local space
    const corners = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          corners.push(new THREE.Vector3(x * s, y * s, z * s));
        }
      }
    }

    corners.forEach(c => {
      // Transform corner to world space
      // Standard rotation around Y
      const worldCorner = c.clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), totalRotation)
        .add(currentPos);

      if (vp1) {
        positions.push(worldCorner.x, worldCorner.y, worldCorner.z);
        positions.push(vp1.x, vp1.y, vp1.z);
      }
      if (vp2) {
        positions.push(worldCorner.x, worldCorner.y, worldCorner.z);
        positions.push(vp2.x, vp2.y, vp2.z);
      }
    });

    const geo = ref.current.geometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeBoundingSphere();
    ref.current.computeLineDistances();
  });

  if (!enabled || (preset !== '1pt' && preset !== '2pt')) return null;

  return (
    <lineSegments ref={ref}>
      <bufferGeometry />
      <lineDashedMaterial color="#ef4444" opacity={0.3} transparent dashSize={0.5} gapSize={0.5} />
    </lineSegments>
  );
};

// Camera Controller
const CameraController = ({
  fov,
  preset,
  distance
}: {
  fov: number,
  preset: string,
  distance: number
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [fov, camera]);

  useEffect(() => {
    if (preset === '1pt' || preset === '2pt') {
      // Camera at height 0 (Horizon Level)
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0); // Always look at the cube
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
      }
    } else if (preset === 'free') {
      // Free mode orbit
    }

    if (controlsRef.current) {
      controlsRef.current.update();
    }
  }, [preset, camera, distance]);

  const isLocked = preset === '1pt' || preset === '2pt';

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

interface SceneContentProps {
  onCapture: (data: string) => void;
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

  const edgeGeometry = useMemo(() => new THREE.BoxGeometry(2.5, 2.5, 2.5), []);

  // When capturing, we want a clean shot of the cube without guides
  const areHelpersVisible = !triggerCapture;

  useEffect(() => {
    if (triggerCapture) {
      const originalInfo = {
        background: scene.background
      };

      // Force white background for "paper" look
      scene.background = new THREE.Color('#ffffff');

      gl.render(scene, camera);

      // Calculate Cube Bounding Box in Screen Space
      const width = gl.domElement.width;
      const height = gl.domElement.height;
      const halfSize = 1.25; // Half of cube size (2.5)

      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;

      // Check all 8 corners
      for (let x of [-1, 1]) {
        for (let y of [-1, 1]) {
          for (let z of [-1, 1]) {
            const cornerPos = new THREE.Vector3(x * halfSize, y * halfSize, z * halfSize);
            // Apply rotation
            cornerPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), cubeRotation);
            // Translate
            cornerPos.add(new THREE.Vector3(...cubePos));

            // Project to Screen
            cornerPos.project(camera);

            // Convert NDC to Pixel Coordinates
            // NDC: [-1, 1], Y is up
            // Screen: [0, width/height], Y is down
            const px = (cornerPos.x + 1) / 2 * width;
            const py = -(cornerPos.y - 1) / 2 * height;

            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
          }
        }
      }

      // Add Padding
      const padding = Math.min(width, height) * 0.05; // 5% padding
      minX = Math.max(0, Math.floor(minX - padding));
      minY = Math.max(0, Math.floor(minY - padding));
      maxX = Math.min(width, Math.ceil(maxX + padding));
      maxY = Math.min(height, Math.ceil(maxY + padding));

      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;

      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;

        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          // Draw cropped region
          // Source: gl.domElement (the full canvas)
          // Source X/Y: minX, minY
          // Source W/H: cropWidth, cropHeight
          // Dest X/Y: 0, 0
          // Dest W/H: cropWidth, cropHeight
          ctx.drawImage(gl.domElement, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

          const data = tempCanvas.toDataURL('image/png');
          onCapture(data);

          // Restore background
          scene.background = originalInfo.background;
        } else {
          throw new Error("Could not get 2d context");
        }
      } catch (e) {
        console.error("Crop failed, falling back to full capture", e);
        const data = gl.domElement.toDataURL('image/png');
        onCapture(data);
        scene.background = originalInfo.background;
      }
    }
  }, [triggerCapture, gl, scene, camera, onCapture, cubePos, cubeRotation]);

  // Handle Dragging
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (preset !== '1pt' && preset !== '2pt') return;
    e.stopPropagation();
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

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
      // Project ray to plane at z=0
      onCubeMove([e.point.x, e.point.y, 0]);
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

      <PerspectiveMarkers
        preset={preset}
        totalRotation={totalRotation}
        visible={areHelpersVisible}
      />

      <PerspectiveGuides
        enabled={showGuides && areHelpersVisible}
        preset={preset}
        cubePos={cubePos}
        totalRotation={totalRotation}
      />

      {(preset === '1pt' || preset === '2pt') && (
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
      )}

      <mesh
        position={preset === 'free' ? [0, 0, 0] : cubePos}
        rotation={[0, totalRotation, 0]}
      >
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        {triggerCapture ? (
          <meshBasicMaterial color="#ffffff" />
        ) : (
          <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0.1} />
        )}
        <lineSegments>
          <edgesGeometry args={[edgeGeometry]} />
          <lineBasicMaterial color="#2D2D2D" linewidth={2} />
        </lineSegments>
      </mesh>

      <Environment preset="city" />
    </>
  );
};

type Step = 'pose' | 'draw' | 'result';

const CritiqueZone: React.FC = () => {
  const [step, setStep] = useState<Step>('pose');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [userDrawing, setUserDrawing] = useState<string | null>(null);
  const [triggerCapture, setTriggerCapture] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [fov, setFov] = useState(55);
  const [cameraDistance, setCameraDistance] = useState(15);
  // Removed cameraHeight state
  const [preset, setPreset] = useState('1pt');
  const [showGuides, setShowGuides] = useState(true);
  const [cubePos, setCubePos] = useState<[number, number, number]>([0, 0, 0]);
  const [cubeRotation, setCubeRotation] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'move' | 'rotate'>('move');

  const fileInputRef = useRef<HTMLInputElement>(null);



  const handleCapture = (data: string) => {
    setReferenceImage(data);
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

  const runComparison = async () => {
    if (!referenceImage || !userDrawing) return;
    setIsAnalyzing(true);
    setStep('result');
    try {
      const result = await compareDrawings(referenceImage, userDrawing);
      setAnalysis(result);
    } catch (error) {
      setAnalysis("Error analyzing images. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetFlow = () => {
    setStep('pose');
    setReferenceImage(null);
    setUserDrawing(null);
    setAnalysis(null);
    setIsAnalyzing(false);
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
        <div className="flex-1 w-full relative">
          <Canvas gl={{ preserveDrawingBuffer: true }}>
            <Suspense fallback={null}>
              <CameraController fov={fov} preset={preset} distance={cameraDistance} />
              <SceneContent
                onCapture={handleCapture}
                triggerCapture={triggerCapture}
                showGuides={showGuides}
                preset={preset}
                cubePos={cubePos}
                cubeRotation={cubeRotation}
                interactionMode={interactionMode}
                onCubeMove={setCubePos}
                onCubeRotate={setCubeRotation}
              />
            </Suspense>
          </Canvas>

          <div className="absolute top-4 left-4 right-4 flex flex-col items-center pointer-events-none gap-4">
            <div className="bg-paper/90 backdrop-blur shadow-sketch rounded-lg p-2 flex gap-2 pointer-events-auto border-2 border-pencil">
              {['1pt', '2pt', 'free'].map((mode) => (
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
              {(preset === '1pt' || preset === '2pt') && (
                <>
                  <div className="flex items-center gap-1 pr-4 border-r-2 border-pencil">
                    <button
                      onClick={resetAngle}
                      className="p-1.5 rounded hover:bg-sketch-yellow border-2 border-transparent hover:border-pencil transition-all text-pencil transform active:scale-95"
                      title="Reset View"
                    >
                      <Icons.ResetSquare />
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
                    <button
                      onClick={() => setInteractionMode('rotate')}
                      className={`p-1.5 rounded border-2 transition-all ${interactionMode === 'rotate' ? 'bg-sketch-blue border-pencil shadow-sm' : 'border-transparent hover:border-pencil hover:bg-sketch-yellow'}`}
                      title="Rotate Mode"
                    >
                      <Icons.RefreshCw />
                    </button>
                  </div>
                </>
              )}

              {preset === 'free' && (
                <div className="pr-4 border-r-2 border-pencil">
                  <span className="text-sm font-bold text-pencil font-hand">Orbit Camera</span>
                </div>
              )}

              <div className="flex items-center gap-2 pr-4 border-r-2 border-pencil">
                <span className="text-sm font-bold text-pencil font-hand">Dist</span>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={cameraDistance}
                  onChange={(e) => setCameraDistance(Number(e.target.value))}
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

              {(preset === '1pt' || preset === '2pt') && (
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

  // ... rest of the component matches previous version logic (draw step, result step, etc)
  if (step === 'draw') {
    return (
      <div className="h-full flex flex-col bg-paper p-4 md:p-6 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="flex justify-between items-center border-b-2 border-pencil pb-4 border-dashed">
            <h2 className="text-3xl font-heading text-pencil transform -rotate-1">Your Reference</h2>
            <button onClick={resetFlow} className="text-sm font-bold font-hand text-pencil hover:text-sketch-red underline">Cancel</button>
          </div>
          <div className="bg-white p-2 rounded-sm shadow-sketch border-2 border-pencil transform rotate-1">
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
            <button onClick={runComparison} disabled={!userDrawing} className="w-full bg-sketch-orange text-pencil py-4 rounded-xl font-bold text-2xl font-heading transform hover:-rotate-1 shadow-sketch hover:shadow-sketch-hover hover:-translate-y-1 border-2 border-pencil disabled:opacity-50 disabled:shadow-none transition-all">Check Accuracy</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-paper p-4 md:p-6 overflow-y-auto">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div className="flex justify-between items-center border-b-2 border-pencil pb-4 border-dashed">
          <h2 className="text-3xl font-heading text-pencil">Accuracy Report</h2>
          <button onClick={resetFlow} className="text-sketch-blue font-bold font-hand text-lg hover:underline">New Practice</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-2 rounded-sm border-2 border-pencil shadow-sketch transform -rotate-1">
            <p className="text-xs font-bold font-hand text-pencil mb-1 uppercase tracking-wide text-center">Model</p>
            <img src={referenceImage!} className="w-full h-24 object-contain" alt="ref" />
          </div>
          <div className="bg-white p-2 rounded-sm border-2 border-pencil shadow-sketch transform rotate-1">
            <p className="text-xs font-bold font-hand text-pencil mb-1 uppercase tracking-wide text-center">You</p>
            <img src={userDrawing!} className="w-full h-24 object-contain" alt="user" />
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
  );
};

export default CritiqueZone;