'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type GLSLHillsProps = {
  className?: string
  isDark?: boolean
}

export function GLSLHills({ className = '', isDark = true }: GLSLHillsProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const themeRef = useRef(isDark)

  useEffect(() => {
    themeRef.current = isDark
  }, [isDark])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const isMobile =
      window.matchMedia('(max-width: 768px)').matches ||
      navigator.maxTouchPoints > 0
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const getPixelRatio = () => {
      const dpr = window.devicePixelRatio || 1
      if (isMobile) return Math.min(dpr, 1.15)
      return Math.min(dpr, 1.6)
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    })

    renderer.setPixelRatio(getPixelRatio())
    renderer.setSize(mount.clientWidth, mount.clientHeight, false)
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const geometry = new THREE.PlaneGeometry(2, 2)
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(Math.max(mount.clientWidth, 1), Math.max(mount.clientHeight, 1)) },
      uTheme: { value: themeRef.current ? 1.0 : 0.0 },
    }

    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform float uTheme;

        float hill(vec2 p, float speed, float amp, float freq, float offset) {
          return p.y - (0.35 + amp * sin(p.x * freq + uTime * speed + offset));
        }

        void main() {
          vec2 uv = vUv;
          float aspect = uResolution.x / max(uResolution.y, 1.0);
          uv.x = (uv.x - 0.5) * aspect + 0.5;

          float h1 = smoothstep(0.02, -0.02, hill(uv, 0.2, 0.08, 6.0, 0.0));
          float h2 = smoothstep(0.02, -0.02, hill(uv, 0.16, 0.07, 4.8, 1.6));
          float h3 = smoothstep(0.02, -0.02, hill(uv, 0.13, 0.06, 3.8, 3.1));
          float h4 = smoothstep(0.02, -0.02, hill(uv, 0.1, 0.05, 3.0, 4.8));

          vec3 darkBase = vec3(0.01, 0.015, 0.03);
          vec3 darkH1 = vec3(0.35, 0.39, 0.48);
          vec3 darkH2 = vec3(0.22, 0.27, 0.35);
          vec3 darkH3 = vec3(0.14, 0.18, 0.26);
          vec3 darkH4 = vec3(0.1, 0.14, 0.21);

          vec3 lightBase = vec3(0.97, 0.98, 0.99);
          vec3 lightH1 = vec3(0.76, 0.81, 0.88);
          vec3 lightH2 = vec3(0.82, 0.86, 0.91);
          vec3 lightH3 = vec3(0.88, 0.91, 0.95);
          vec3 lightH4 = vec3(0.91, 0.93, 0.96);

          vec3 baseCol = mix(lightBase, darkBase, uTheme);
          vec3 c1 = mix(lightH1, darkH1, uTheme);
          vec3 c2 = mix(lightH2, darkH2, uTheme);
          vec3 c3 = mix(lightH3, darkH3, uTheme);
          vec3 c4 = mix(lightH4, darkH4, uTheme);

          vec3 color = baseCol;
          color = mix(color, c4, h4 * 0.6);
          color = mix(color, c3, h3 * 0.7);
          color = mix(color, c2, h2 * 0.8);
          color = mix(color, c1, h1 * 0.95);

          float lowerMask = smoothstep(0.95, 0.18, uv.y);
          float topFade = smoothstep(0.0, 0.65, 1.0 - uv.y);
          float visibility = lowerMask * topFade;

          float vignette = smoothstep(1.2, 0.1, distance(vUv, vec2(0.5, 0.6)));
          color *= mix(0.9, 1.08, vignette);

          float baseAlpha = mix(0.42, 0.9, uTheme);
          float alpha = baseAlpha * visibility;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1)
      const height = Math.max(mount.clientHeight, 1)
      renderer.setPixelRatio(getPixelRatio())
      renderer.setSize(width, height, false)
      uniforms.uResolution.value.set(width, height)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    window.addEventListener('resize', resize)

    let raf = 0
    let lastFrame = 0
    const targetFps = prefersReducedMotion ? 20 : isMobile ? 30 : 60
    const frameStep = 1000 / targetFps

    const animate = (now: number) => {
      raf = window.requestAnimationFrame(animate)
      if (now - lastFrame < frameStep) return

      lastFrame = now
      uniforms.uTime.value = now * 0.001
      uniforms.uTheme.value = themeRef.current ? 1.0 : 0.0
      renderer.render(scene, camera)
    }

    raf = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      resizeObserver.disconnect()
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className={`h-full w-full ${className}`} aria-hidden="true" />
}
