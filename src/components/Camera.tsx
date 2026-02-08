import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera as CameraIcon, RotateCcw, Check, Trash2, X } from 'lucide-react';
import { savePhoto, getPhotosByDate, deletePhoto, PhotosByDate, StoredPhoto } from '../services/photoStorage';

interface CameraProps {
  onSelectPhoto?: (imageData: string) => void;
  selectMode?: boolean;
}

const Camera: React.FC<CameraProps> = ({ onSelectPhoto, selectMode = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoArchive, setPhotoArchive] = useState<PhotosByDate[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<StoredPhoto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const loadArchive = useCallback(async () => {
    try {
      const photos = await getPhotosByDate();
      setPhotoArchive(photos);
    } catch (err) {
      console.error('Failed to load photo archive:', err);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCamera(true);
    } catch (err) {
      console.error('Camera access denied:', err);
      setHasCamera(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    loadArchive();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera, loadArchive]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleSave = async () => {
    if (!capturedImage) return;
    setIsLoading(true);

    try {
      await savePhoto(capturedImage);
      setCapturedImage(null);
      await loadArchive();
    } catch (err) {
      console.error('Failed to save photo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePhoto = async (photo: StoredPhoto) => {
    try {
      await deletePhoto(photo.id);
      await loadArchive();
      setSelectedPhoto(null);
    } catch (err) {
      console.error('Failed to delete photo:', err);
    }
  };

  const handleSelectFromArchive = (photo: StoredPhoto) => {
    if (selectMode && onSelectPhoto) {
      onSelectPhoto(photo.imageData);
    } else {
      setSelectedPhoto(photo);
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Photo preview modal
  if (selectedPhoto) {
    return (
      <div className="h-full flex flex-col bg-paper">
        <div className="flex items-center justify-between p-4 border-b-2 border-pencil border-dashed">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="flex items-center gap-2 text-pencil font-bold font-hand hover:text-sketch-blue"
          >
            <X size={20} />
            Back
          </button>
          <span className="text-xs text-pencil/60 font-hand">
            {new Date(selectedPhoto.timestamp).toLocaleString()}
          </span>
          <button
            onClick={() => handleDeletePhoto(selectedPhoto)}
            className="flex items-center gap-2 text-sketch-red font-bold font-hand hover:underline"
          >
            <Trash2 size={18} />
            Delete
          </button>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <img
            src={selectedPhoto.imageData}
            alt="Selected photo"
            className="max-w-full max-h-full object-contain rounded-lg border-2 border-pencil shadow-sketch"
          />
        </div>
        {selectMode && onSelectPhoto && (
          <div className="p-4 border-t-2 border-pencil border-dashed">
            <button
              onClick={() => onSelectPhoto(selectedPhoto.imageData)}
              className="w-full bg-sketch-orange text-pencil py-3 rounded-xl font-bold text-xl font-heading border-2 border-pencil shadow-sketch hover:shadow-sketch-hover transition-all"
            >
              Use This Photo
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-paper">
      {/* Camera / Captured Image Area */}
      <div className="relative bg-pencil/10 aspect-[4/3] max-h-[50vh]">
        {hasCamera === false ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-pencil p-4 text-center">
            <CameraIcon size={48} className="mb-4 opacity-50" />
            <p className="font-hand text-xl">Camera access not available</p>
            <p className="font-hand text-sm opacity-70 mt-2">
              Grant camera permissions or use the archive below
            </p>
          </div>
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera flip button */}
        {hasCamera && !capturedImage && (
          <button
            onClick={flipCamera}
            className="absolute top-3 right-3 w-10 h-10 bg-white/80 backdrop-blur rounded-full border-2 border-pencil flex items-center justify-center shadow-sketch hover:bg-white transition-colors"
            aria-label="Flip camera"
          >
            <RotateCcw size={20} />
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b-2 border-pencil border-dashed">
        {capturedImage ? (
          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 bg-white text-pencil py-3 rounded-xl font-bold text-lg font-hand border-2 border-pencil shadow-sketch hover:bg-sketch-yellow/20 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} />
              Retake
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 bg-sketch-orange text-pencil py-3 rounded-xl font-bold text-lg font-hand border-2 border-pencil shadow-sketch hover:shadow-sketch-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={20} />
              {isLoading ? 'Saving...' : 'Save to Archive'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCapture}
            disabled={!hasCamera}
            className="w-full bg-sketch-blue text-pencil py-4 rounded-xl font-bold text-xl font-heading border-2 border-pencil shadow-sketch hover:shadow-sketch-hover hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CameraIcon size={24} />
            Capture
          </button>
        )}
      </div>

      {/* Photo Archive */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xl font-heading text-pencil mb-4 transform -rotate-1">
          {selectMode ? 'Select from Archive' : 'Photo Archive'}
        </h3>

        {photoArchive.length === 0 ? (
          <div className="text-center py-8 text-pencil/60 font-hand">
            <CameraIcon size={32} className="mx-auto mb-2 opacity-50" />
            <p>No photos yet</p>
            <p className="text-sm">Capture your first drawing!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {photoArchive.map((group) => (
              <div key={group.date}>
                <h4 className="text-sm font-bold font-hand text-pencil/70 uppercase tracking-wide mb-2">
                  {group.label}
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {group.photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <button
                        onClick={() => handleSelectFromArchive(photo)}
                        className="w-full aspect-square rounded-lg overflow-hidden border-2 border-pencil shadow-sketch hover:shadow-sketch-hover hover:-translate-y-0.5 transition-all bg-white"
                      >
                        <img
                          src={photo.imageData}
                          alt="Archived drawing"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Delete this photo?')) {
                            handleDeletePhoto(photo);
                          }
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-sketch-red text-white rounded-full border-2 border-white shadow-md flex items-center justify-center hover:scale-110 transition-transform z-10"
                        title="Delete photo"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Camera;
