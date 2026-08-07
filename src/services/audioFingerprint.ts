type FingerprintGenerator = (samples: Float32Array) => Promise<string>;

declare global {
  interface Window {
    GenerateFP?: FingerprintGenerator;
  }
}

let loader: Promise<FingerprintGenerator> | undefined;

/** 按顺序加载一个传统脚本 */
const loadScript = (name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const src = new URL(`audio-fingerprint/${name}`, document.baseURI).toString();
    const existing = document.querySelector<HTMLScriptElement>(`script[data-audio-fp="${name}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`无法加载 ${name}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.dataset.audioFp = name;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error(`无法加载 ${name}`)), { once: true });
    document.head.append(script);
  });

/** 按需加载网易云音频指纹运行时 */
const loadFingerprintGenerator = (): Promise<FingerprintGenerator> => {
  loader ??= (async () => {
    await loadScript("afp.wasm.js");
    await loadScript("afp.js");
    if (!window.GenerateFP) throw new Error("音频指纹运行时不可用");
    return window.GenerateFP;
  })();
  return loader;
};

/**
 * 为 8 kHz 单声道 PCM 生成 shazam_v2 查询指纹
 * @param samples - 8 kHz Float32 PCM
 * @returns Base64 音频指纹
 */
export const generateAudioFingerprint = async (samples: Float32Array): Promise<string> => {
  const generate = await loadFingerprintGenerator();
  return generate(samples);
};
