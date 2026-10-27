"use client";

import { Suspense, lazy } from "react";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center">
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white"
            role="status"
            aria-label="Loading 3D scene"
          />
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
