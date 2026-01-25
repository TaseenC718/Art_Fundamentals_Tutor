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
          <meshStandardMaterial color="#4f46e5" roughness={0.5} metalness={0.1} />
        )}
        <lineSegments>
          <edgesGeometry args={[edgeGeometry]} />
          <lineBasicMaterial color={triggerCapture ? "#000000" : "white"} linewidth={triggerCapture ? 2 : 2} />
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
      <div className="h-full flex flex-col bg-slate-100 relative">
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
            <div className="bg-white/90 backdrop-blur shadow-sm rounded-lg p-1 flex gap-1 pointer-events-auto">
              {['1pt', '2pt', 'free'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handlePresetChange(mode)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${preset === mode
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                  {mode === 'free' ? 'Free' : mode.replace('pt', '-Point')}
                </button>
              ))}
            </div>

            <div className="bg-white/90 backdrop-blur shadow-sm rounded-lg px-4 py-2 flex items-center gap-4 pointer-events-auto flex-wrap justify-center">
              {(preset === '1pt' || preset === '2pt') && (
                <>
                  <div className="flex items-center gap-1 pr-4 border-r border-slate-200">
                    <button
                      onClick={resetAngle}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 active:scale-95 transition-transform"
                      title="Reset View"
                    >
                      <Icons.ResetSquare />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 pr-4 border-r border-slate-200">
                    <button
                      onClick={() => setInteractionMode('move')}
                      className={`p-1.5 rounded transition-all ${interactionMode === 'move' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}
                      title="Move Mode"
                    >
                      <Icons.Move />
                    </button>
                    <button
                      onClick={() => setInteractionMode('rotate')}
                      className={`p-1.5 rounded transition-all ${interactionMode === 'rotate' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}
                      title="Rotate Mode"
                    >
                      <Icons.RefreshCw />
                    </button>
                  </div>
                </>
              )}

              {preset === 'free' && (
                <div className="pr-4 border-r border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase">Orbit Camera</span>
                </div>
              )}

              <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dist</span>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={cameraDistance}
                  onChange={(e) => setCameraDistance(Number(e.target.value))}
                  className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lens</span>
                <input
                  type="range"
                  min="15"
                  max="100"
                  value={fov}
                  onChange={(e) => setFov(Number(e.target.value))}
                  className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {(preset === '1pt' || preset === '2pt') && (
                <div className="pl-4">
                  <button
                    onClick={() => setShowGuides(!showGuides)}
                    className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md border transition-colors ${showGuides
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    {showGuides ? 'Hide' : 'Show'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-20 w-full text-center pointer-events-none">
            <span className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white/90 font-medium">
              {preset === 'free'
                ? 'Drag to orbit • Pinch to zoom'
                : interactionMode === 'move'
                  ? 'Drag cube to move'
                  : 'Drag horizontally to rotate cube'
              }
            </span>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-200 z-10">
          <button
            onClick={triggerSceneCapture}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
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
      <div className="h-full flex flex-col bg-slate-50 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-serif text-slate-800">Your Reference</h2>
            <button onClick={resetFlow} className="text-sm text-slate-400 hover:text-indigo-600">Cancel</button>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <img src={referenceImage!} alt="Reference" className="w-full aspect-[4/3] object-contain bg-slate-50 rounded-lg" />
          </div>
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden h-48 ${userDrawing ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}
            >
              {userDrawing ? (
                <img src={userDrawing} className="absolute inset-0 w-full h-full object-contain p-2" alt="upload" />
              ) : (
                <>
                  <div className="text-slate-400 mb-2"><Icons.Upload /></div>
                  <p className="text-slate-600 font-medium">Tap to upload your drawing</p>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <button onClick={runComparison} disabled={!userDrawing} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all">Check Accuracy</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 p-4 md:p-6 overflow-y-auto">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-serif text-slate-800">Accuracy Report</h2>
          <button onClick={resetFlow} className="text-indigo-600 font-medium">New Practice</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide">Model</p>
            <img src={referenceImage!} className="w-full h-24 object-contain" alt="ref" />
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide">You</p>
            <img src={userDrawing!} className="w-full h-24 object-contain" alt="user" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[300px]">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-48 gap-4 text-slate-400">
              <div className="animate-spin text-indigo-600"><Icons.Loader /></div>
              <p className="font-serif italic">Analyzing geometry...</p>
            </div>
          ) : (
            <MarkdownRenderer content={analysis || "No analysis available."} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CritiqueZone;