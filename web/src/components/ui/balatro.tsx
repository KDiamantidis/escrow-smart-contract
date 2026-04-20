"use client";

import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

const DEFAULT_OFFSET: [number, number] = [0, 0];

export interface BalatroProps {
  spinRotation?: number;
  spinSpeed?: number;
  offset?: [number, number];
  color1?: string;
  color2?: string;
  color3?: string;
  contrast?: number;
  lighting?: number;
  spinAmount?: number;
  pixelFilter?: number;
  spinEase?: number;
  isRotate?: boolean;
  mouseInteraction?: boolean;
  /** Caps canvas DPR (e.g. 1.5 when another fullscreen WebGL layer is active). */
  maxDpr?: number;
  className?: string;
}

function hexToVec4(hex: string): [number, number, number, number] {
  const hexStr = hex.replace("#", "");
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 1;
  if (hexStr.length === 6) {
    r = Number.parseInt(hexStr.slice(0, 2), 16) / 255;
    g = Number.parseInt(hexStr.slice(2, 4), 16) / 255;
    b = Number.parseInt(hexStr.slice(4, 6), 16) / 255;
  } else if (hexStr.length === 8) {
    r = Number.parseInt(hexStr.slice(0, 2), 16) / 255;
    g = Number.parseInt(hexStr.slice(2, 4), 16) / 255;
    b = Number.parseInt(hexStr.slice(4, 6), 16) / 255;
    a = Number.parseInt(hexStr.slice(6, 8), 16) / 255;
  }
  return [r, g, b, a];
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform float uSpinRotation;
uniform float uSpinSpeed;
uniform vec2 uOffset;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;
uniform float uContrast;
uniform float uLighting;
uniform float uSpinAmount;
uniform float uPixelFilter;
uniform float uSpinEase;
uniform bool uIsRotate;
uniform vec2 uMouse;

varying vec2 vUv;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
  float pixel_size = length(screenSize.xy) / uPixelFilter;
  vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
  float uv_len = length(uv);

  float speed = (uSpinRotation * uSpinEase * 0.2);
  if(uIsRotate){
    speed = iTime * speed;
  }
  speed += 302.2;

  float mouseInfluence = (uMouse.x * 2.0 - 1.0);
  speed += mouseInfluence * 0.1;

  float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
  vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
  uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);

  uv *= 30.0;
  float baseSpeed = iTime * uSpinSpeed;
  speed = baseSpeed + mouseInfluence * 2.0;

  vec2 uv2 = vec2(uv.x + uv.y);

  for(int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(
      cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
      sin(uv2.x - 0.113 * speed)
    );
    uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
  }

  float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
  float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
  float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
  float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
  float c3p = 1.0 - min(1.0, c1p + c2p);
  float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);

  return (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light;
}

void main() {
  vec2 uv = vUv * iResolution.xy;
  gl_FragColor = effect(iResolution.xy, uv);
}
`;

export default function Balatro({
  spinRotation = -2.0,
  spinSpeed = 7.0,
  offset = DEFAULT_OFFSET,
  color1 = "#DE443B",
  color2 = "#006BB4",
  color3 = "#162325",
  contrast = 3.5,
  lighting = 0.4,
  spinAmount = 0.25,
  pixelFilter = 745.0,
  spinEase = 1.0,
  isRotate = false,
  mouseInteraction = false,
  maxDpr = 2,
  className = "",
}: BalatroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<Program | null>(null);
  const propsRef = useRef({
    spinRotation,
    spinSpeed,
    offset,
    color1,
    color2,
    color3,
    contrast,
    lighting,
    spinAmount,
    pixelFilter,
    spinEase,
    isRotate,
    mouseInteraction,
  });

  useEffect(() => {
    propsRef.current = {
      spinRotation,
      spinSpeed,
      offset,
      color1,
      color2,
      color3,
      contrast,
      lighting,
      spinAmount,
      pixelFilter,
      spinEase,
      isRotate,
      mouseInteraction,
    };
    const program = programRef.current;
    if (!program) return;
    program.uniforms.uSpinRotation.value = spinRotation;
    program.uniforms.uSpinSpeed.value = spinSpeed;
    program.uniforms.uOffset.value = offset;
    program.uniforms.uColor1.value = hexToVec4(color1);
    program.uniforms.uColor2.value = hexToVec4(color2);
    program.uniforms.uColor3.value = hexToVec4(color3);
    program.uniforms.uContrast.value = contrast;
    program.uniforms.uLighting.value = lighting;
    program.uniforms.uSpinAmount.value = spinAmount;
    program.uniforms.uPixelFilter.value = pixelFilter;
    program.uniforms.uSpinEase.value = spinEase;
    program.uniforms.uIsRotate.value = isRotate;
  }, [
    spinRotation,
    spinSpeed,
    offset,
    color1,
    color2,
    color3,
    contrast,
    lighting,
    spinAmount,
    pixelFilter,
    spinEase,
    isRotate,
    mouseInteraction,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, maxDpr),
      powerPreference: "low-power",
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    let program: Program;
    const initial = propsRef.current;

    function resize() {
      const c = containerRef.current;
      if (!c) return;
      renderer.setSize(c.offsetWidth, c.offsetHeight);
      if (program) {
        program.uniforms.iResolution.value = [
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        ];
      }
    }

    window.addEventListener("resize", resize);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: [
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          ],
        },
        uSpinRotation: { value: initial.spinRotation },
        uSpinSpeed: { value: initial.spinSpeed },
        uOffset: { value: initial.offset },
        uColor1: { value: hexToVec4(initial.color1) },
        uColor2: { value: hexToVec4(initial.color2) },
        uColor3: { value: hexToVec4(initial.color3) },
        uContrast: { value: initial.contrast },
        uLighting: { value: initial.lighting },
        uSpinAmount: { value: initial.spinAmount },
        uPixelFilter: { value: initial.pixelFilter },
        uSpinEase: { value: initial.spinEase },
        uIsRotate: { value: initial.isRotate },
        uMouse: { value: [0.5, 0.5] },
      },
    });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry, program });
    let animationFrameId = 0;

    function update(time: number) {
      if (document.visibilityState === "hidden") {
        animationFrameId = 0;
        return;
      }
      animationFrameId = requestAnimationFrame(update);
      program.uniforms.iTime.value = time * 0.001;
      renderer.render({ scene: mesh });
    }

    function resumeIfVisible() {
      if (document.visibilityState !== "visible") return;
      if (animationFrameId) return;
      animationFrameId = requestAnimationFrame(update);
    }

    document.addEventListener("visibilitychange", resumeIfVisible);
    animationFrameId = requestAnimationFrame(update);
    el.appendChild(gl.canvas);

    function handleMouseMove(e: MouseEvent) {
      if (!propsRef.current.mouseInteraction) return;
      const c = containerRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      program.uniforms.uMouse.value = [x, y];
    }

    el.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("visibilitychange", resumeIfVisible);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      el.removeEventListener("mousemove", handleMouseMove);
      programRef.current = null;
      if (gl.canvas.parentNode === el) {
        el.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [maxDpr]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    />
  );
}
