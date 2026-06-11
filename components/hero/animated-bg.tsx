"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
}

interface ChartLine {
  offset: number;
  speed: number;
  amplitude: number;
  frequency: number;
  y: number;
  color: string;
  width: number;
}

// RawTree brand: #1B83FE → #5F68FA (blue-indigo)
const BRAND_R = 27;
const BRAND_G = 131;
const BRAND_B = 254;

export function AnimatedBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let w = 0;
    let h = 0;

    const particles: Particle[] = [];
    const charts: ChartLine[] = [];
    const PARTICLE_COUNT = 50;
    const CONNECTION_DIST = 130;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function init() {
      resize();
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.8 + 0.8,
          opacity: Math.random() * 0.4 + 0.15,
        });
      }

      charts.length = 0;
      const alphas = [0.18, 0.12, 0.08, 0.06];
      for (let i = 0; i < 4; i++) {
        charts.push({
          offset: Math.random() * Math.PI * 2,
          speed: 0.002 + Math.random() * 0.003,
          amplitude: 15 + Math.random() * 30,
          frequency: 0.003 + Math.random() * 0.003,
          y: h * (0.3 + i * 0.15),
          color: `rgba(${BRAND_R}, ${BRAND_G}, ${BRAND_B}, ${alphas[i]})`,
          width: 1.2 + Math.random() * 0.8,
        });
      }
    }

    let t = 0;
    function draw() {
      t++;
      ctx!.clearRect(0, 0, w, h);

      // flowing chart lines
      for (const c of charts) {
        c.offset += c.speed;
        ctx!.beginPath();
        ctx!.strokeStyle = c.color;
        ctx!.lineWidth = c.width;
        for (let x = 0; x <= w; x += 3) {
          const y =
            c.y +
            Math.sin(x * c.frequency + c.offset) * c.amplitude +
            Math.sin(x * c.frequency * 2.3 + c.offset * 1.7) *
              (c.amplitude * 0.3);
          if (x === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.stroke();

        // filled area under chart
        ctx!.lineTo(w, h);
        ctx!.lineTo(0, h);
        ctx!.closePath();
        const grad = ctx!.createLinearGradient(0, c.y - c.amplitude, 0, h);
        grad.addColorStop(
          0,
          `rgba(${BRAND_R}, ${BRAND_G}, ${BRAND_B}, 0.04)`
        );
        grad.addColorStop(1, "transparent");
        ctx!.fillStyle = grad;
        ctx!.fill();
      }

      // bar chart columns (faint)
      const barCount = 24;
      const barW = w / barCount;
      for (let i = 0; i < barCount; i++) {
        const barH =
          (Math.sin(i * 0.5 + t * 0.008) * 0.5 + 0.5) * h * 0.2 +
          h * 0.01;
        const x = i * barW + barW * 0.2;
        const bw = barW * 0.6;
        const a = 0.025 + Math.sin(i * 0.7 + t * 0.01) * 0.01;
        ctx!.fillStyle = `rgba(${BRAND_R}, ${BRAND_G}, ${BRAND_B}, ${a})`;
        ctx!.fillRect(x, h - barH, bw, barH);
      }

      // particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      }

      // connections
      ctx!.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha =
              (1 - dist / CONNECTION_DIST) *
              0.12 *
              particles[i].opacity *
              particles[j].opacity;
            ctx!.strokeStyle = `rgba(${BRAND_R}, ${BRAND_G}, ${BRAND_B}, ${alpha})`;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      // particle dots
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${BRAND_R}, ${BRAND_G}, ${BRAND_B}, ${p.opacity})`;
        ctx!.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    init();
    raf = requestAnimationFrame(draw);

    const onResize = () => {
      resize();
      for (let i = 0; i < charts.length; i++) {
        charts[i].y = h * (0.3 + i * 0.15);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ opacity: 0.8 }}
    />
  );
}
