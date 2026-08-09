"use client";

import { Component } from "react";
import * as React from "react";

// Ambient JSX intrinsic declarations for @react-three/fiber elements so
// TypeScript doesn't error when the runtime import isn't a static one.
// At runtime these names are intercepted by R3F's reconciler.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      points: any;
      pointLight: any;
      ambientLight: any;
      directionalLight: any;
      color: any;
      fog: any;
      sphereGeometry: any;
      torusGeometry: any;
      octahedronGeometry: any;
      planeGeometry: any;
      boxGeometry: any;
      bufferGeometry: any;
      bufferAttribute: any;
      meshBasicMaterial: any;
      meshPhysicalMaterial: any;
      meshStandardMaterial: any;
      pointsMaterial: any;
      primitive: any;
    }
  }
}

let THREE: any = null;
let Canvas: any = null;
let useFrame: any = null;
let supports3D = false;

try {
  if (typeof window !== "undefined") {
    THREE = require("three");
    const r3f = require("@react-three/fiber");
    Canvas = r3f.Canvas;
    useFrame = r3f.useFrame;
    const testCanvas = document.createElement("canvas");
    supports3D = !!testCanvas.getContext("webgl") || !!testCanvas.getContext("webgl2");
  }
} catch {
  supports3D = false;
}

class SafeBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {}
  render() { return this.state.hasError ? null : this.props.children; }
}

function LogoCore() {
  const coreRef = React.useRef(null) as any;
  const ringRef = React.useRef(null) as any;
  const particlesRef = React.useRef(null) as any;

  useFrame((state: any) => {
    const t = state.clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.x = t * 0.3;
      coreRef.current.rotation.y = t * 0.5;
      coreRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = -t * 0.4;
      ringRef.current.rotation.z = t * 0.2;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.15;
      particlesRef.current.rotation.x = Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <group>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.8, 0.03, 16, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.35} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhysicalMaterial color="#0ea5e9" metalness={0.1} roughness={0.15} transmission={0.85} thickness={0.4} clearcoat={1} clearcoatRoughness={0.1} ior={1.5} />
      </mesh>
      <points ref={particlesRef}>
        <bufferGeometry attach="geometry">
          <bufferAttribute attach="attributes-position" count={300} array={new Float32Array(900).map((_: number, i: number) => (Math.random() - 0.5) * 2.2)} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.025} color="#60a5fa" transparent opacity={0.7} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {[0, 1, 2].map((i) => <OrbitingParticle key={i} index={i} />)}
    </group>
  );
}

function OrbitingParticle({ index }: { index: number }) {
  const meshRef = React.useRef(null) as any;
  const colors = [0x3b82f6, 0x06b6d4, 0x22d3ee];
  const distances = [2.4, 2.8, 3.2];

  useFrame((state: any) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      const speed = 0.4 + index * 0.15;
      const angle = t * speed + index * 2.1;
      meshRef.current.position.x = Math.cos(angle) * distances[index];
      meshRef.current.position.z = Math.sin(angle) * distances[index];
      meshRef.current.position.y = Math.sin(t * 1.2 + index) * 0.6;
      meshRef.current.rotation.x = t * 0.5;
      meshRef.current.rotation.y = t * 0.3;
    }
  });

  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[0.12, 0]} />
      <meshBasicMaterial color={colors[index]} transparent opacity={0.85} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

export function BrandMark3D({ size = 48 }: { size?: number }) {
  if (!supports3D || !Canvas) return null;
  try {
    return (
      <SafeBoundary>
        <div style={{ width: size, height: size, display: "block" }}>
          <Canvas
            camera={{ position: [0, 0, 4.5], fov: 30 }}
            style={{ width: "100%", height: "100%", display: "block" }}
            shadows={false}
            dpr={[1, 2]}
            gl={{ antialias: false }}
          >
            <color attach="background" args={["transparent"]} />
            <ambientLight intensity={0.8} color="#ffffff" />
            <directionalLight position={[2, 3, 2]} intensity={1.2} color="#ffffff" />
            <directionalLight position={[-1, -1, -2]} intensity={0.4} color="#60a5fa" />
            <LogoCore />
          </Canvas>
        </div>
      </SafeBoundary>
    );
  } catch {
    return null;
  }
}
