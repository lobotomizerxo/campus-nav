"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import Image, { type StaticImageData } from "next/image";

import buildingIcon from "./assets/icons/Building Icon.webp";
import canteenIcon from "./assets/icons/Canteen Icon.webp";
import courtIcon from "./assets/icons/Court Icon.webp";
import destinationIcon from "./assets/icons/Destination Icon.webp";
import fenceIcon from "./assets/icons/Fence Icon.webp";
import flagPoleIcon from "./assets/icons/Flag Pole Icon.webp";
import fountainIcon from "./assets/icons/Fountain Icon.webp";
import gateIcon from "./assets/icons/Gate Icon.webp";
import groundIcon from "./assets/icons/Ground Icon.webp";
import guardhouseIcon from "./assets/icons/Guardhouse Icon.webp";
import obstacleIcon from "./assets/icons/Obstacle Icon.webp";
import parkingIcon from "./assets/icons/Parking Icon.webp";
import pedestrianIcon from "./assets/icons/Pedestrian Icon.webp";
import roadIcon from "./assets/icons/Road Icon.webp";
import sidewalkIcon from "./assets/icons/Sidewalk Icon.webp";
import stageIcon from "./assets/icons/Stage Icon.webp";
import stallIcon from "./assets/icons/Stall Icon.webp";
import startIcon from "./assets/icons/Start Icon.webp";
import treeIcon from "./assets/icons/Tree Icon.webp";
import walkingPathIcon from "./assets/icons/Walking Path Icon.webp";
import wallIcon from "./assets/icons/Wall Icon.webp";

const COLS = 500;
const ROWS = 500;
const CELL = 32;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

type CellType =
  | "ground"
  | "path"
  | "sidewalk"
  | "crosswalk"
  | "road"
  | "court"
  | "wall"
  | "fence"
  | "gate"
  | "door"
  | "tree"
  | "chair"
  | "obstacle"
  | "object";
type TerrainType = Exclude<CellType, "object">;
type ObjectKind = "building" | "canteen" | "stall" | "flagpole" | "fountain" | "stage" | "parking" | "guardhouse";
type Tool = TerrainType | ObjectKind | "start" | "destination" | "eraser" | "text" | "none";
type Algorithm = "dfs" | "bfs" | "dijkstra";
type Point = { x: number; y: number };
type Grid = CellType[][];
type Destination = Point & { id: number; selected: boolean; color: string };
type Speed = "slow" | "normal" | "fast";
type Phase = "idle" | "explore" | "walk" | "done";
type SearchResult = { found: boolean; route: Point[]; explored: Point[] };
type RouteCell = { p: Point; destId: number };
type RouteInfo = {
  algorithm: Algorithm;
  cells: RouteCell[];
  explored: { p: Point; destId: number }[];
  steps: number;
  cost: number;
  order: string[];
  unreachable: number[];
};
type Message = { text: string; kind: "error" | "info" | "success" };
type TextLabel = Point & { text: string };
type PlacedObject = { id: number; kind: ObjectKind; x: number; y: number; w: number; h: number };
type Footprint = { x: number; y: number; w: number; h: number };
type DragRect = { x0: number; y0: number; x1: number; y1: number };
type SearchBounds = { minX: number; minY: number; maxX: number; maxY: number };
type HistoryState = {
  grid: Grid;
  start: Point | null;
  destinations: Destination[];
  labels: TextLabel[];
  objects: PlacedObject[];
};
type SavedMap = { id: string; name: string; updatedAt: string; map: HistoryState };

type IconType = string | StaticImageData;

const OBJECTS: Record<ObjectKind, { label: string; icon: string; toolIcon?: StaticImageData; w: number; h: number; fill: string; stroke: string }> = {
  building: { label: "Building", icon: "🏢", toolIcon: buildingIcon, w: 5, h: 4, fill: "#c7694f", stroke: "#8f3f2a" },
  canteen: { label: "Canteen", icon: "🍽️", toolIcon: canteenIcon, w: 6, h: 3, fill: "#e9a23b", stroke: "#a86d10" },
  stall: { label: "Stall", icon: "🏪", toolIcon: stallIcon, w: 2, h: 1, fill: "#f2c94c", stroke: "#a98a1c" },
  flagpole: { label: "Flag Pole", icon: "🚩", toolIcon: flagPoleIcon, w: 1, h: 1, fill: "#e2e8f0", stroke: "#94a3b8" },
  fountain: { label: "Fountain", icon: "⛲", toolIcon: fountainIcon, w: 2, h: 2, fill: "#7dd3fc", stroke: "#0284c7" },
  stage: { label: "Stage", icon: "🎤", toolIcon: stageIcon, w: 6, h: 3, fill: "#a78bfa", stroke: "#6d28d9" },
  parking: { label: "Parking", icon: "🅿️", toolIcon: parkingIcon, w: 4, h: 2, fill: "#94a3b8", stroke: "#475569" },
  guardhouse: { label: "Guard House", icon: "🏠", toolIcon: guardhouseIcon, w: 2, h: 2, fill: "#cbd5e1", stroke: "#64748b" },
};

const OBJECT_KINDS = Object.keys(OBJECTS) as ObjectKind[];

const TOOL_GROUPS: { title: string; tools: { id: Tool; label: string; icon: IconType }[] }[] = [
  {
    title: "Surfaces",
    tools: [
      { id: "ground", label: "Ground", icon: groundIcon },
      { id: "path", label: "Walking Path", icon: walkingPathIcon },
      { id: "sidewalk", label: "Sidewalk", icon: sidewalkIcon },
      { id: "crosswalk", label: "Pedestrian Lane", icon: pedestrianIcon },
      { id: "road", label: "Road", icon: roadIcon },
      { id: "court", label: "Court", icon: courtIcon },
    ],
  },
  {
    title: "Barriers & openings",
    tools: [
      { id: "wall", label: "Wall", icon: wallIcon },
      { id: "fence", label: "Fence", icon: fenceIcon },
      { id: "door", label: "Door", icon: "🚪" },
      { id: "gate", label: "Gate", icon: gateIcon },
    ],
  },
  {
    title: "Objects (any size)",
    tools: OBJECT_KINDS.map((k) => ({ id: k as Tool, label: OBJECTS[k].label, icon: OBJECTS[k].toolIcon ?? OBJECTS[k].icon })),
  },
  {
    title: "Small items",
    tools: [
      { id: "tree", label: "Tree", icon: treeIcon },
      { id: "chair", label: "Chair", icon: "🪑" },
      { id: "obstacle", label: "Obstacle", icon: obstacleIcon },
    ],
  },
  {
    title: "Markers & tools",
    tools: [
      { id: "start", label: "Start", icon: startIcon },
      { id: "destination", label: "Destination", icon: destinationIcon },
      { id: "eraser", label: "Eraser", icon: "🧽" },
      { id: "text", label: "Text Label", icon: "📝" },
      { id: "none", label: "Pointer", icon: "👆" },
    ],
  },
];

const COLOR_PALETTE = ["#2563eb", "#16a34a", "#f97316", "#9333ea", "#db2777", "#0891b2"];

const SPEED_FACTOR: Record<Speed, number> = { slow: 2.5, normal: 1, fast: 0.35 };

const ALGORITHM_NAMES: Record<Algorithm, string> = {
  dfs: "Depth-First Search (DFS)",
  bfs: "Breadth-First Search (BFS)",
  dijkstra: "Dijkstra's Algorithm",
};

const CELL_COLORS: Record<TerrainType, string> = {
  ground: "#cdeab0",
  path: "#f3e9d2",
  sidewalk: "#d4d4d8",
  crosswalk: "#3f3f46",
  road: "#3f3f46",
  court: "#d98a5b",
  wall: "#4b5563",
  fence: "#cdeab0",
  gate: "#f3e9d2",
  door: "#7c4a1e",
  tree: "#cdeab0",
  chair: "#cdeab0",
  obstacle: "#a1a1aa",
};

const CELL_ICONS: Partial<Record<TerrainType, StaticImageData | string>> = {
  chair: "🪑",
  tree: treeIcon,
  door: "🚪",
  obstacle: obstacleIcon,
};

const CROSSWALK_BACKGROUND = "repeating-linear-gradient(0deg, #f8fafc 0 3px, #3f3f46 3px 6px)";

const LEGEND: { label: string; color: string; round?: boolean; text?: string; icon?: StaticImageData | string }[] = [
  { label: "Walking path (cost 1)", color: "#f3e9d2", icon: walkingPathIcon },
  { label: "Sidewalk (cost 1)", color: "#d4d4d8", icon: sidewalkIcon },
  { label: "Pedestrian lane (cost 1)", color: CROSSWALK_BACKGROUND, icon: pedestrianIcon },
  { label: "Door or gate (cost 1)", color: "#7c4a1e", icon: gateIcon },
  { label: "Ground (cost 3)", color: "#cdeab0", icon: groundIcon },
  { label: "Court (cost 3)", color: "#d98a5b", icon: courtIcon },
  { label: "Road (blocked, cross at a pedestrian lane)", color: "#3f3f46", icon: roadIcon },
  { label: "Wall, fence, tree, obstacle, objects (blocked)", color: "#4b5563", icon: wallIcon },
  { label: "Start", color: "#7c3aed", round: true, text: "S", icon: startIcon },
  { label: "Destination (its color is the leg ending there)", color: "#2563eb", round: true, text: "D1", icon: destinationIcon },
  { label: "Route leg", color: "#16a34a" },
  { label: "Cells explored by the search", color: "#f59e0b" },
];

const smallButton =
  "rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";
const SAVED_MAPS_KEY = "campus-nav-saved-maps";

function createEmptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array<CellType>(COLS).fill("ground"));
}

function fillArea(grid: Grid, x1: number, y1: number, x2: number, y2: number, type: TerrainType) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      grid[y][x] = type;
    }
  }
}

function createSampleMap(): Grid {
  const g = createEmptyGrid();

  fillArea(g, 0, 19, 30, 20, "road");
  fillArea(g, 0, 18, 30, 18, "sidewalk");
  fillArea(g, 0, 21, 30, 21, "sidewalk");
  fillArea(g, 14, 19, 15, 20, "crosswalk");

  fillArea(g, 1, 1, 29, 1, "fence");
  fillArea(g, 1, 17, 29, 17, "fence");
  fillArea(g, 1, 1, 1, 17, "fence");
  fillArea(g, 29, 1, 29, 17, "fence");
  g[17][14] = "gate";

  fillArea(g, 14, 3, 14, 16, "path");
  fillArea(g, 3, 9, 26, 9, "path");

  g[6][7] = "door";
  fillArea(g, 7, 7, 7, 8, "path");
  g[6][21] = "door";
  fillArea(g, 21, 7, 21, 8, "path");
  g[12][6] = "door";
  fillArea(g, 6, 10, 6, 11, "path");

  fillArea(g, 20, 13, 27, 16, "court");

  const trees = [[9, 8], [12, 8], [17, 8], [19, 8], [3, 16], [18, 16], [12, 16]];
  for (const [x, y] of trees) g[y][x] = "tree";

  const chairs = [[12, 10], [16, 10]];
  for (const [x, y] of chairs) g[y][x] = "chair";

  return g;
}

function createSampleObjects(): PlacedObject[] {
  return [
    { id: 1, kind: "building", x: 3, y: 3, w: 9, h: 4 },
    { id: 2, kind: "building", x: 17, y: 3, w: 9, h: 4 },
    { id: 3, kind: "canteen", x: 3, y: 12, w: 6, h: 3 },
    { id: 4, kind: "stall", x: 10, y: 11, w: 4, h: 1 },
    { id: 5, kind: "stall", x: 16, y: 12, w: 2, h: 1 },
    { id: 6, kind: "flagpole", x: 13, y: 13, w: 1, h: 1 },
    { id: 7, kind: "fountain", x: 9, y: 15, w: 2, h: 2 },
    { id: 8, kind: "guardhouse", x: 16, y: 15, w: 2, h: 2 },
  ];
}

function createSampleDestinations(): Destination[] {
  return [
    { id: 1, x: 7, y: 6, selected: true, color: COLOR_PALETTE[0] },
    { id: 2, x: 21, y: 6, selected: true, color: COLOR_PALETTE[1] },
    { id: 3, x: 6, y: 12, selected: true, color: COLOR_PALETTE[2] },
  ];
}

const SAMPLE_START: Point = { x: 5, y: 21 };

// ==============================
// SHARED HELPERS
// ==============================

const key = (p: Point) => p.y * COLS + p.x;
const toPoint = (k: number): Point => ({ x: k % COLS, y: Math.floor(k / COLS) });
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const WALKABLE = new Set<CellType>(["ground", "path", "sidewalk", "crosswalk", "court", "door", "gate"]);

function isWalkable(type: CellType): boolean {
  return WALKABLE.has(type);
}

function isObjectKind(t: Tool): t is ObjectKind {
  return t in OBJECTS;
}

function cellCost(type: CellType): number {
  if (!isWalkable(type)) return Infinity;
  return type === "ground" || type === "court" ? 3 : 1;
}

function stepCost(grid: Grid, p: Point, goal: Point): number {
  if (samePoint(p, goal)) return 1;
  return cellCost(grid[p.y][p.x]);
}

function segmentCost(grid: Grid, segment: Point[]): number {
  let total = 0;
  for (let i = 1; i < segment.length; i++) {
    total += i === segment.length - 1 ? 1 : cellCost(grid[segment[i].y][segment[i].x]);
  }
  return total;
}

function priority(type: CellType): number {
  if (type === "path" || type === "sidewalk" || type === "crosswalk") return 0;
  if (type === "door" || type === "gate") return 1;
  return 2;
}

const DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function getSearchBounds(grid: Grid, objects: PlacedObject[], start: Point, destinations: Destination[]): SearchBounds {
  let minX = start.x;
  let minY = start.y;
  let maxX = start.x;
  let maxY = start.y;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === "ground") continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  for (const object of objects) {
    minX = Math.min(minX, object.x);
    minY = Math.min(minY, object.y);
    maxX = Math.max(maxX, object.x + object.w - 1);
    maxY = Math.max(maxY, object.y + object.h - 1);
  }

  for (const destination of destinations) {
    minX = Math.min(minX, destination.x);
    minY = Math.min(minY, destination.y);
    maxX = Math.max(maxX, destination.x);
    maxY = Math.max(maxY, destination.y);
  }

  return {
    minX: Math.max(0, minX - 1),
    minY: Math.max(0, minY - 1),
    maxX: Math.min(COLS - 1, maxX + 1),
    maxY: Math.min(ROWS - 1, maxY + 1),
  };
}

function getNeighbors(p: Point, grid: Grid, bounds: SearchBounds): Point[] {
  const result: Point[] = [];
  for (const d of DIRECTIONS) {
    const x = p.x + d.x;
    const y = p.y + d.y;
    if (x < bounds.minX || y < bounds.minY || x > bounds.maxX || y > bounds.maxY) continue;
    if (!isWalkable(grid[y][x])) continue;
    result.push({ x, y });
  }

  return result.sort((a, b) => {
    const byRow = a.y - b.y;
    if (byRow !== 0) return byRow;
    const byCol = a.x - b.x;
    if (byCol !== 0) return byCol;
    return priority(grid[a.y][a.x]) - priority(grid[b.y][b.x]);
  });
}

function reconstructRoute(parent: number[], start: Point, goal: Point): Point[] {
  const route: Point[] = [];
  let k = key(goal);
  while (k !== -1) {
    route.push(toPoint(k));
    if (k === key(start)) break;
    k = parent[k];
  }
  return route.reverse();
}

function buildEffectiveGrid(terrain: Grid, objects: PlacedObject[]): Grid {
  const g = terrain.map((row) => row.slice());
  for (const o of objects) {
    for (let y = o.y; y < o.y + o.h; y++) {
      for (let x = o.x; x < o.x + o.w; x++) {
        if (g[y][x] !== "door" && g[y][x] !== "gate") g[y][x] = "object";
      }
    }
  }
  return g;
}

// ==============================
// DFS ALGORITHM
// ==============================

function dfs(start: Point, goal: Point, grid: Grid, bounds: SearchBounds): SearchResult {
  const visited: boolean[] = new Array(COLS * ROWS).fill(false);
  const parent: number[] = new Array(COLS * ROWS).fill(-1);
  const stack: { cell: Point; from: number }[] = [{ cell: start, from: -1 }];
  const explored: Point[] = [];

  while (stack.length > 0) {
    const { cell, from } = stack.pop()!;
    const k = key(cell);
    if (visited[k]) continue;

    visited[k] = true;
    parent[k] = from;
    explored.push(cell);

    if (samePoint(cell, goal)) {
      return { found: true, route: reconstructRoute(parent, start, goal), explored };
    }

    const neighbors = getNeighbors(cell, grid, bounds);
    for (let i = neighbors.length - 1; i >= 0; i--) {
      if (!visited[key(neighbors[i])]) stack.push({ cell: neighbors[i], from: k });
    }
  }

  return { found: false, route: [], explored };
}

// ==============================
// BFS ALGORITHM
// ==============================

function bfs(start: Point, goal: Point, grid: Grid, bounds: SearchBounds): SearchResult {
  const visited: boolean[] = new Array(COLS * ROWS).fill(false);
  const parent: number[] = new Array(COLS * ROWS).fill(-1);
  const queue: Point[] = [start];
  let head = 0;
  const explored: Point[] = [];
  visited[key(start)] = true;

  while (head < queue.length) {
    const cell = queue[head++];
    explored.push(cell);

    if (samePoint(cell, goal)) {
      return { found: true, route: reconstructRoute(parent, start, goal), explored };
    }

    for (const next of getNeighbors(cell, grid, bounds)) {
      const nk = key(next);
      if (!visited[nk]) {
        visited[nk] = true;
        parent[nk] = key(cell);
        queue.push(next);
      }
    }
  }

  return { found: false, route: [], explored };
}

// ==============================
// DIJKSTRA'S ALGORITHM
// ==============================

function dijkstra(start: Point, goal: Point, grid: Grid, bounds: SearchBounds): SearchResult {
  const total = COLS * ROWS;
  const dist: number[] = new Array(total).fill(Infinity);
  const done: boolean[] = new Array(total).fill(false);
  const parent: number[] = new Array(total).fill(-1);
  const open: number[] = [key(start)];
  const goalKey = key(goal);
  const explored: Point[] = [];
  dist[key(start)] = 0;

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (dist[open[i]] < dist[open[best]]) best = i;
    }
    const u = open[best];
    open[best] = open[open.length - 1];
    open.pop();

    done[u] = true;
    explored.push(toPoint(u));

    if (u === goalKey) {
      return { found: true, route: reconstructRoute(parent, start, goal), explored };
    }

    for (const next of getNeighbors(toPoint(u), grid, bounds)) {
      const nk = key(next);
      if (done[nk]) continue;
      const alt = dist[u] + stepCost(grid, next, goal);
      if (alt < dist[nk]) {
        if (dist[nk] === Infinity) open.push(nk);
        dist[nk] = alt;
        parent[nk] = u;
      }
    }
  }

  return { found: false, route: [], explored };
}

// ==============================
// PAGE
// ==============================

export default function Home() {
  const [grid, setGrid] = useState<Grid>(createSampleMap);
  const [objects, setObjects] = useState<PlacedObject[]>(createSampleObjects);
  const [start, setStart] = useState<Point | null>(SAMPLE_START);
  const [destinations, setDestinations] = useState<Destination[]>(createSampleDestinations);
  const [labels, setLabels] = useState<TextLabel[]>([]);
  const [tool, setTool] = useState<Tool>("none");
  const [algorithm, setAlgorithm] = useState<Algorithm>("dijkstra");
  const [result, setResult] = useState<RouteInfo | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [objW, setObjW] = useState(2);
  const [objH, setObjH] = useState(1);
  const [hover, setHover] = useState<Point | null>(null);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);
  const drawing = useRef(false);
  const dragRef = useRef<DragRect | null>(null);
  const commitRef = useRef<() => void>(() => { });
  const savedMapsHydrated = useRef(false);

  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<SVGSVGElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [selectedSavedMap, setSelectedSavedMap] = useState("");

  function pushHistory() {
    setHistory((prev) => {
      const newHistory = [...prev, { grid, start, destinations, labels, objects }];
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SAVED_MAPS_KEY);
      if (stored) setSavedMaps(JSON.parse(stored) as SavedMap[]);
    } catch {
      setMessage({ text: "Saved maps could not be read from this browser.", kind: "error" });
    }
  }, []);

  useEffect(() => {
    if (!savedMapsHydrated.current) {
      savedMapsHydrated.current = true;
      return;
    }
    try {
      window.localStorage.setItem(SAVED_MAPS_KEY, JSON.stringify(savedMaps));
    } catch {
      setMessage({ text: "This map could not be saved. Browser storage may be full.", kind: "error" });
    }
  }, [savedMaps]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        setHistory((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const lastState = copy.pop()!;
          setGrid(lastState.grid);
          setStart(lastState.start);
          setDestinations(lastState.destinations);
          setLabels(lastState.labels);
          setObjects(lastState.objects);
          setResult(null);
          return copy;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerSize({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    commitRef.current = commitDrag;
  });

  useEffect(() => {
    const handlePointerUp = () => {
      drawing.current = false;
      commitRef.current();
    };
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  useEffect(() => {
    if (!result || (phase !== "explore" && phase !== "walk")) return;
    const delay = (phase === "explore" ? 12 : 80) * SPEED_FACTOR[speed];
    const increment =
      phase === "explore" ? Math.max(3, Math.ceil(result.explored.length / 250)) : Math.max(1, Math.ceil(result.cells.length / 120));
    const id = setInterval(() => setStep((current) => current + increment), delay);
    return () => clearInterval(id);
  }, [result, phase, speed]);

  useEffect(() => {
    if (!result) return;
    if (phase === "explore" && step >= result.explored.length) {
      setPhase("walk");
      setStep(1);
    } else if (phase === "walk" && step >= result.cells.length) {
      setPhase("done");
      setMessage({ text: "Route found.", kind: "success" });
    }
  }, [step, phase, result]);

  function fail(text: string) {
    setMessage({ text, kind: "error" });
  }

  function objectAt(x: number, y: number): PlacedObject | undefined {
    return objects.find((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
  }

  function typeAt(x: number, y: number): CellType {
    const t = grid[y][x];
    if (t === "door" || t === "gate") return t;
    return objectAt(x, y) ? "object" : t;
  }

  function markerLabelAt(x: number, y: number): string | null {
    if (start && start.x === x && start.y === y) return "Start";
    const d = destinations.find((dest) => dest.x === x && dest.y === y);
    return d ? `D${d.id}` : null;
  }

  function setCell(x: number, y: number, type: TerrainType) {
    setGrid((prev) =>
      prev.map((row, yy) => (yy === y ? row.map((cell, xx) => (xx === x ? type : cell)) : row))
    );
  }

  function nextDestinationId(list: Destination[]): number {
    let id = 1;
    while (list.some((d) => d.id === id)) id++;
    return id;
  }

  function nextObjectId(list: PlacedObject[]): number {
    return list.reduce((max, o) => Math.max(max, o.id), 0) + 1;
  }

  function moveDestination(to: Point) {
    if (!isWalkable(typeAt(to.x, to.y))) return fail("A destination can't be placed on an obstacle.");
    if (start && samePoint(start, to)) return fail("The start point is already on that cell.");
    if (destinations.some((d) => d.id !== movingId && samePoint(d, to))) {
      return fail("Another destination is already on that cell.");
    }
    setDestinations((prev) => prev.map((d) => (d.id === movingId ? { ...d, x: to.x, y: to.y } : d)));
    setMovingId(null);
    setResult(null);
    setMessage(null);
  }

  function footprintFromDrag(d: DragRect): Footprint {
    const moved = d.x0 !== d.x1 || d.y0 !== d.y1;
    if (!moved) return { x: d.x0, y: d.y0, w: objW, h: objH };
    return {
      x: Math.min(d.x0, d.x1),
      y: Math.min(d.y0, d.y1),
      w: Math.abs(d.x1 - d.x0) + 1,
      h: Math.abs(d.y1 - d.y0) + 1,
    };
  }

  function checkObject(f: Footprint): string | null {
    if (f.x < 0 || f.y < 0 || f.x + f.w > COLS || f.y + f.h > ROWS) return "That object doesn't fit inside the map.";
    const clash = objects.find((o) => f.x < o.x + o.w && f.x + f.w > o.x && f.y < o.y + o.h && f.y + f.h > o.y);
    if (clash) return `It overlaps the ${OBJECTS[clash.kind].label}. Erase that first or pick a free spot.`;

    const inside = (p: Point) => p.x >= f.x && p.x < f.x + f.w && p.y >= f.y && p.y < f.y + f.h;
    const opening = (p: Point) => grid[p.y][p.x] === "door" || grid[p.y][p.x] === "gate";
    if (start && inside(start) && !opening(start)) return "The start marker is inside that area. Move the start first.";
    const dest = destinations.find((d) => inside(d) && !opening(d));
    if (dest) return `D${dest.id} is inside that area. Move or remove it first.`;
    return null;
  }

  function commitDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    setDragRect(null);
    if (!d || !isObjectKind(tool)) return;

    const kind: ObjectKind = tool;
    const footprint = footprintFromDrag(d);
    const error = checkObject(footprint);
    if (error) return fail(error);

    pushHistory();
    setObjects((prev) => [...prev, { id: nextObjectId(prev), kind, ...footprint }]);
    setResult(null);
    setMessage(null);
  }

  function applyTool(x: number, y: number) {
    const here: Point = { x, y };
    const raw = grid[y][x];
    const effective = typeAt(x, y);
    const marker = markerLabelAt(x, y);
    const obj = objectAt(x, y);

    if (movingId !== null) return moveDestination(here);

    if (tool === "none" || isObjectKind(tool)) return;

    if (tool === "eraser") {
      const hasLabel = labels.some((l) => samePoint(l, here));
      const carved = raw === "door" || raw === "gate";
      if (obj && !marker && !hasLabel && !carved) {
        setObjects((prev) => prev.filter((o) => o.id !== obj.id));
      } else {
        if (start && samePoint(start, here)) setStart(null);
        setDestinations((prev) => prev.filter((d) => !samePoint(d, here)));
        setLabels((prev) => prev.filter((l) => !samePoint(l, here)));
        setCell(x, y, "ground");
      }
      setResult(null);
      setMessage(null);
      return;
    }

    if (tool === "text") {
      drawing.current = false;
      const existingLabelIndex = labels.findIndex((l) => l.x === x && l.y === y);
      const val = window.prompt(
        "Enter text for label (leave empty to remove):",
        existingLabelIndex !== -1 ? labels[existingLabelIndex].text : ""
      );
      if (val !== null) {
        if (val.trim() === "") {
          setLabels((prev) => prev.filter((l) => l.x !== x || l.y !== y));
        } else {
          setLabels((prev) => {
            const others = prev.filter((l) => l.x !== x || l.y !== y);
            return [...others, { x, y, text: val }];
          });
        }
      }
      return;
    }

    if (tool === "start") {
      if (!isWalkable(effective)) return fail("The start can't be placed on an obstacle. Use a walkable cell such as ground, path, sidewalk or door.");
      if (marker && marker !== "Start") return fail(`${marker} is already on that cell.`);
      setStart(here);
      setResult(null);
      setMessage(null);
      return;
    }

    if (tool === "destination") {
      if (!isWalkable(effective)) return fail("A destination can't be placed on an obstacle. Use a walkable cell such as ground, path, sidewalk or door.");
      if (marker) return fail(`${marker} is already on that cell.`);
      setDestinations((prev) => {
        const id = nextDestinationId(prev);
        return [...prev, { x, y, id, selected: true, color: COLOR_PALETTE[(id - 1) % COLOR_PALETTE.length] }];
      });
      setResult(null);
      setMessage(null);
      return;
    }

    const type: TerrainType = tool;
    if (raw === type) return;
    if (obj && type !== "door" && type !== "gate") {
      return fail(`The ${OBJECTS[obj.kind].label} is on that cell. Erase it first, or use a Door or Gate to make an opening.`);
    }
    if (marker && !isWalkable(type)) {
      return fail(`${marker} is on that cell. Move it or erase it before placing a ${type}.`);
    }
    setCell(x, y, type);
    setResult(null);
    setMessage(null);
  }

  function handleCellDown(x: number, y: number) {
    if (movingId === null && isObjectKind(tool)) {
      drawing.current = true;
      dragRef.current = { x0: x, y0: y, x1: x, y1: y };
      setDragRect(dragRef.current);
      return;
    }
    if (movingId === null && tool === "none") return;
    pushHistory();
    drawing.current = true;
    applyTool(x, y);
  }

  function handleCellEnter(x: number, y: number, e: ReactPointerEvent) {
    if (movingId === null && isObjectKind(tool)) {
      if ((e.buttons & 1) === 1 && dragRef.current) {
        dragRef.current = { ...dragRef.current, x1: x, y1: y };
        setDragRect(dragRef.current);
      } else {
        if (dragRef.current) {
          dragRef.current = null;
          setDragRect(null);
        }
        setHover({ x, y });
      }
      return;
    }
    if ((e.buttons & 1) !== 1) {
      drawing.current = false;
      return;
    }
    if (!drawing.current) return;
    if (movingId !== null || tool === "start" || tool === "destination" || tool === "text" || tool === "none") return;
    applyTool(x, y);
  }

  function selectTool(t: Tool) {
    setTool(t);
    setMovingId(null);
    setMessage(null);
    setHover(null);
    dragRef.current = null;
    setDragRect(null);
    if (isObjectKind(t)) {
      setObjW(OBJECTS[t].w);
      setObjH(OBJECTS[t].h);
    }
  }

  function clampSize(value: string): number {
    return Math.min(60, Math.max(1, parseInt(value, 10) || 1));
  }

  function zoomBy(factor: number, mx = containerSize.w / 2, my = containerSize.h / 2) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const ratio = next / zoom;
    setPan((p) => ({ x: mx - (mx - p.x) * ratio, y: my - (my - p.y) * ratio }));
    setZoom(next);
  }

  function handleWheel(e: ReactWheelEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
  }

  function toggleDestination(id: number) {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)));
    setResult(null);
  }

  function reorderDestination(index: number, direction: -1 | 1) {
    setDestinations((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setResult(null);
  }

  function changeDestinationColor(id: number, color: string) {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, color } : d)));
  }

  function skipAnimation() {
    if (!result) return;
    setPhase("done");
    setMessage({ text: "Route found.", kind: "success" });
  }

  function removeDestination(id: number) {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
    if (movingId === id) setMovingId(null);
    setResult(null);
  }

  function startMoving(id: number) {
    if (movingId === id) {
      setMovingId(null);
      setMessage(null);
      return;
    }
    setMovingId(id);
    setMessage({ text: `Click a cell on the map to move D${id}.`, kind: "info" });
  }

  function findRoute() {
    if (!start) return fail("Place a start point first.");

    const stops = destinations.filter((d) => d.selected);
    if (stops.length === 0) return fail("Select at least one destination to visit.");

    const effective = buildEffectiveGrid(grid, objects);
    if (!isWalkable(effective[start.y][start.x])) return fail("The start is on a blocked cell. Move it to a walkable cell.");

    const run = algorithm === "dfs" ? dfs : algorithm === "bfs" ? bfs : dijkstra;
    const bounds = getSearchBounds(grid, objects, start, stops);
    const cells: RouteCell[] = [{ p: start, destId: stops[0].id }];
    const explored: { p: Point; destId: number }[] = [];
    let cost = 0;
    let from: Point = start;
    let fromLabel = "Start";
    const unreachableStops: number[] = [];

    for (const stop of stops) {
      const label = `D${stop.id}`;

      if (samePoint(from, stop)) {
        setResult(null);
        return fail(`${fromLabel} and ${label} are in the same cell. Move one of them.`);
      }

      const segment = run(from, stop, effective, bounds);
      if (!segment.found) {
        unreachableStops.push(stop.id);
        for (const p of segment.explored) explored.push({ p, destId: stop.id });
        continue;
      }

      for (const p of segment.route.slice(1)) cells.push({ p, destId: stop.id });
      for (const p of segment.explored) explored.push({ p, destId: stop.id });
      cost += segmentCost(effective, segment.route);
      from = stop;
      fromLabel = label;
    }

    if (unreachableStops.length === stops.length) {
      setResult(null);
      return fail(`None of the selected destinations are reachable. Roads and objects block the way, so add a door, a gate or a pedestrian lane.`);
    }

    setResult({
      algorithm,
      cells,
      explored,
      steps: cells.length - 1,
      cost,
      order: ["Start", ...stops.filter((s) => !unreachableStops.includes(s.id)).map((d) => `D${d.id}`)],
      unreachable: unreachableStops,
    });
    setPhase("explore");
    setStep(0);

    if (unreachableStops.length > 0) {
      setMessage({ text: `Searching with ${ALGORITHM_NAMES[algorithm]}... Warning: Some destinations are unreachable.`, kind: "error" });
    } else {
      setMessage({ text: `Searching with ${ALGORITHM_NAMES[algorithm]}...`, kind: "info" });
    }
  }

  function clearRoute() {
    setResult(null);
    setMessage(null);
  }

  function clearMap() {
    pushHistory();
    setGrid(createEmptyGrid());
    setObjects([]);
    setStart(null);
    setDestinations([]);
    setLabels([]);
    setResult(null);
    setMovingId(null);
    setMessage({ text: "Map cleared.", kind: "info" });
  }

  function loadSample() {
    pushHistory();
    setGrid(createSampleMap());
    setObjects(createSampleObjects());
    setStart(SAMPLE_START);
    setDestinations(createSampleDestinations());
    setLabels([]);
    setResult(null);
    setMovingId(null);
    setPan({ x: 0, y: 0 });
    setZoom(0.8);
    setMessage({ text: "Sample school loaded.", kind: "info" });
  }

  function currentMap(): HistoryState {
    return { grid, start, destinations, labels, objects };
  }

  function saveCurrentMap() {
    const name = window.prompt("Name this map", `Map ${savedMaps.length + 1}`)?.trim();
    if (!name) return;

    const saved: SavedMap = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      updatedAt: new Date().toISOString(),
      map: currentMap(),
    };
    setSavedMaps((prev) => [saved, ...prev]);
    setSelectedSavedMap(saved.id);
    setMessage({ text: `Saved “${name}” locally in this browser.`, kind: "success" });
  }

  function loadSavedMap() {
    const saved = savedMaps.find((item) => item.id === selectedSavedMap);
    if (!saved) return;

    pushHistory();
    setGrid(saved.map.grid);
    setStart(saved.map.start);
    setDestinations(saved.map.destinations);
    setLabels(saved.map.labels);
    setObjects(saved.map.objects);
    setResult(null);
    setMovingId(null);
    setPan({ x: 0, y: 0 });
    setZoom(0.8);
    setMessage({ text: `Loaded “${saved.name}”.`, kind: "success" });
  }

  function deleteSavedMap() {
    const saved = savedMaps.find((item) => item.id === selectedSavedMap);
    if (!saved) return;
    setSavedMaps((prev) => prev.filter((item) => item.id !== saved.id));
    setSelectedSavedMap("");
    setMessage({ text: `Deleted “${saved.name}”.`, kind: "info" });
  }

  function renderCell(x: number, y: number) {
    const type = grid[y][x] as TerrainType;
    const icon = CELL_ICONS[type];
    const left = grid[y][x - 1];
    const right = grid[y][x + 1];
    const up = grid[y - 1]?.[x];
    const down = grid[y + 1]?.[x];
    const isFence = (t?: CellType) => t === "fence" || t === "gate";
    const isRoad = (t?: CellType) => t === "road" || t === "crosswalk";

    const fenceH = isFence(left) || isFence(right);
    const fenceV = isFence(up) || isFence(down);

    let stripes: boolean | null = null;
    if (type === "crosswalk") {
      const hCount = (isRoad(left) ? 1 : 0) + (isRoad(right) ? 1 : 0);
      const vCount = (isRoad(up) ? 1 : 0) + (isRoad(down) ? 1 : 0);
      stripes = hCount >= vCount;
    }

    return (
      <>
        <rect width={CELL} height={CELL} fill={CELL_COLORS[type]} stroke="rgba(0,0,0,0.08)" />
        {type === "path" && (
          <rect x={5} y={5} width={CELL - 10} height={CELL - 10} rx={4} fill="#fbf6ea" stroke="#e2d4b0" />
        )}
        {type === "sidewalk" && <path d={`M0 ${CELL / 2}H${CELL}M${CELL / 2} 0V${CELL}`} stroke="#b9b9c1" strokeWidth={1} />}
        {type === "road" && (
          <>
            {!isRoad(up) && <rect x={0} y={2} width={CELL} height={2} fill="#e5e7eb" opacity={0.8} />}
            {!isRoad(down) && <rect x={0} y={CELL - 4} width={CELL} height={2} fill="#e5e7eb" opacity={0.8} />}
            {!isRoad(left) && <rect x={2} y={0} width={2} height={CELL} fill="#e5e7eb" opacity={0.8} />}
            {!isRoad(right) && <rect x={CELL - 4} y={0} width={2} height={CELL} fill="#e5e7eb" opacity={0.8} />}
          </>
        )}
        {type === "crosswalk" &&
          [2, 9, 16, 23].map((o) =>
            stripes ? (
              <rect key={o} x={0} y={o} width={CELL} height={5} fill="#f8fafc" />
            ) : (
              <rect key={o} x={o} y={0} width={5} height={CELL} fill="#f8fafc" />
            )
          )}
        {type === "court" && (
          <rect x={2} y={2} width={CELL - 4} height={CELL - 4} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
        )}
        {type === "fence" && (
          <>
            {fenceH && <rect x={0} y={13} width={CELL} height={6} fill="#92704f" />}
            {fenceV && <rect x={13} y={0} width={6} height={CELL} fill="#92704f" />}
            <rect x={11} y={11} width={10} height={10} rx={2} fill="#6b4f35" />
          </>
        )}
        {type === "gate" &&
          (fenceH || !fenceV ? (
            <>
              <rect x={0} y={9} width={6} height={14} fill="#6b4f35" />
              <rect x={CELL - 6} y={9} width={6} height={14} fill="#6b4f35" />
            </>
          ) : (
            <>
              <rect x={9} y={0} width={14} height={6} fill="#6b4f35" />
              <rect x={9} y={CELL - 6} width={14} height={6} fill="#6b4f35" />
            </>
          ))}
        {icon &&
          (typeof icon === "string" ? (
            <text x={CELL / 2} y={CELL / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={20}>
              {icon}
            </text>
          ) : (
            <image
              href={icon.src}
              x={CELL * 0.1}
              y={CELL * 0.1}
              width={CELL * 0.8}
              height={CELL * 0.8}
              className="pointer-events-none"
            />
          ))}
      </>
    );
  }

  function renderObject(o: PlacedObject) {
    const def = OBJECTS[o.kind];
    const px = o.x * CELL;
    const py = o.y * CELL;
    const pw = o.w * CELL;
    const ph = o.h * CELL;
    const iconSize = Math.min(48, Math.min(pw, ph) * 0.65);
    const showName = pw >= CELL * 3 && ph >= CELL * 2;

    const openings = [];
    for (let y = o.y; y < o.y + o.h; y++) {
      for (let x = o.x; x < o.x + o.w; x++) {
        if (grid[y][x] === "door" || grid[y][x] === "gate") {
          openings.push(
            <g key={`open-${x}-${y}`} transform={`translate(${x * CELL},${y * CELL})`}>
              {renderCell(x, y)}
            </g>
          );
        }
      }
    }

    return (
      <g key={`obj-${o.id}`}>
        <rect x={px} y={py} width={pw} height={ph} rx={3} fill={def.fill} />
        {o.kind === "stall" &&
          Array.from({ length: o.w * 2 }, (_, i) => (
            <rect key={i} x={px + (i * CELL) / 2} y={py} width={CELL / 2} height={8} fill={i % 2 === 0 ? "#ef4444" : "#ffffff"} />
          ))}
        <rect x={px + 1} y={py + 1} width={pw - 2} height={ph - 2} rx={3} fill="none" stroke={def.stroke} strokeWidth={2} />
        {def.toolIcon ? (
          <image
            href={def.toolIcon.src}
            x={px + pw / 2 - iconSize / 2}
            y={py + ph / 2 - iconSize / 2 + (showName ? -6 : 0)}
            width={iconSize}
            height={iconSize}
            className="filter drop-shadow-sm pointer-events-none"
          />
        ) : (
          <text
            x={px + pw / 2}
            y={py + ph / 2 + (showName ? -5 : 1)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={iconSize}
          >
            {def.icon}
          </text>
        )}
        {showName && (
          <text
            x={px + pw / 2}
            y={py + ph / 2 + iconSize / 2 + 5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={700}
            fill="#ffffff"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {def.label}
          </text>
        )}
        {openings}
      </g>
    );
  }

  function renderMarker(
    p: Point,
    label: string,
    color: string,
    markerKey: string,
    iconData: StaticImageData
  ) {
    const cx = p.x * CELL + CELL / 2;
    const cy = p.y * CELL + CELL / 2;
    const iconSize = 28;
    return (
      <g key={markerKey} className="transition-transform duration-150">
        {/* Clean Marker Icon Image directly on cell */}
        <image
          href={iconData.src}
          x={cx - iconSize / 2}
          y={cy - iconSize / 2}
          width={iconSize}
          height={iconSize}
          className="filter drop-shadow-sm"
        />
        {/* Sleek Text Label placed below the icon with dark transparent background */}
        <g transform={`translate(${cx}, ${cy + iconSize / 2 + 11})`}>
          <rect
            x={-(label.length * 3.6 + 6)}
            y={-8}
            width={(label.length * 3.6 + 6) * 2}
            height={16}
            rx={8}
            fill="#0f172a"
            fillOpacity={0.78}
          />
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={700}
            fill="#ffffff"
          >
            {label}
          </text>
        </g>
      </g>
    );
  }

  const selectedStops = destinations.filter((d) => d.selected);
  const animating = result !== null && (phase === "explore" || phase === "walk");
  const colorOf = (destId: number) => destinations.find((d) => d.id === destId)?.color ?? "#2563eb";

  const startX = Math.max(0, Math.floor(-pan.x / (CELL * zoom)));
  const startY = Math.max(0, Math.floor(-pan.y / (CELL * zoom)));
  const endX = Math.min(COLS, Math.ceil((-pan.x + containerSize.w) / (CELL * zoom)));
  const endY = Math.min(ROWS, Math.ceil((-pan.y + containerSize.h) / (CELL * zoom)));
  const inView = (p: Point) => p.x >= startX - 1 && p.x <= endX && p.y >= startY - 1 && p.y <= endY;

  const exploredShown = !result
    ? []
    : (phase === "explore" ? result.explored.slice(0, step) : result.explored).filter((e) => inView(e.p));
  const cellsShown =
    !result || phase === "explore" ? 0 : phase === "walk" ? Math.min(step, result.cells.length) : result.cells.length;
  const routeShown = result ? result.cells.slice(0, cellsShown) : [];

  const visibleCells = [];
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      visibleCells.push({ x, y });
    }
  }

  const visibleObjects = objects.filter(
    (o) => o.x <= endX && o.x + o.w >= startX && o.y <= endY && o.y + o.h >= startY
  );

  let preview: Footprint | null = null;
  if (isObjectKind(tool)) {
    if (dragRect) preview = footprintFromDrag(dragRect);
    else if (hover) preview = { x: hover.x, y: hover.y, w: objW, h: objH };
  }
  const previewError = preview ? checkObject(preview) : null;

  const messageStyle =
    message?.kind === "error"
      ? "border-red-300 bg-red-50 text-red-800"
      : message?.kind === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-white text-slate-600";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-2.5 text-white">
        <h1 className="text-lg font-semibold">Campus Navigation System</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
            aria-label="Algorithm"
          >
            <option value="dfs">{ALGORITHM_NAMES.dfs}</option>
            <option value="bfs">{ALGORITHM_NAMES.bfs}</option>
            <option value="dijkstra">{ALGORITHM_NAMES.dijkstra}</option>
          </select>
          <select
            value={speed}
            onChange={(e) => setSpeed(e.target.value as Speed)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
            aria-label="Animation speed"
          >
            <option value="slow">Slow animation</option>
            <option value="normal">Normal animation</option>
            <option value="fast">Fast animation</option>
          </select>
          <button onClick={findRoute} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500">
            Find Route
          </button>
          {animating && (
            <button onClick={skipAnimation} className="rounded border border-amber-400 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-950">
              Skip Animation
            </button>
          )}
          <button onClick={clearRoute} className="rounded border border-slate-500 px-3 py-1.5 text-sm hover:bg-slate-800">
            Clear Route
          </button>
          <button onClick={clearMap} className="rounded border border-red-400 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950">
            Clear Map
          </button>
          <button onClick={loadSample} className="rounded border border-slate-500 px-3 py-1.5 text-sm hover:bg-slate-800">
            Load Sample
          </button>
          <button onClick={saveCurrentMap} className="rounded border border-emerald-400 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-950">
            Save Map
          </button>
          {savedMaps.length > 0 && (
            <>
              <select
                value={selectedSavedMap}
                onChange={(e) => setSelectedSavedMap(e.target.value)}
                className="max-w-40 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
                aria-label="Saved maps"
              >
                <option value="">Saved maps...</option>
                {savedMaps.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name}
                  </option>
                ))}
              </select>
              <button
                onClick={loadSavedMap}
                disabled={!selectedSavedMap}
                className="rounded border border-slate-500 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Load Saved
              </button>
              <button
                onClick={deleteSavedMap}
                disabled={!selectedSavedMap}
                className="rounded border border-red-400 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete Saved
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-3 p-3">
        <nav className="w-52 shrink-0 space-y-3 overflow-y-auto pr-1">
          {TOOL_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.title}</h2>
              <div className="space-y-1">
                {group.tools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTool(t.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-sm ${tool === t.id
                        ? "border-blue-600 bg-blue-50 font-medium text-blue-800 shadow-xs"
                        : "border-slate-300 bg-white hover:bg-slate-50"
                      }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100 p-0.5">
                      {typeof t.icon === "string" ? (
                        <span className="text-lg leading-none">{t.icon}</span>
                      ) : (
                        <Image src={t.icon} alt={t.label} width={28} height={28} className="h-6 w-6 object-contain" />
                      )}
                    </span>
                    <span className="flex-1 font-medium">{t.label}</span>
                    {isObjectKind(t.id) && (
                      <span className="text-[10px] text-slate-400">
                        {OBJECTS[t.id].w}×{OBJECTS[t.id].h}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <section className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Zoom</span>
            <button className={smallButton} onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">
              −
            </button>
            <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button className={smallButton} onClick={() => zoomBy(1.2)} aria-label="Zoom in">
              +
            </button>
            <button
              className={smallButton}
              onClick={() => {
                setZoom(0.8);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset view
            </button>
            <span className="text-xs text-slate-400">Scroll to zoom, right-drag to pan, Ctrl+Z to undo</span>
            {isObjectKind(tool) && (
              <div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-2 py-1">
                <span className="flex items-center gap-1.5 font-medium">
                  {OBJECTS[tool].toolIcon ? (
                    <Image
                      src={OBJECTS[tool].toolIcon}
                      alt={OBJECTS[tool].label}
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain"
                    />
                  ) : (
                    <span className="text-lg">{OBJECTS[tool].icon}</span>
                  )}
                  <span>{OBJECTS[tool].label}</span>
                </span>
                <label className="flex items-center gap-1">
                  W
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={objW}
                    onChange={(e) => setObjW(clampSize(e.target.value))}
                    className="w-14 rounded border border-slate-300 px-1 py-0.5"
                  />
                </label>
                <label className="flex items-center gap-1">
                  H
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={objH}
                    onChange={(e) => setObjH(clampSize(e.target.value))}
                    className="w-14 rounded border border-slate-300 px-1 py-0.5"
                  />
                </label>
                <button
                  className={smallButton}
                  onClick={() => {
                    setObjW(objH);
                    setObjH(objW);
                  }}
                >
                  Rotate
                </button>
                <span className="text-xs text-slate-500">Click to place at this size, or drag a rectangle for any size.</span>
              </div>
            )}
          </div>

          <div className={`rounded border px-3 py-2 text-sm ${messageStyle}`}>
            {message
              ? message.text
              : "Pick a tool on the left. Surfaces and small items paint cell by cell. Objects take any rectangle size. Roads block walking, so cross them at a pedestrian lane."}
          </div>

          <div className={`min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white ${tool === "none" ? "cursor-default" : "cursor-crosshair"}`}>
            <svg
              ref={containerRef}
              className="block h-full w-full select-none"
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              onWheel={handleWheel}
              onPointerLeave={() => setHover(null)}
              onPointerDown={(e) => {
                if (e.button === 2) {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setIsPanning(true);
                }
              }}
              onPointerMove={(e) => {
                if (isPanning) {
                  setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
                }
              }}
              onPointerUp={(e) => {
                if (e.button === 2) {
                  setIsPanning(false);
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
            >
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {visibleCells.map(({ x, y }) => (
                  <g
                    key={`${x}-${y}`}
                    transform={`translate(${x * CELL},${y * CELL})`}
                    onPointerDown={(e) => {
                      if (e.button === 2) return;
                      e.preventDefault();
                      handleCellDown(x, y);
                    }}
                    onPointerEnter={(e) => handleCellEnter(x, y, e)}
                  >
                    {renderCell(x, y)}
                  </g>
                ))}

                <g pointerEvents="none">{visibleObjects.map((o) => renderObject(o))}</g>

                {result && (
                  <g pointerEvents="none">
                    {exploredShown.map((e, i) => (
                      <rect
                        key={`e${i}`}
                        x={e.p.x * CELL}
                        y={e.p.y * CELL}
                        width={CELL}
                        height={CELL}
                        fill={colorOf(e.destId)}
                        opacity={phase === "explore" ? 0.4 : 0.15}
                      />
                    ))}
                    {routeShown.map((c, i) =>
                      inView(c.p) ? (
                        <rect key={`r${i}`} x={c.p.x * CELL} y={c.p.y * CELL} width={CELL} height={CELL} fill={colorOf(c.destId)} opacity={0.4} />
                      ) : null
                    )}
                    {routeShown.slice(1).map((c, i) => {
                      if (!inView(c.p)) return null;
                      const prev = result.cells[i].p;
                      const coords = {
                        x1: prev.x * CELL + CELL / 2,
                        y1: prev.y * CELL + CELL / 2,
                        x2: c.p.x * CELL + CELL / 2,
                        y2: c.p.y * CELL + CELL / 2,
                      };
                      return (
                        <g key={`l${i}`} strokeLinecap="round">
                          <line {...coords} stroke="#0f172a" strokeOpacity={0.35} strokeWidth={8} />
                          <line {...coords} stroke={colorOf(c.destId)} strokeWidth={5} />
                        </g>
                      );
                    })}
                    {phase === "walk" && cellsShown > 0 && (
                      <circle
                        cx={result.cells[cellsShown - 1].p.x * CELL + CELL / 2}
                        cy={result.cells[cellsShown - 1].p.y * CELL + CELL / 2}
                        r={8}
                        fill="white"
                        stroke="#0f172a"
                        strokeWidth={3}
                      />
                    )}
                  </g>
                )}

                <g pointerEvents="none">
                  {start && renderMarker(start, "Start", "#7c3aed", "start", startIcon)}
                  {destinations.map((d) => {
                    const isUnreachable = result?.unreachable?.includes(d.id);
                    return (
                      <g key={`dest-${d.id}`}>
                        {renderMarker(
                          d,
                          `Destination ${d.id}`,
                          d.selected ? d.color : "#9ca3af",
                          `dest-marker-${d.id}`,
                          destinationIcon
                        )}
                        {isUnreachable && (
                          <text x={d.x * CELL + CELL / 2} y={d.y * CELL - 12} textAnchor="middle" fontSize={20}>
                            ⚠️
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {labels.map((l, i) => (
                    <text
                      key={`label-${i}`}
                      x={l.x * CELL + CELL / 2}
                      y={l.y * CELL + CELL / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={14}
                      fontWeight={700}
                      fill="#1e293b"
                      stroke="white"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {l.text}
                    </text>
                  ))}
                </g>

                {preview && (
                  <g pointerEvents="none">
                    <rect
                      x={preview.x * CELL}
                      y={preview.y * CELL}
                      width={preview.w * CELL}
                      height={preview.h * CELL}
                      fill={previewError ? "#ef4444" : "#22c55e"}
                      fillOpacity={0.3}
                      stroke={previewError ? "#b91c1c" : "#15803d"}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                    <text
                      x={preview.x * CELL + 4}
                      y={preview.y * CELL - 6}
                      fontSize={13}
                      fontWeight={700}
                      fill="#0f172a"
                      stroke="white"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {preview.w}×{preview.h}
                    </text>
                  </g>
                )}
              </g>
            </svg>
          </div>
        </section>

        <aside className="w-96 shrink-0 space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold">Start point</h2>
            {start ? (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-purple-50 border border-purple-200">
                    <Image src={startIcon} alt="Start" width={20} height={20} className="h-4 w-4 object-contain" />
                  </span>
                  <span>
                    Start ({start.x}, {start.y})
                  </span>
                </span>
                <button
                  className={smallButton}
                  onClick={() => {
                    setStart(null);
                    setResult(null);
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Not placed. Choose the Start tool and click a walkable cell.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h2 className="mb-1 text-sm font-semibold">Destinations</h2>
            <p className="mb-2 text-xs text-slate-500">
              Checked destinations are visited from top to bottom. Use the arrows to change the order. Each color is used for the route leg that ends at that destination.
            </p>
            {destinations.length === 0 ? (
              <p className="text-sm text-slate-500">None yet. Choose the Destination tool and click the map.</p>
            ) : (
              <ul className="space-y-1.5">
                {destinations.map((d, i) => {
                  const order = selectedStops.findIndex((s) => s.id === d.id);
                  return (
                    <li
                      key={d.id}
                      className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-sm ${movingId === d.id ? "border-blue-500 bg-blue-50" : "border-slate-200"
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={d.selected}
                        onChange={() => toggleDestination(d.id)}
                        aria-label={`Visit Destination ${d.id}`}
                      />
                      <input
                        type="color"
                        value={d.color}
                        onChange={(e) => changeDestinationColor(d.id, e.target.value)}
                        className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                        title={`Color of the route leg that ends at Destination ${d.id}`}
                        aria-label={`Route color for Destination ${d.id}`}
                      />
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Image src={destinationIcon} alt={`Destination ${d.id}`} width={18} height={18} className="h-4 w-4 object-contain" />
                      </span>
                      <span className="font-semibold whitespace-nowrap">Dest {d.id}</span>
                      <span className="flex-1 text-xs text-slate-500">
                        ({d.x}, {d.y}) {d.selected ? `visit ${order + 1}` : "skipped"}
                      </span>
                      <button className={smallButton} disabled={i === 0} onClick={() => reorderDestination(i, -1)} aria-label="Visit earlier">
                        ↑
                      </button>
                      <button
                        className={smallButton}
                        disabled={i === destinations.length - 1}
                        onClick={() => reorderDestination(i, 1)}
                        aria-label="Visit later"
                      >
                        ↓
                      </button>
                      <button className={smallButton} onClick={() => startMoving(d.id)}>
                        Move
                      </button>
                      <button className={smallButton} onClick={() => removeDestination(d.id)} aria-label={`Remove D${d.id}`}>
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold">Route results</h2>
            {result && phase === "done" ? (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Algorithm</dt>
                  <dd className="text-right">{ALGORITHM_NAMES[result.algorithm]}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Visit order</dt>
                  <dd className="text-right">{result.order.join(" → ")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Total steps</dt>
                  <dd>{result.steps}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Movement cost</dt>
                  <dd>{result.cost}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Visited cells</dt>
                  <dd>{result.explored.length}</dd>
                </div>
                {result.unreachable && result.unreachable.length > 0 && (
                  <div className="mt-2 rounded border border-red-200 bg-red-50 p-2">
                    <p className="font-semibold text-red-800">Unreachable:</p>
                    <p className="text-red-700">D{result.unreachable.join(", D")}</p>
                    <p className="mt-1 text-xs text-red-600">These could not be reached. Try adding doors, gates or pedestrian lanes.</p>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">{animating ? "Animating the route..." : "No route on the map. Press Find Route."}</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold">Which algorithm?</h2>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">DFS</span> may not find the shortest route. It shows whichever route it finds first.
              </li>
              <li>
                <span className="font-semibold text-slate-800">BFS</span> finds the route with the fewest steps, but ignores walking path preference.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Dijkstra</span> finds the lowest movement cost, so it prefers paths, sidewalks and pedestrian lanes over ground.
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold">Legend</h2>
            <ul className="space-y-1.5 text-xs">
              {LEGEND.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  {item.icon ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 p-0.5 border border-slate-200">
                      {typeof item.icon === "string" ? (
                        <span className="text-sm leading-none">{item.icon}</span>
                      ) : (
                        <Image src={item.icon} alt="" width={22} height={22} className="h-5 w-5 object-contain" />
                      )}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center border border-black/15 text-[10px] font-bold text-white shadow-xs ${item.round ? "rounded-full" : "rounded-md"
                        }`}
                      style={{ background: item.color }}
                    >
                      {item.text}
                    </span>
                  )}
                  <span className="text-slate-700">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}