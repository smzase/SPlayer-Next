#[cfg(target_os = "windows")]
mod imp {
    use anyhow::{Context, Result};
    use windows::{
        core::Interface,
        Win32::{
            Foundation::RPC_E_CHANGED_MODE,
            Media::Audio::{
                eRender, AudioSessionStateActive, AudioSessionStateExpired, IAudioSessionControl2,
                IAudioSessionManager2, IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator,
                DEVICE_STATE_ACTIVE,
            },
            System::{
                Com::{
                    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL,
                    COINIT_MULTITHREADED,
                },
                Threading::GetCurrentProcessId,
            },
        },
    };

    /// 当前线程 COM apartment 生命周期
    struct ComGuard {
        should_uninitialize: bool,
    }

    impl ComGuard {
        fn new() -> Result<Self> {
            // SAFETY: HRESULT 决定当前调用是否取得 CoUninitialize 责任
            let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            if hr.is_ok() {
                return Ok(Self {
                    should_uninitialize: true,
                });
            }
            if hr == RPC_E_CHANGED_MODE {
                return Ok(Self {
                    should_uninitialize: false,
                });
            }
            Err(anyhow::anyhow!("CoInitializeEx 失败: {hr:?}"))
        }
    }

    impl Drop for ComGuard {
        fn drop(&mut self) {
            if self.should_uninitialize {
                // SAFETY: 与成功的 CoInitializeEx 调用配对
                unsafe { CoUninitialize() };
            }
        }
    }

    /**
     * 枚举当前进程在所有活动输出设备上的音频会话
     * @param operation - 在 COM apartment 有效期内处理会话
     * @returns 操作结果
     */
    fn with_process_sessions<T>(
        operation: impl FnOnce(Vec<(ISimpleAudioVolume, bool)>) -> Result<T>,
    ) -> Result<T> {
        let _guard = ComGuard::new().context("初始化 COM 失败")?;
        // SAFETY: COM apartment 在 _guard 生命周期内有效，返回前释放全部接口
        unsafe {
            let device_enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .context("创建音频设备枚举器失败")?;
            let devices = device_enumerator
                .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
                .context("枚举音频输出设备失败")?;
            let device_count = devices.GetCount().context("读取音频输出设备数量失败")?;
            let process_id = GetCurrentProcessId();
            let mut result = Vec::new();

            for device_index in 0..device_count {
                let Ok(device) = devices.Item(device_index) else {
                    continue;
                };
                let Ok(manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else {
                    continue;
                };
                let Ok(sessions) = manager.GetSessionEnumerator() else {
                    continue;
                };
                let Ok(session_count) = sessions.GetCount() else {
                    continue;
                };
                for session_index in 0..session_count {
                    let Ok(control) = sessions.GetSession(session_index) else {
                        continue;
                    };
                    let Ok(control2) = control.cast::<IAudioSessionControl2>() else {
                        continue;
                    };
                    if control2.GetProcessId().ok() != Some(process_id) {
                        continue;
                    }
                    let Ok(state) = control.GetState() else {
                        continue;
                    };
                    if state == AudioSessionStateExpired {
                        continue;
                    }
                    let Ok(volume) = control.cast::<ISimpleAudioVolume>() else {
                        continue;
                    };
                    result.push((volume, state == AudioSessionStateActive));
                }
            }

            operation(result)
        }
    }

    pub fn set_volume(volume: f32) -> bool {
        with_process_sessions(|sessions| {
            let mut applied = false;
            for (session, _) in sessions {
                // SAFETY: 会话接口和 event context 指针在调用期间有效
                unsafe {
                    session.SetMasterVolume(volume, std::ptr::null())?;
                }
                applied = true;
            }
            Ok(applied)
        })
        .unwrap_or(false)
    }

    pub fn set_muted(muted: bool) -> bool {
        with_process_sessions(|sessions| {
            let mut applied = false;
            for (session, _) in sessions {
                // SAFETY: 会话接口和 event context 指针在调用期间有效
                unsafe {
                    session.SetMute(muted, std::ptr::null())?;
                }
                applied = true;
            }
            Ok(applied)
        })
        .unwrap_or(false)
    }

    pub fn get_volume() -> Option<f32> {
        with_process_sessions(|sessions| {
            let mut fallback = None;
            for (session, active) in sessions {
                // SAFETY: 会话接口在 COM apartment 生命周期内有效
                let (volume, muted) =
                    unsafe { (session.GetMasterVolume()?, session.GetMute()?.as_bool()) };
                let effective = if muted { 0.0 } else { volume };
                if active {
                    return Ok(Some(effective));
                }
                fallback.get_or_insert(effective);
            }
            Ok(fallback)
        })
        .ok()
        .flatten()
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    pub fn set_volume(_volume: f32) -> bool {
        false
    }

    pub fn set_muted(_muted: bool) -> bool {
        false
    }

    pub fn get_volume() -> Option<f32> {
        None
    }
}

pub use imp::{get_volume, set_muted, set_volume};
