/**
 * 歌词引擎 seek 后行位置回归测试
 *
 * 模拟快速长距离拖动进度条，检验所有行最终是否严格顺序排布（无重叠 / 残留伪影）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LyricRenderer } from "./index";
import type { LyricLine } from "@shared/types/lyrics";

/** 手动步进的 rAF 队列 */
let rafQueue: { id: number; cb: (t: number) => void }[] = [];
let rafNextId = 0;
let frameClock = 0;

const stepFrame = (ms = 16) => {
  frameClock += ms;
  const queue = rafQueue;
  rafQueue = [];
  for (const { cb } of queue) cb(frameClock);
};

const makeLines = (count: number): LyricLine[] => {
  const lines: LyricLine[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * 3000;
    lines.push({
      startTime: start,
      endTime: start + 2800,
      words: [
        { word: `词${i}a`, startTime: start, endTime: start + 1400 },
        { word: `词${i}b`, startTime: start + 1400, endTime: start + 2800 },
      ],
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    });
  }
  return lines;
};

const createContainer = () => {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 900 });
  Object.defineProperty(container, "clientHeight", { value: 800 });
  document.body.appendChild(container);
  return container;
};

const VIEW_HEIGHT = 800;
const LINE_HEIGHT = 40;

/**
 * 校验视口内无残留伪影：
 * - 可见行之间不重叠
 * - 可见行的 DOM 位置必须与弹簧当前位置一致（未同步的行必须已被移出视口）
 */
const expectNoVisibleGhost = (renderer: LyricRenderer) => {
  const engine = renderer as unknown as {
    lineElements: HTMLDivElement[];
    positionSprings: { getCurrentPosition(): number }[];
  };
  const visible: number[] = [];
  const offenders: string[] = [];
  for (let i = 0; i < engine.lineElements.length; i++) {
    const match = engine.lineElements[i].style.transform.match(/translateY\((-?[\d.]+)px\)/);
    const domY = match ? Number.parseFloat(match[1]) : Number.NaN;
    const springY = engine.positionSprings[i].getCurrentPosition();
    if (Math.abs(domY - springY) > 1 && domY > -LINE_HEIGHT && domY < VIEW_HEIGHT) {
      offenders.push(`行${i} DOM=${domY} 残留在视口内（弹簧=${springY.toFixed(1)}）`);
    }
    if (domY > -LINE_HEIGHT && domY < VIEW_HEIGHT) visible.push(domY);
  }
  expect(offenders, offenders.join("; ")).toHaveLength(0);

  visible.sort((a, b) => a - b);
  const overlaps: string[] = [];
  for (let i = 1; i < visible.length; i++) {
    if (visible[i] - visible[i - 1] < LINE_HEIGHT - 1) {
      overlaps.push(`${visible[i - 1]} ~ ${visible[i]}`);
    }
  }
  expect(overlaps, `可见行重叠: ${overlaps.join(", ")}`).toHaveLength(0);
};

const runToSettle = (renderer: LyricRenderer, frames = 2000) => {
  for (let i = 0; i < frames; i++) stepFrame();
  expect(renderer).toBeTruthy();
};

describe("歌词引擎 seek 后布局", () => {
  beforeEach(() => {
    rafQueue = [];
    rafNextId = 0;
    frameClock = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
      rafQueue.push({ id: ++rafNextId, cb });
      return rafNextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafQueue = rafQueue.filter((r) => r.id !== id);
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );
  });

  it("快速长距离前进拖动后无重叠", () => {
    const container = createContainer();
    const renderer = new LyricRenderer(container, { playing: true });
    renderer.setLyrics(makeLines(400));

    // 正常播放一段时间，让入场动画与首行激活完成
    let time = 0;
    for (let i = 0; i < 600; i++) {
      time += 30;
      renderer.setCurrentTime(time);
      stepFrame();
    }

    // 快速长距离拖动：每帧跨越约 200 行（600s）
    for (let jump = 0; jump < 2; jump++) {
      time += 600000;
      renderer.setCurrentTime(time);
      stepFrame();
    }

    runToSettle(renderer);
    expectNoVisibleGhost(renderer);
    renderer.dispose();
  });

  it("快速长距离回退拖动后无重叠", () => {
    const container = createContainer();
    const renderer = new LyricRenderer(container, { playing: true });
    renderer.setLyrics(makeLines(400));

    let time = 1200000;
    for (let i = 0; i < 600; i++) {
      time += 30;
      renderer.setCurrentTime(time);
      stepFrame();
    }

    for (let jump = 0; jump < 2; jump++) {
      time -= 600000;
      renderer.setCurrentTime(time);
      stepFrame();
    }

    runToSettle(renderer);
    expectNoVisibleGhost(renderer);
    renderer.dispose();
  });

  it("慢速拖动（未触发 seek 阈值）后无重叠", () => {
    const container = createContainer();
    const renderer = new LyricRenderer(container, { playing: true });
    renderer.setLyrics(makeLines(400));

    let time = 0;
    for (let i = 0; i < 600; i++) {
      time += 30;
      renderer.setCurrentTime(time);
      stepFrame();
    }

    // 每帧 1500ms，低于 2000ms 的 seek 阈值，走激活/停用路径
    for (let i = 0; i < 40; i++) {
      time += 1500;
      renderer.setCurrentTime(time);
      stepFrame();
    }

    runToSettle(renderer);
    expectNoVisibleGhost(renderer);
    renderer.dispose();
  });
});
