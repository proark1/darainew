import { useEffect, useRef, useState } from 'react';

type BackgroundStyle = 'orbs' | 'matrix' | 'nebula';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  style?: BackgroundStyle;
}

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  hue: number;
  phase: number;
}

interface MatrixParticle {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  hue: number;
  rotation: number;
  rotationSpeed: number;
  pulsePhase: number;
}

export function AudioVisualizer({ isActive, isSpeaking, isListening, style = 'orbs' }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const orbsRef = useRef<Orb[]>([]);
  const matrixParticlesRef = useRef<MatrixParticle[]>([]);
  const nebulaCloudsRef = useRef<NebulaCloud[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  // Watch for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize orbs
    const orbCount = 5;
    orbsRef.current = Array.from({ length: orbCount }, (_, i) => ({
      x: 0.5,
      y: 0.5,
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      radius: 0.15 + Math.random() * 0.1,
      baseRadius: 0.15 + Math.random() * 0.1,
      hue: isSpeaking ? 270 + i * 15 : 180 + i * 20,
      phase: (i / orbCount) * Math.PI * 2,
    }));

    // Initialize matrix particles
    const particleCount = 100;
    matrixParticlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.001 + Math.random() * 0.003,
      length: 0.02 + Math.random() * 0.05,
      opacity: 0.3 + Math.random() * 0.7,
    }));

    // Initialize nebula clouds
    const cloudCount = 6;
    nebulaCloudsRef.current = Array.from({ length: cloudCount }, (_, i) => ({
      x: 0.3 + Math.random() * 0.4,
      y: 0.3 + Math.random() * 0.4,
      radius: 0.2 + Math.random() * 0.15,
      hue: 220 + i * 30,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.005,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    let time = 0;

    const animateOrbs = (width: number, height: number, centerX: number, centerY: number, minDim: number) => {
      const baseHue = isSpeaking ? 270 : isListening ? 187 : 220;
      const saturation = isDarkMode ? 70 : 80;
      const baseLightness = isDarkMode ? 50 : 40;
      const glowOpacity = isDarkMode ? 0.6 : 0.8;

      orbsRef.current.forEach((orb, i) => {
        orb.x += orb.vx + Math.sin(time + orb.phase) * 0.003;
        orb.y += orb.vy + Math.cos(time * 0.8 + orb.phase) * 0.003;
        orb.x += (0.5 - orb.x) * 0.01;
        orb.y += (0.5 - orb.y) * 0.01;

        const breathe = Math.sin(time * 2 + orb.phase) * 0.03;
        const activityPulse = isActive ? Math.sin(time * 4 + i) * 0.05 : 0;
        orb.radius = orb.baseRadius + breathe + activityPulse;

        const targetHue = isSpeaking ? 270 + i * 15 : 180 + i * 20;
        orb.hue += (targetHue - orb.hue) * 0.02;

        const orbX = orb.x * width;
        const orbY = orb.y * height;
        const orbRadius = orb.radius * minDim;

        for (let layer = 3; layer >= 0; layer--) {
          const layerRadius = orbRadius * (1 + layer * 0.5);
          const layerOpacity = glowOpacity * (0.4 - layer * 0.1);

          const gradient = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, layerRadius);
          const lightness = baseLightness + layer * 5;
          gradient.addColorStop(0, `hsla(${orb.hue}, ${saturation}%, ${lightness + 20}%, ${layerOpacity})`);
          gradient.addColorStop(0.3, `hsla(${orb.hue}, ${saturation}%, ${lightness + 10}%, ${layerOpacity * 0.7})`);
          gradient.addColorStop(0.6, `hsla(${orb.hue}, ${saturation - 10}%, ${lightness}%, ${layerOpacity * 0.3})`);
          gradient.addColorStop(1, 'transparent');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(orbX, orbY, layerRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Central energy core
      const coreBreath = 1 + Math.sin(time * 1.5) * 0.2;
      const coreRadius = minDim * 0.08 * coreBreath;

      for (let layer = 4; layer >= 0; layer--) {
        const layerRadius = coreRadius * (1 + layer * 0.8);
        const layerOpacity = (isActive ? 0.5 : 0.3) * (0.5 - layer * 0.1);

        const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, layerRadius);
        const coreLightness = baseLightness + 20 - layer * 3;
        coreGradient.addColorStop(0, `hsla(${baseHue}, ${saturation + 10}%, ${coreLightness + 15}%, ${layerOpacity * glowOpacity})`);
        coreGradient.addColorStop(0.4, `hsla(${baseHue}, ${saturation}%, ${coreLightness + 5}%, ${layerOpacity * 0.6 * glowOpacity})`);
        coreGradient.addColorStop(0.7, `hsla(${baseHue}, ${saturation - 10}%, ${coreLightness}%, ${layerOpacity * 0.3 * glowOpacity})`);
        coreGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, layerRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating particles
      const particleCount = isActive ? 30 : 15;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time * 0.3;
        const dist = minDim * (0.15 + Math.sin(time * 2 + i * 0.5) * 0.08);
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;
        const size = 2 + Math.sin(time * 3 + i) * 1.5;

        const particleGradient = ctx.createRadialGradient(px, py, 0, px, py, size * 3);
        const particleOpacity = (0.4 + Math.sin(time * 4 + i * 0.3) * 0.2) * glowOpacity;
        
        particleGradient.addColorStop(0, `hsla(${baseHue + i * 3}, ${saturation}%, ${baseLightness + 20}%, ${particleOpacity})`);
        particleGradient.addColorStop(0.5, `hsla(${baseHue + i * 3}, ${saturation}%, ${baseLightness + 10}%, ${particleOpacity * 0.4})`);
        particleGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = particleGradient;
        ctx.beginPath();
        ctx.arc(px, py, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ambient outer glow
      const ambientGradient = ctx.createRadialGradient(centerX, centerY, minDim * 0.1, centerX, centerY, minDim * 0.5);
      const ambientOpacity = (isActive ? 0.15 : 0.08) * glowOpacity;
      ambientGradient.addColorStop(0, `hsla(${baseHue}, ${saturation - 20}%, ${baseLightness + 10}%, ${ambientOpacity})`);
      ambientGradient.addColorStop(0.5, `hsla(${baseHue}, ${saturation - 30}%, ${baseLightness}%, ${ambientOpacity * 0.4})`);
      ambientGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = ambientGradient;
      ctx.fillRect(0, 0, width, height);
    };

    const animateMatrix = (width: number, height: number, centerX: number, centerY: number) => {
      const baseHue = isSpeaking ? 280 : isListening ? 160 : 200;
      const intensity = isActive ? 1 : 0.5;

      // Draw falling digital rain
      matrixParticlesRef.current.forEach((particle) => {
        particle.y += particle.speed * (isActive ? 2 : 1);
        if (particle.y > 1 + particle.length) {
          particle.y = -particle.length;
          particle.x = Math.random();
        }

        const x = particle.x * width;
        const yStart = (particle.y - particle.length) * height;
        const yEnd = particle.y * height;

        const gradient = ctx.createLinearGradient(x, yStart, x, yEnd);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.5, `hsla(${baseHue}, 80%, 60%, ${particle.opacity * intensity * 0.3})`);
        gradient.addColorStop(1, `hsla(${baseHue}, 90%, 70%, ${particle.opacity * intensity * 0.6})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, yStart);
        ctx.lineTo(x, yEnd);
        ctx.stroke();
      });

      // Central pulse grid
      const gridSize = 40;
      const pulseRadius = (Math.sin(time * 2) * 0.3 + 0.7) * Math.min(width, height) * 0.4;
      
      for (let x = 0; x < width; x += gridSize) {
        for (let y = 0; y < height; y += gridSize) {
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (dist < pulseRadius) {
            const opacity = (1 - dist / pulseRadius) * 0.3 * intensity;
            ctx.fillStyle = `hsla(${baseHue}, 70%, 50%, ${opacity})`;
            ctx.fillRect(x - 1, y - 1, 3, 3);
          }
        }
      }

      // Horizontal scan lines
      const scanY = ((time * 0.3) % 1) * height;
      const scanGradient = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      scanGradient.addColorStop(0, 'transparent');
      scanGradient.addColorStop(0.5, `hsla(${baseHue}, 80%, 60%, ${0.15 * intensity})`);
      scanGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGradient;
      ctx.fillRect(0, scanY - 30, width, 60);
    };

    const animateNebula = (width: number, height: number, centerX: number, centerY: number, minDim: number) => {
      const baseHue = isSpeaking ? 300 : isListening ? 200 : 260;
      const intensity = isActive ? 1.2 : 0.7;

      nebulaCloudsRef.current.forEach((cloud, i) => {
        cloud.rotation += cloud.rotationSpeed * (isActive ? 1.5 : 1);
        
        // Slowly drift
        cloud.x += Math.sin(time * 0.5 + i) * 0.001;
        cloud.y += Math.cos(time * 0.3 + i) * 0.001;
        
        // Keep in bounds
        cloud.x = Math.max(0.2, Math.min(0.8, cloud.x));
        cloud.y = Math.max(0.2, Math.min(0.8, cloud.y));

        const cx = cloud.x * width;
        const cy = cloud.y * height;
        const pulse = 1 + Math.sin(time * 1.5 + cloud.pulsePhase) * 0.2;
        const radius = cloud.radius * minDim * pulse;

        // Draw spiral arms
        for (let arm = 0; arm < 3; arm++) {
          const armAngle = cloud.rotation + (arm * Math.PI * 2 / 3);
          
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(armAngle);

          for (let j = 0; j < 30; j++) {
            const dist = (j / 30) * radius;
            const spiralAngle = j * 0.15;
            const px = Math.cos(spiralAngle) * dist;
            const py = Math.sin(spiralAngle) * dist;
            const size = (1 - j / 30) * 15 * intensity;
            const opacity = (1 - j / 30) * 0.3 * intensity;

            const hue = cloud.hue + j * 2;
            ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${opacity})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }

        // Core glow
        const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.3);
        coreGradient.addColorStop(0, `hsla(${cloud.hue + 30}, 80%, 70%, ${0.4 * intensity})`);
        coreGradient.addColorStop(0.5, `hsla(${cloud.hue}, 70%, 50%, ${0.2 * intensity})`);
        coreGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Twinkling stars
      for (let i = 0; i < 50; i++) {
        const starX = (Math.sin(i * 17.3) * 0.5 + 0.5) * width;
        const starY = (Math.cos(i * 23.7) * 0.5 + 0.5) * height;
        const twinkle = Math.sin(time * 3 + i * 2) * 0.5 + 0.5;
        const size = twinkle * 2 + 1;

        ctx.fillStyle = `hsla(${baseHue + i * 5}, 50%, 80%, ${twinkle * 0.6 * intensity})`;
        ctx.beginPath();
        ctx.arc(starX, starY, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central energy burst
      if (isActive) {
        const burstRadius = minDim * 0.15 * (1 + Math.sin(time * 3) * 0.2);
        const burstGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, burstRadius);
        burstGradient.addColorStop(0, `hsla(${baseHue + 30}, 90%, 70%, 0.4)`);
        burstGradient.addColorStop(0.5, `hsla(${baseHue}, 80%, 50%, 0.2)`);
        burstGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = burstGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, burstRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const minDim = Math.min(width, height);

      ctx.clearRect(0, 0, width, height);
      time += 0.004;

      switch (style) {
        case 'matrix':
          animateMatrix(width, height, centerX, centerY);
          break;
        case 'nebula':
          animateNebula(width, height, centerX, centerY, minDim);
          break;
        case 'orbs':
        default:
          animateOrbs(width, height, centerX, centerY, minDim);
          break;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isSpeaking, isListening, isDarkMode, style]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
