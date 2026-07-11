import type { MessageId, RaftMessage } from "../../simulator/types";
import { getCompactMessageLabel } from "./messageDisplay";

export interface NodeBounds { centerX: number; centerY: number; width: number; height: number; }
export interface Point { x: number; y: number; }
export interface LabelRect { x: number; y: number; width: number; height: number; }
export interface Route {
  path: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
  labelHeight: number;
  labelRect: LabelRect;
  lane: number;
  samplePoints: Point[];
}
export interface AcceptedLayout { routes: Route[]; labels: LabelRect[]; }

export function getRectangleBoundaryPoint(from: NodeBounds, target: Point, padding = 10): Point {
  const dx = target.x - from.centerX;
  const dy = target.y - from.centerY;
  const scale = Math.max(Math.abs(dx) / Math.max(1, from.width / 2), Math.abs(dy) / Math.max(1, from.height / 2), 1);
  return { x: from.centerX + dx / scale + Math.sign(dx || 1) * padding, y: from.centerY + dy / scale + Math.sign(dy || 1) * padding };
}

export function groupMessagesByNodePair(messages: RaftMessage[]): Map<string, RaftMessage[]> {
  const groups = new Map<string, RaftMessage[]>();
  for (const message of messages) {
    const key = [message.from, message.to].sort().join("|");
    groups.set(key, [...(groups.get(key) ?? []), message]);
  }
  return groups;
}

export function assignDirectionalLanes(messages: RaftMessage[]): Map<MessageId, number> {
  const lanes = new Map<MessageId, number>();
  for (const group of groupMessagesByNodePair(messages).values()) {
    const first = [group[0].from, group[0].to].sort()[0];
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const byDirection = new Map<string, RaftMessage[]>();
    for (const message of ordered) {
      const direction = message.from === first ? "canonical" : "reverse";
      byDirection.set(direction, [...(byDirection.get(direction) ?? []), message]);
    }
    for (const [direction, list] of byDirection) {
      list.forEach((message, index) => lanes.set(message.id, (direction === "canonical" ? 1 : -1) * (index + 1)));
    }
  }
  return lanes;
}

export function createRoute(
  message: RaftMessage,
  from: NodeBounds,
  to: NodeBounds,
  lane: number,
  obstacles: NodeBounds[],
  accepted: AcceptedLayout | Route[] = { routes: [], labels: [] },
  labelObstacles: NodeBounds[] = obstacles,
): Route {
  const layout = Array.isArray(accepted) ? { routes: accepted, labels: accepted.map((route) => route.labelRect) } : accepted;
  const source = getRectangleBoundaryPoint(from, { x: to.centerX, y: to.centerY });
  const target = getRectangleBoundaryPoint(to, { x: from.centerX, y: from.centerY });
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const label = getCompactMessageLabel(message);
  const labelWidth = label.length <= 12 ? 72 : label.length <= 18 ? 96 : 120;
  const labelHeight = 28;
  const offsets = [lane * 28, lane * 28 + 28, lane * 28 - 28, lane * 28 + 56, lane * 28 - 56];
  const candidates = offsets.map((offset) => {
    const control = { x: (source.x + target.x) / 2 + nx * offset, y: (source.y + target.y) / 2 + ny * offset };
    const samplePoints = sampleQuadratic(source, control, target, 22);
    const path = `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`;
    const labelPlacement = chooseLabelPlacement(samplePoints, labelWidth, labelHeight, labelObstacles, layout.labels);
    const candidate: Route = { path, labelX: labelPlacement.x + labelWidth / 2, labelY: labelPlacement.y + labelHeight / 2, labelWidth, labelHeight, labelRect: labelPlacement, lane, samplePoints };
    return { route: candidate, score: routeScore(candidate, obstacles, layout.routes, labelPlacement, labelObstacles) };
  });
  candidates.sort((a, b) => a.score - b.score || a.route.path.localeCompare(b.route.path));
  return candidates[0].route;
}

export function sampleQuadratic(start: Point, control: Point, end: Point, count = 22): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return { x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x, y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y };
  });
}

function chooseLabelPlacement(points: Point[], width: number, height: number, obstacles: NodeBounds[], labels: LabelRect[]): LabelRect {
  const candidates: LabelRect[] = [];
  for (const t of [0.4, 0.5, 0.6]) {
    const index = Math.round(t * (points.length - 1));
    const point = points[index];
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const dx = after.x - before.x; const dy = after.y - before.y; const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length; const ny = dx / length;
    for (const offset of [0, 14, -14, 28, -28]) candidates.push({ x: point.x + nx * offset - width / 2, y: point.y + ny * offset - height / 2, width, height });
  }
  return candidates.sort((a, b) => labelScore(a, obstacles, labels) - labelScore(b, obstacles, labels) || a.y - b.y || a.x - b.x)[0];
}

function routeScore(route: Route, obstacles: NodeBounds[], accepted: Route[], label: LabelRect, labelObstacles: NodeBounds[]): number {
  let score = 0;
  for (const point of route.samplePoints) {
    for (const obstacle of obstacles) {
      if (point.x >= obstacle.centerX - obstacle.width / 2 - 12 && point.x <= obstacle.centerX + obstacle.width / 2 + 12 && point.y >= obstacle.centerY - obstacle.height / 2 - 12 && point.y <= obstacle.centerY + obstacle.height / 2 + 12) score += 10000;
    }
  }
  for (const other of accepted) {
    for (let index = 2; index < route.samplePoints.length - 2; index += 1) {
      for (let otherIndex = 2; otherIndex < other.samplePoints.length - 2; otherIndex += 1) {
        const distance = Math.hypot(route.samplePoints[index].x - other.samplePoints[otherIndex].x, route.samplePoints[index].y - other.samplePoints[otherIndex].y);
        if (distance < 8) score += 80;
        else if (distance < 16) score += 28;
        else if (distance < 28) score += 6;
      }
    }
    for (let index = 2; index < route.samplePoints.length - 2; index += 1) {
      if (segmentsIntersect(route.samplePoints[index - 1], route.samplePoints[index], other.samplePoints[index - 1], other.samplePoints[index])) score += 42;
    }
  }
  score += labelScore(label, labelObstacles, accepted.map((route) => route.labelRect)) * 2;
  return score;
}

function labelScore(label: LabelRect, obstacles: NodeBounds[], labels: LabelRect[]): number {
  let score = 0;
  for (const obstacle of obstacles) if (rectsIntersect(label, { x: obstacle.centerX - obstacle.width / 2 - 4, y: obstacle.centerY - obstacle.height / 2 - 4, width: obstacle.width + 8, height: obstacle.height + 8 })) score += 10000;
  for (const other of labels) if (rectsIntersect(label, other)) score += 1200;
  if (label.x < 0 || label.y < 0) score += 300;
  return score;
}

function rectsIntersect(a: LabelRect, b: LabelRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const orientation = (p: Point, q: Point, r: Point) => (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  const first = orientation(a, b, c); const second = orientation(a, b, d); const third = orientation(c, d, a); const fourth = orientation(c, d, b);
  return ((first > 0 && second < 0) || (first < 0 && second > 0)) && ((third > 0 && fourth < 0) || (third < 0 && fourth > 0));
}
