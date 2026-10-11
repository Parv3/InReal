---
name: 3d-web-experience
description: >-
  Interactive 3D web experiences, WebGL, Three.js, React Three Fiber (R3F), Spline, shader effects, and spatial UI.
  Use when implementing 3D hero sections, interactive particle fields, globe/radar visualizations, physics-based canvas backgrounds,
  and performant canvas rendering without degrading page load or responsiveness.
---

# 3D Web Experience Skill

This skill guides the creation of performant, tasteful 3D web elements and spatial experiences that elevate web products.

## Core Guidelines

1. **Tasteful Integration (Subtle over Gimmicky)**:
   - 3D elements should enhance atmosphere or convey spatial data (e.g., radar, globe of global internship opportunities, interactive particle constellation), never block usability or primary content.

2. **Performance & Optimization**:
   - Limit geometry complexity: utilize low-poly meshes, instanced rendering (`THREE.InstancedMesh`), and lightweight buffer geometries.
   - Pause rendering loops (`requestAnimationFrame`) when the canvas is off-screen (using `IntersectionObserver`) or when the tab is inactive.
   - Cap device pixel ratio (`Math.min(window.devicePixelRatio, 2)`) to avoid GPU melt on high-DPI displays.

3. **Lighting & Material Aesthetics**:
   - Use subtle environmental lighting, PBR materials, soft point lights, or custom shader materials (`glsl`).
   - Clean blending with the 2D UI: utilize subtle background gradients, CSS backdrop-filters, or canvas masks to seamlessly blend into application layout layers.

4. **Interactivity**:
   - Smooth mouse parallax / lerping (linear interpolation) on pointer moves.
   - Fallback gracefully when WebGL is unavailable or on low-power mobile devices.
