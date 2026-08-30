import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateDeviceChange, recoveryRetryDelay } from "./devicePolicy";

describe("evaluateDeviceChange", () => {
  it("跟随系统默认且默认输出切换时重建", () => {
    assert.deepEqual(evaluateDeviceChange("扬声器", "耳机", null, false), {
      defaultChanged: true,
      shouldReinit: true,
    });
  });

  it("输出流自带切换通知时不重复触发重建", () => {
    // WASAPI 后端由 outputFailed 承担恢复，这里只负责刷新设备列表
    assert.deepEqual(evaluateDeviceChange("扬声器", "耳机", null, true), {
      defaultChanged: true,
      shouldReinit: false,
    });
  });

  it("用户选择固定设备时不因系统默认变化重建", () => {
    assert.deepEqual(evaluateDeviceChange("扬声器", "耳机", "USB DAC", false), {
      defaultChanged: true,
      shouldReinit: false,
    });
  });

  it("默认设备暂时消失时等待设备恢复", () => {
    assert.deepEqual(evaluateDeviceChange("扬声器", null, null, false), {
      defaultChanged: true,
      shouldReinit: false,
    });
  });

  it("设备列表变化但默认设备不变时不重建", () => {
    assert.deepEqual(evaluateDeviceChange("扬声器", "扬声器", null, false), {
      defaultChanged: false,
      shouldReinit: false,
    });
  });

  it("Linux 默认设备名恒为哨兵值，无法据此判断切换", () => {
    // cpal PipeWire 后端的 default_output_device() 返回合成设备，设备名是编译期常量，
    // 所以「切换时暂停」不能挂在这个判断上，改由 requestReinit 承担
    assert.deepEqual(evaluateDeviceChange("default_output", "default_output", null, false), {
      defaultChanged: false,
      shouldReinit: false,
    });
  });

  it("输出恢复最多尝试三次", () => {
    assert.equal(recoveryRetryDelay(0), 100);
    assert.equal(recoveryRetryDelay(1), 300);
    assert.equal(recoveryRetryDelay(2), 1000);
    assert.equal(recoveryRetryDelay(3), null);
  });
});
