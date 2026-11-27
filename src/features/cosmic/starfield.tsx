import { useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/prng";

const SEED = 0xc05a1c;

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    type Star = { x: number; y: number; r: number; a: number; tw: number };
    type Nebula = { x: number; y: number; r: number; color: string };
    let stars: Star[] = [];
    let nebulae: Nebula[] = [];

    function rebuild() {
      const rnd = mulberry32(SEED);
      stars = Array.from({ length: 180 }, () => ({
        x: rnd(),
        y: rnd(),
        r: 0.4 + rnd() * 1.6,
        a: 0.25 + rnd() * 0.7,
        tw: rnd() * Math.PI * 2,
      }));
      nebulae = [
        { x: 0.28, y: 0.35, r: 0.42, color: "rgba(120,60,180,0.22)" },
        { x: 0.72, y: 0.55, r: 0.48, color: "rgba(90,40,140,0.18)" },
        { x: 0.55, y: 0.22, r: 0.32, color: "rgba(180,70,140,0.14)" },
        { x: 0.18, y: 0.72, r: 0.36, color: "rgba(50,80,180,0.12)" },
      ];
    }

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!stars.length) rebuild();
    }

    function draw(t: number) {
      if (!ctx || !width) return;
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#0a0614");
      bg.addColorStop(0.45, "#12081f");
      bg.addColorStop(1, "#07040e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      for (const n of nebulae) {
        const gx = n.x * width;
        const gy = n.y * height;
        const gr = n.r * Math.max(width, height);
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, n.color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      for (const s of stars) {
        const pulse = 0.65 + 0.35 * Math.sin(t * 0.0012 + s.tw);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${s.a * pulse})`;
        ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="cosmic-starfield" aria-hidden="true" />;
}
