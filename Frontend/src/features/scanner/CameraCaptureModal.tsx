import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, Upload, VideoOff, X } from 'lucide-react';
import { Button } from '@/components/ui';

interface CameraCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onFallbackToGallery?: () => void;
}

export function CameraCaptureModal({
  open,
  onClose,
  onCapture,
  onFallbackToGallery,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopActiveStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (facing: 'environment' | 'user' = 'environment') => {
    stopActiveStream();
    setCameraError(null);
    setIsStarting(true);

    // 1. Verify browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Direct camera access is not supported by this browser. Please select an image from your gallery.'
      );
      setIsStarting(false);
      return;
    }

    // 2. Verify secure context (HTTPS or localhost)
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';
    if (!window.isSecureContext && !isLocal) {
      setCameraError(
        'Direct camera access requires a secure connection (HTTPS or localhost). On insecure origins, please use Gallery Upload.'
      );
      setIsStarting(false);
      return;
    }

    try {
      // First attempt: preferred facing mode
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback: any available video input (e.g. laptop webcam, front-only phone)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraError(
          'Camera permission was denied. Please allow camera permissions in your browser or device settings, or choose from gallery.'
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError(
          'No camera device was detected on this system. You can choose a photo from your gallery instead.'
        );
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraError(
          'The camera is currently in use by another application. Please close other apps and try again.'
        );
      } else {
        setCameraError(
          error.message ||
            'Unable to initialize camera. Please try choosing a photo from your gallery.'
        );
      }
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (open) {
      setCapturedBlob(null);
      setCapturedPreviewUrl(null);
      void startCamera(facingMode);
    } else {
      stopActiveStream();
      setCapturedBlob(null);
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
        setCapturedPreviewUrl(null);
      }
    }

    return () => {
      stopActiveStream();
    };
  }, [open]);

  // Clean up object URL when capturedBlob changes
  useEffect(() => {
    if (capturedBlob) {
      const url = URL.createObjectURL(capturedBlob);
      setCapturedPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setCapturedPreviewUrl(null);
    }
  }, [capturedBlob]);

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopActiveStream();
          setCapturedBlob(blob);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    void startCamera(facingMode);
  };

  const handleUsePhoto = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `meal-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    stopActiveStream();
    onCapture(file);
    onClose();
  };

  const handleSwitchFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    void startCamera(nextFacing);
  };

  const handleCancel = () => {
    stopActiveStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop camera-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Take food photo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="camera-modal-panel">
        <div className="camera-modal-header">
          <div className="camera-modal-title">
            <Camera size={18} />
            <span>Take Meal Photo</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close camera"
            onClick={handleCancel}
          >
            <X size={18} />
          </button>
        </div>

        <div className="camera-viewport-container">
          {cameraError ? (
            <div className="camera-error-screen" role="alert">
              <VideoOff size={36} className="camera-error-icon" />
              <h3>Camera Access Unavailable</h3>
              <p>{cameraError}</p>
              <div className="camera-error-actions">
                <Button
                  tone="primary"
                  onClick={() => {
                    handleCancel();
                    onFallbackToGallery?.();
                  }}
                >
                  <Upload size={16} /> Choose from gallery instead
                </Button>
                <Button tone="secondary" onClick={() => void startCamera(facingMode)}>
                  <RefreshCw size={14} /> Try again
                </Button>
              </div>
            </div>
          ) : capturedBlob && capturedPreviewUrl ? (
            <div className="camera-preview-frozen">
              <img src={capturedPreviewUrl} alt="Captured food photo preview" />
              <div className="camera-freeze-badge">
                <Check size={14} /> Photo captured
              </div>
            </div>
          ) : (
            <div className="camera-stream-wrapper">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-live-video"
              />
              <div className="camera-viewfinder-grid" aria-hidden="true" />
              {isStarting && (
                <div className="camera-loading-overlay">
                  <div className="camera-spinner" />
                  <span>Starting camera…</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="camera-modal-footer">
          {cameraError ? (
            <div className="camera-actions-row">
              <Button tone="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          ) : capturedBlob ? (
            <div className="camera-actions-row">
              <Button tone="secondary" onClick={handleRetake}>
                <RefreshCw size={15} /> Retake
              </Button>
              <Button tone="primary" onClick={handleUsePhoto}>
                <Check size={16} /> Use this photo
              </Button>
            </div>
          ) : (
            <div className="camera-actions-row camera-capture-row">
              <Button
                type="button"
                tone="ghost"
                onClick={handleSwitchFacing}
                title="Switch front/rear camera"
                aria-label="Switch camera"
                disabled={isStarting}
              >
                <RefreshCw size={16} /> Flip
              </Button>

              <button
                type="button"
                className="camera-shutter-btn"
                onClick={handleTakePhoto}
                disabled={isStarting}
                aria-label="Capture photo"
              >
                <span className="camera-shutter-inner" />
              </button>

              <Button
                type="button"
                tone="ghost"
                onClick={() => {
                  handleCancel();
                  onFallbackToGallery?.();
                }}
                title="Choose from gallery"
              >
                <Upload size={16} /> Gallery
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
