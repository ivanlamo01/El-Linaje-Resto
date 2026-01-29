"use client";

import React, { useEffect, useState } from "react";

// Types
type Shape = {
  id: string; // Unique ID to force re-render
  type: "circle" | "square" | "triangle" | "diamond" | "bar";
  left: number; // %
  top: number; // %
  size: number; // px
  height: number; // px
  color: string;
  rotation: number;
};

const BackgroundPattern = () => {
  const [currentShapes, setCurrentShapes] = useState<Shape[]>([]);

  useEffect(() => {
    // Request: 
    // - "Aparecer y desaparecer fijas en distintos lados"
    // - "Salen 3 figuras aleatorias"
    // - "Estan 5 segundos, se difuminan en 2 segundos" (Total cycle ~7s)
    // - "Aparecen otras 3"

    const colors = ["#607D8B", "#A0522D", "#5D4037"]; 
    const types = ["circle", "square", "triangle", "diamond", "bar"] as const;

    const generateShapes = () => {
       const newShapes: Shape[] = [];
       const timestamp = Date.now();
       
       let leftCount = 0;
       let rightCount = 0;

       for (let i = 0; i < 3; i++) {
           let side: 'left' | 'right';
           
           // Logic: Randomly pick a side, but enforce "Max 2 per side" rule
           if (leftCount >= 2) {
               side = 'right';
           } else if (rightCount >= 2) {
               side = 'left';
           } else {
               side = Math.random() < 0.5 ? 'left' : 'right';
           }

           // Increment counters
           if (side === 'left') leftCount++;
           else rightCount++;

           // Generate Position based on Side
           // Left Margin: 5% - 20%
           // Right Margin: 80% - 95%
           // Avoid extreme edges (0 or 100) to prevent overflow/cutoff
           let left;
           if (side === 'left') {
               left = 5 + Math.random() * 15; 
           } else {
               left = 80 + Math.random() * 15;
           }

           // Vertical positioning: Random 10-90%
           const top = 10 + Math.random() * 80;

           newShapes.push(createShape(i, { fixedLeft: left, fixedTop: top }, timestamp));
       }
       
       setCurrentShapes(newShapes);
    };
    
    // Helper to create a consistent shape object
    const createShape = (index: number, pos: { fixedLeft?: number, fixedTop?: number }, time: number): Shape => {
        const type = types[Math.floor(Math.random() * types.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Large Sizes
        let size = 200 + Math.random() * 100; 
        let height = size;
        
        // Request: "Todas las figuras aparezcan en diferentes angulos" -> 360 rotation
        // Fix: Use full range.
        let rotation = Math.random() * 360; 

        if (type === "bar") {
            size = 40 + Math.random() * 30; // 40-70px width
            height = 400 + Math.random() * 200; 
        }
        
        return {
            id: `${time}-${index}`,
            type,
            left: pos.fixedLeft ?? 0,
            top: pos.fixedTop ?? 0,
            size,
            height,
            color,
            rotation
        };
    };

    // Initial spawn
    generateShapes();

    // Cycle every 7 seconds
    const interval = setInterval(generateShapes, 7000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none select-none bg-background transition-colors duration-500">
      {/* Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/p6.png')] mix-blend-overlay"></div>

      {currentShapes.map((shape) => (
        <div
          key={shape.id}
          className="absolute animate-fade-cycle mix-blend-multiply dark:mix-blend-normal"
          style={{
             left: `${shape.left}%`,
             top: `${shape.top}%`,
             width: `${shape.size}px`,
             height: `${shape.height}px`,
             color: shape.color,
             animationDuration: "7000ms"
             // TRANSFORM REMOVED HERE to avoid conflict with animate-fade-cycle scale()
          }}
        >
           {/* Inner wrapper handles ROTATION independently from parent's SCALE animation */}
           <div 
              className="w-full h-full opacity-[0.4] dark:opacity-[0.25]"
              style={{ transform: `rotate(${shape.rotation}deg)` }} 
           >
              <ShapeSVG type={shape.type} color={shape.color} />
           </div>
        </div>
      ))}
    </div>
  );
};

const ShapeSVG = ({ type, color }: { type: string, color: string }) => {
  switch (type) {
    case "circle":
      return (
        <svg viewBox="0 0 100 100" fill={color} className="w-full h-full">
          <circle cx="50" cy="50" r="50" />
        </svg>
      );
    case "square":
       return (
        <svg viewBox="0 0 100 100" fill={color} className="w-full h-full">
          <rect width="100" height="100" />
        </svg>
      );
    case "diamond":
       return (
        <svg viewBox="0 0 100 100" fill={color} className="w-full h-full transform rotate-45 scale-75">
          <rect width="100" height="100" />
        </svg>
      );
    case "triangle":
       return (
        <svg viewBox="0 0 100 100" fill={color} className="w-full h-full">
          <polygon points="50,0 100,100 0,100" />
        </svg>
      );
    case "bar":
        // Viewbox customized for vertical bar
       return (
        <svg viewBox="0 0 20 200" preserveAspectRatio="none" fill={color} className="w-full h-full">
           <rect width="20" height="200" />
        </svg>
       );
    default:
      return null;
  }
};

export default BackgroundPattern;
