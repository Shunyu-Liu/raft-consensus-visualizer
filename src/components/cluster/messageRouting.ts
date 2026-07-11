import type { MessageId, RaftMessage } from "../../simulator/types";

export interface NodeBounds { centerX: number; centerY: number; width: number; height: number; }
export interface Route { path: string; labelX: number; labelY: number; lane: number; }
interface Point { x: number; y: number }

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
    for (const message of ordered) byDirection.set(message.from === first ? "canonical" : "reverse", [...(byDirection.get(message.from === first ? "canonical" : "reverse") ?? []), message]);
    for (const [direction, list] of byDirection) list.forEach((message, index) => lanes.set(message.id, (direction === "canonical" ? 1 : -1) * (index + 1)));
  }
  return lanes;
}

export function createRoute(message: RaftMessage, from: NodeBounds, to: NodeBounds, lane: number, obstacles: NodeBounds[], accepted: Route[] = []): Route {
  const source = getRectangleBoundaryPoint(from, { x: to.centerX, y: to.centerY });
  const target = getRectangleBoundaryPoint(to, { x: from.centerX, y: from.centerY });
  const dx = target.x - source.x; const dy = target.y - source.y; const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length; const ny = dx / length;
  const offsets = [lane * 28, lane * 28 + 28, lane * 28 - 28, lane * 28 + 56, lane * 28 - 56];
  const candidates = offsets.map((offset) => {
    const control = { x: (source.x + target.x) / 2 + nx * offset, y: (source.y + target.y) / 2 + ny * offset };
    const path = `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`;
    const score = routeScore(source, control, target, obstacles, accepted);
    return { path, labelX: control.x, labelY: control.y, lane, score };
  });
  candidates.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path));
  return candidates[0];
}

function routeScore(a: Point, c: Point, b: Point, obstacles: NodeBounds[], accepted: Route[]): number {
  let score = Math.abs(c.x - (a.x + b.x) / 2) * 0.03;
  for (let i = 1; i <= 20; i++) {
    const t = i / 21; const p = { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y };
    for (const obstacle of obstacles) if (p.x >= obstacle.centerX - obstacle.width / 2 - 12 && p.x <= obstacle.centerX + obstacle.width / 2 + 12 && p.y >= obstacle.centerY - obstacle.height / 2 - 12 && p.y <= obstacle.centerY + obstacle.height / 2 + 12) score += 10000;
  }
  for (const route of accepted) if (route.path === `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`) score += 500;
  return score;
}
