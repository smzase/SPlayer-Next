import { describe, expect, it } from "vitest";
import {
  canUseAsStandaloneGlobalKey,
  eventToAccelerator,
  formatAccelerator,
  parseAccelerator,
} from "@shared/utils/accelerator";

const keyboardEvent = (code: string): KeyboardEvent =>
  ({
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  }) as KeyboardEvent;

describe("accelerator 小键盘与方向键", () => {
  it("把小键盘按键转换为 Electron token", () => {
    expect(eventToAccelerator(keyboardEvent("NumpadAdd"), false)).toBe("numadd");
    expect(eventToAccelerator(keyboardEvent("Numpad1"), false)).toBe("num1");
  });

  it("把 Electron 小键盘 token 解析回物理键码", () => {
    expect(parseAccelerator("CommandOrControl+numadd", false)?.code).toBe("NumpadAdd");
    expect(parseAccelerator("num1", false)?.code).toBe("Numpad1");
  });

  it("兼容旧的 Numpad 与 Arrow token", () => {
    expect(eventToAccelerator(keyboardEvent("ArrowLeft"), false)).toBe("Left");
    expect(parseAccelerator("NumpadAdd", false)?.code).toBe("NumpadAdd");
    expect(formatAccelerator("numadd", false)).toBe("Num +");
  });

  it("允许小键盘和方向键作为独立全局快捷键", () => {
    expect(canUseAsStandaloneGlobalKey("Numpad7")).toBe(true);
    expect(canUseAsStandaloneGlobalKey("ArrowDown")).toBe(true);
    expect(canUseAsStandaloneGlobalKey("KeyA")).toBe(false);
  });
});
