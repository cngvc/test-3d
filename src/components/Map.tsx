import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useState, useEffect, useRef } from "react";
import "./Map.css";

// Define types for our panoramic images
type FootstepPosition = {
  position: [number, number, number];
  rotation: number;
};

type PanoramaImage = {
  id: number;
  name: string;
  url: string;
  position: [number, number, number];
  prev: number | null; // Previous panorama in the sequence (null if first)
  next: number | null; // Next panorama in the sequence (null if last)
  prevFootstep?: FootstepPosition; // Custom position for previous footstep
  nextFootstep?: FootstepPosition; // Custom position for next footstep
};

// Define the available panoramic images with linked list style navigation and custom footstep positions
const panoramaImages: PanoramaImage[] = [
  {
    id: 1,
    name: "Entrance",
    url: "/assets/360%20images/1-Entrance.jpeg",
    position: [0, 0, 0],
    prev: null, // First in sequence
    next: 2, // Points to Window Table
    nextFootstep: {
      position: [3, -4, 3], // Right side, forward
      rotation: Math.PI * -0.75,
    },
  },
  {
    id: 2,
    name: "Window Table",
    url: "/assets/360%20images/2-Window%20Table.jpeg",
    position: [5, 0, 0],
    prev: 1, // Points to Entrance
    next: 3, // Points to Window Table 2
    prevFootstep: {
      position: [-5, -4, 2], // Left side
      rotation: Math.PI * 0.5,
    },
    nextFootstep: {
      position: [5, -4, 0], // Right side
      rotation: Math.PI * -0.5,
    },
  },
  {
    id: 3,
    name: "Window Table 2",
    url: "/assets/360%20images/3-Window%20Table%202.jpeg",
    position: [10, 0, 0],
    prev: 2, // Points to Window Table
    next: 4, // Points to Corner
    prevFootstep: {
      position: [1.5, -4, -5], // Left side
      rotation: Math.PI * 2,
    },
    nextFootstep: {
      position: [0, -4, 5], // Right side
      rotation: Math.PI,
    },
  },
  {
    id: 4,
    name: "Corner",
    url: "/assets/360%20images/4-Corner.jpeg",
    position: [5, 0, -5],
    prev: 3, // Points to Window Table 2
    next: null, // Last in sequence
    prevFootstep: {
      position: [-3, -4, 8], // Left side
      rotation: Math.PI * 0.7,
    },
  },
];

// Footstep component for floor navigation
type FootstepProps = {
  position: [number, number, number];
  rotation: number;
  targetId: number | null;
  direction: "prev" | "next";
  onClick: (targetId: number) => void;
};

function Footstep({
  position,
  rotation,
  targetId,
  direction,
  onClick,
}: FootstepProps) {
  const footstepTexture = useTexture("/assets/footstep.png");
  const [hovered, setHovered] = useState(false);
  const [scale, setScale] = useState(1);

  // If targetId is null, this footstep is disabled (no prev/next)
  const isDisabled = targetId === null;

  // Add a subtle animation effect
  useEffect(() => {
    if (hovered && !isDisabled) {
      const interval = setInterval(() => {
        setScale((prev) => (prev === 1 ? 1.1 : 1));
      }, 500);
      return () => clearInterval(interval);
    } else {
      setScale(1);
    }
  }, [hovered, isDisabled]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (targetId !== null) {
      onClick(targetId);
    }
  };

  // Define colors based on direction
  const nextColor = "#61dafb"; // Blue for next
  const prevColor = "#fb6161"; // Red for previous
  const disabledColor = "#888888"; // Gray for disabled

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh
        position={[0, -0.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]} // Rotate to lay flat on the "floor"
        onPointerOver={() => !isDisabled && setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={isDisabled ? undefined : handleClick}
        scale={[scale, scale, scale]}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={footstepTexture}
          transparent
          opacity={isDisabled ? 0.3 : hovered ? 1 : 0.7}
          side={THREE.DoubleSide}
          color={
            isDisabled
              ? disabledColor
              : direction === "next"
              ? nextColor
              : prevColor
          }
        />
      </mesh>

      {/* Direction indicator arrow */}
      {!isDisabled && (
        <mesh
          position={[0, -0.4, direction === "next" ? 0.5 : -0.5]}
          rotation={[0, direction === "next" ? 0 : Math.PI, 0]}
          scale={[0.5, 0.5, 0.5]}
        >
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial
            color={direction === "next" ? nextColor : prevColor}
            transparent
            opacity={hovered ? 1 : 0.7}
          />
        </mesh>
      )}

      {hovered && targetId !== null && (
        <Html position={[0, 0, 0]} center>
          <div
            className="hotspot-label"
            style={{
              transform: "translateY(-30px)",
              backgroundColor:
                direction === "next"
                  ? "rgba(97, 218, 251, 0.7)"
                  : "rgba(251, 97, 97, 0.7)",
            }}
          >
            {direction === "next" ? "Next: " : "Previous: "}
            {panoramaImages.find((img) => img.id === targetId)?.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// Panorama sphere component with navigation hotspots
type PanoramaSphereProps = {
  imageUrl: string;
  currentImageId: number;
  onNavigate: (imageId: number) => void;
};

function PanoramaSphere({
  imageUrl,
  currentImageId,
  onNavigate,
}: PanoramaSphereProps) {
  const texture = useLoader(THREE.TextureLoader, imageUrl);
  const { camera } = useThree();
  const lastPositionRef = useRef<string | null>(null);

  // Reset camera rotation when changing panoramas
  useEffect(() => {
    if (lastPositionRef.current !== imageUrl) {
      camera.rotation.set(0, 0, 0);
      lastPositionRef.current = imageUrl;
    }
  }, [imageUrl, camera]);

  // Get the current panorama data
  const currentPanorama = panoramaImages.find(
    (img) => img.id === currentImageId
  );

  // We directly use currentPanorama.prev and currentPanorama.next in our footstep data functions

  // Define positions for prev and next footsteps, using custom positions if available
  const getPrevFootstepData = () => {
    // Use custom position if defined, otherwise use default
    const defaultPosition: [number, number, number] = [-3, -4, 5]; // Left side
    const defaultRotation = Math.PI * 0.75; // Facing left-forward

    return {
      position: currentPanorama?.prevFootstep?.position || defaultPosition,
      rotation: currentPanorama?.prevFootstep?.rotation || defaultRotation,
      targetId: currentPanorama?.prev || null,
      direction: "prev" as const,
    };
  };

  const getNextFootstepData = () => {
    // Use custom position if defined, otherwise use default
    const defaultPosition: [number, number, number] = [3, -4, 5]; // Right side
    const defaultRotation = Math.PI * 0.25; // Facing right-forward

    return {
      position: currentPanorama?.nextFootstep?.position || defaultPosition,
      rotation: currentPanorama?.nextFootstep?.rotation || defaultRotation,
      targetId: currentPanorama?.next || null,
      direction: "next" as const,
    };
  };

  return (
    <>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[10, 60, 40]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>

      {/* Linked list style navigation with prev/next footsteps */}
      <Footstep {...getPrevFootstepData()} onClick={onNavigate} />
      <Footstep {...getNextFootstepData()} onClick={onNavigate} />
    </>
  );
}

// Loading indicator
function LoadingScreen() {
  return (
    <Html center>
      <div className="loading-container">
        <div>Loading panorama...</div>
        <div className="loader"></div>
      </div>
    </Html>
  );
}

// Location indicator
type LocationIndicatorProps = {
  currentImageName: string;
};

function LocationIndicator({ currentImageName }: LocationIndicatorProps) {
  return (
    <Html position={[0, 4, 0]} center>
      <div className="location-indicator">{currentImageName}</div>
    </Html>
  );
}

// Main Map component
export default function Map() {
  const [currentImageId, setCurrentImageId] = useState(1);
  const currentImage = panoramaImages.find((img) => img.id === currentImageId);

  const handleNavigate = (imageId: number) => {
    setCurrentImageId(imageId);
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Fixed logo in top-right corner */}
      <a
        href="https://www.google.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 1000,
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          transition: "transform 0.3s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <img
          src="/assets/logo/logo.png"
          alt="360° View Logo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </a>

      <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }}>
        <Suspense fallback={<LoadingScreen />}>
          <ambientLight intensity={0.5} />
          <PanoramaSphere
            imageUrl={currentImage!.url}
            currentImageId={currentImageId}
            onNavigate={handleNavigate}
          />
          <LocationIndicator currentImageName={currentImage!.name} />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            rotateSpeed={0.5}
            autoRotate={false}
          />
        </Suspense>
      </Canvas>

      {/* Navigation UI */}
      <div className="panorama-nav">
        {panoramaImages.map((img) => (
          <button
            key={img.id}
            onClick={() => setCurrentImageId(img.id)}
            className={`nav-button ${
              currentImageId === img.id ? "active" : ""
            }`}
          >
            {img.name}
          </button>
        ))}
        <button
          className="nav-button"
          onClick={() => {
            // Toggle fullscreen mode
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch((err) => {
                console.error(
                  `Error attempting to enable fullscreen: ${err.message}`
                );
              });
            } else {
              if (document.exitFullscreen) {
                document.exitFullscreen();
              }
            }
          }}
        >
          <span role="img" aria-label="fullscreen">
            🔍
          </span>
        </button>
      </div>
    </div>
  );
}
