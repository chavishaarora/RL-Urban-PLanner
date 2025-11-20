/// <reference types="vite/client" />

// Fallback intrinsic element typings for react-three-fiber primitives.
// If proper typings load from @react-three/fiber these will merge; otherwise they prevent TS compile errors.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      planeGeometry: any;
      shadowMaterial: any;
      line: any;
      bufferGeometry: any;
      lineBasicMaterial: any;
      group: any;
      ambientLight: any;
      hemisphereLight: any;
      gridHelper: any;
      directionalLight: any;
      sphereGeometry: any;
      meshBasicMaterial: any;
      cylinderGeometry: any;
      meshStandardMaterial: any;
      coneGeometry: any;
      ringGeometry: any;
      primitive: any;
      arrowHelper: any;
    }
  }
}
