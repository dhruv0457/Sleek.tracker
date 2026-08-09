"use client";

import { Component } from "react";
import * as React from "react";

// Ambient JSX intrinsic declarations for @react-three/fiber elements so
// TypeScript doesn't error when the runtime import isn't a static one.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      points: any;
      ambientLight: any;
      directionalLight: any;
      color: any;
      fog: any;
      sphereGeometry: any;
      planeGeometry: any;
      bufferGeometry: any;
      bufferAttribute: any;
      meshBasicMaterial: any;
      pointsMaterial: any;
      primitive: any;
    }
  }
}

let Canvas: any = null;
let useFrame: any = null;
let useMemo: any = null;
let THREE: any = null;
let supports3D = false;

try {
  if (typeof window !== "undefined") {
    THREE = require("three");
    Canvas = require("@react-three/fiber").Canvas;
    useFrame = require("@react-three/fiber").useFrame;
    useMemo = require("react").useMemo;
    const testCanvas = document.createElement("canvas");
    supports3D = !!testCanvas.getContext("webgl") || !!testCanvas.getContext("webgl2");
  }
} catch {
  supports3D = false;
}

export class CanvasErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {}
  render() { return this.state.hasError ? null : this.props.children; }
}

function Particles({ count = 600 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 1.5 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = radius * Math.cos(phi);
    }
    return arr;
  }, [count]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.018, color: 0x3b82f6, transparent: true, opacity: 0.6,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }), []);

  const ref = React.useRef(null) as any;
  useFrame((_: unknown, delta: number) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.008;
      ref.current.rotation.x += delta * 0.005;
    }
  });

  return <points ref={ref} geometry={geo} material={material} />;
}

function GridLines() {
  const ref = React.useRef(null) as any;
  useFrame((_: unknown, delta: number) => { if (ref.current) ref.current.rotation.y += delta * 0.003; });
  return <group ref={ref} />;
}

function GlowOrbs() {
  const ref = React.useRef(null);
  useFrame(() => { /* subtle orbit — noop for stability */ });
  return <group ref={ref} />;
}

function DashboardCanvasInner() {
  if (!Canvas || !supports3D) return null;
  try {
    return (
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
        shadows={false}
        dpr={[1, 1.5]}
        gl={{ antialias: false }}
      >
        <color attach="background" args={["transparent"]} />
        <fog attach="fog" args={["#0a0a0f", 2, 12]} />
        <ambientLight intensity={0.4} color="#ffffff" />
        <directionalLight position={[3, 5, 3]} intensity={0.3} color="#3b82f6" />
        <Particles count={400} />
        <GlowOrbs />
      </Canvas>
    );
  } catch {
    return null;
  }
}

export function DashboardCanvas() {
  if (!supports3D) return null;
  if (typeof React.Suspense === "undefined" || typeof window === "undefined") return null;
  return (
    <CanvasErrorBoundary>
      <React.Suspense fallback={null}>
        <DashboardCanvasInner />
      </React.Suspense>
    </CanvasErrorBoundary>
  );
}