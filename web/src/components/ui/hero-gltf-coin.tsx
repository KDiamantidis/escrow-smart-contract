"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Center, useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useRef } from "react";
import { Color, MeshStandardMaterial } from "three";
import type { Group, Material, Mesh, Texture } from "three";

function disposeMaterialMaps(material: Material): void {
  const keys = [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "aoMap",
    "emissiveMap",
    "bumpMap",
    "displacementMap",
    "alphaMap",
    "lightMap",
    "envMap",
  ] as const;
  for (const key of keys) {
    const tex = (material as unknown as Record<string, Texture | null | undefined>)[
      key
    ];
    if (tex && typeof tex.dispose === "function") {
      tex.dispose();
    }
  }
  material.dispose();
}

function RotatingCoin({
  url,
  rotationSpeed,
  modelScale,
  metalPreset,
  onLoad,
}: {
  url: string;
  rotationSpeed: number;
  modelScale: number;
  metalPreset: "silver" | "default";
  onLoad?: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const silverMaterialAppliedRef = useRef(false);
  const { scene } = useGLTF(url);

  useLayoutEffect(() => {
    if (metalPreset === "silver") {
      if (!silverMaterialAppliedRef.current) {
        silverMaterialAppliedRef.current = true;
        scene.traverse((child) => {
          const mesh = child as Mesh;
          if (!mesh.isMesh) return;

          const old = mesh.material;
          const materials = Array.isArray(old) ? old : [old];
          for (const m of materials) {
            disposeMaterialMaps(m);
          }

          const silverBase = {
            color: "#d8dde3",
            metalness: 0.55,
            roughness: 0.42,
            envMapIntensity: 0.6,
          };

          if (Array.isArray(old) && old.length > 1) {
            mesh.material = old.map(() => new MeshStandardMaterial({ ...silverBase }));
          } else {
            mesh.material = new MeshStandardMaterial({ ...silverBase });
          }
        });
      }
    }
    onLoad?.();
  }, [scene, metalPreset, onLoad]);

  useFrame((_, delta) => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += delta * rotationSpeed;
  });

  return (
    <group ref={groupRef}>
      <Center>
        <group scale={modelScale}>
          <primitive object={scene} />
        </group>
      </Center>
      <pointLight position={[1.8, 1.4, 3]} intensity={1.05} color="#e8ecff" />
    </group>
  );
}

export type ModelMetalPreset = "silver" | "default";

export interface HeroGltfCoinProps {
  modelSrc: string;
  /** Radians per second around local Y */
  rotationSpeed?: number;
  /** Uniform scale after centering */
  modelScale?: number;
  /** Replace GLB materials with silver PBR, or keep file materials */
  metalPreset?: ModelMetalPreset;
  /** Called once the model scene + materials are ready */
  onLoad?: () => void;
  className?: string;
}

export function HeroGltfCoin({
  modelSrc,
  rotationSpeed = 0.85,
  modelScale = 1,
  metalPreset = "silver",
  onLoad,
  className,
}: HeroGltfCoinProps) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl ${className ?? ""}`}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{
          antialias: false,
          alpha: true,
          premultipliedAlpha: false,
          powerPreference: "low-power",
        }}
        className="h-full w-full bg-transparent"
        style={{ background: "transparent", pointerEvents: "none" }}
        dpr={[1, 1.35]}
        onCreated={({ gl }) => {
          gl.setClearColor(new Color(0x000000), 0);
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 6, 10]} intensity={1.15} />
        <directionalLight position={[-5, 2, -6]} intensity={0.4} />
        <Suspense fallback={null}>
          <RotatingCoin
            url={modelSrc}
            rotationSpeed={rotationSpeed}
            modelScale={modelScale}
            metalPreset={metalPreset}
            onLoad={onLoad}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
