import { useMemo, useRef, useState } from "react";
import type { PaneId } from "../types/pdf";
import {
  type DrawPoint,
  type DrawStroke,
  usePdfDrawingStore,
} from "../store/pdfDrawingStore";

type FreehandDrawLayerProps = {
  pane: PaneId;
  pageNumber: number;
  width: number;
  height: number;
};

function createStrokeId() {
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pointsToPath(points: DrawPoint[], width: number, height: number) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const x = point.x * width;
      const y = point.y * height;

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function arePointsClose(a: DrawPoint, b: DrawPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy) < 0.001;
}

export function FreehandDrawLayer({
  pane,
  pageNumber,
  width,
  height,
}: FreehandDrawLayerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activePointerIdRef = useRef<number | null>(null);
  const drawingFinishedRef = useRef(false);
  const draftPointsRef = useRef<DrawPoint[]>([]);

  const drawingMode = usePdfDrawingStore((state) => state.drawingMode);
  const penColor = usePdfDrawingStore((state) => state.penColor);
  const penWidth = usePdfDrawingStore((state) => state.penWidth);
  const strokes = usePdfDrawingStore((state) => state.strokes);
  const addStroke = usePdfDrawingStore((state) => state.addStroke);

  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<DrawPoint[]>([]);

  const pageStrokes = useMemo(() => {
    return strokes.filter(
      (stroke) => stroke.pane === pane && stroke.page === pageNumber
    );
  }, [strokes, pane, pageNumber]);

  const getPointFromEvent = (
    event: React.PointerEvent<SVGSVGElement>
  ): DrawPoint | null => {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    const rect = svg.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, event.clientY - rect.top), rect.height);

    return {
      x: x / rect.width,
      y: y / rect.height,
    };
  };

  const updateDraftPoints = (nextPoints: DrawPoint[]) => {
    draftPointsRef.current = nextPoints;
    setDraftPoints(nextPoints);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const point = getPointFromEvent(event);

    if (!point) {
      return;
    }

    activePointerIdRef.current = event.pointerId;
    drawingFinishedRef.current = false;

    setIsDrawing(true);
    updateDraftPoints([point]);

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingMode || !isDrawing) {
      return;
    }

    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const point = getPointFromEvent(event);

    if (!point) {
      return;
    }

    const currentPoints = draftPointsRef.current;
    const lastPoint = currentPoints[currentPoints.length - 1];

    if (lastPoint && arePointsClose(lastPoint, point)) {
      return;
    }

    updateDraftPoints([...currentPoints, point]);
  };

  const finishDrawing = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingMode || !isDrawing) {
      return;
    }

    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    if (drawingFinishedRef.current) {
      return;
    }

    drawingFinishedRef.current = true;

    event.preventDefault();
    event.stopPropagation();

    const currentPoints = draftPointsRef.current;

    setIsDrawing(false);
    activePointerIdRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (currentPoints.length >= 2) {
      const stroke: DrawStroke = {
        id: createStrokeId(),
        pane,
        page: pageNumber,
        color: penColor,
        width: penWidth,
        points: currentPoints,
      };

      addStroke(stroke);
    }

    updateDraftPoints([]);
  };

  return (
    <svg
      ref={svgRef}
      className={
        drawingMode
          ? "freehand-draw-layer active"
          : "freehand-draw-layer"
      }
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrawing}
      onPointerCancel={finishDrawing}
      onLostPointerCapture={(event) => {
        if (isDrawing) {
          finishDrawing(event);
        }
      }}
    >
      {pageStrokes.map((stroke) => (
        <path
          key={stroke.id}
          d={pointsToPath(stroke.points, width, height)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {draftPoints.length > 0 && (
        <path
          d={pointsToPath(draftPoints, width, height)}
          fill="none"
          stroke={penColor}
          strokeWidth={penWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}