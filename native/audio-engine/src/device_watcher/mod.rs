use anyhow::Result;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
mod unsupported;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
use linux::Backend as SelectedBackend;
#[cfg(target_os = "macos")]
use macos::Backend as SelectedBackend;
#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
use unsupported::Backend as SelectedBackend;
#[cfg(target_os = "windows")]
use windows::Backend as SelectedBackend;

/// 回调参数：true 表示默认输出设备切换，false 表示设备列表变化
/// Linux PipeWire 后端的默认设备名恒为哨兵值，调用方只能靠这个信号区分两种事件
pub(super) type DeviceChangedCallback = Box<dyn Fn(bool) + Send + 'static>;

trait PlatformBackend: Sized {
    const SUPPORTED: bool;

    fn new(callback: DeviceChangedCallback) -> Result<Self>;
    fn stop(&mut self);
}

pub struct DeviceWatcher {
    backend: SelectedBackend,
}

impl DeviceWatcher {
    pub fn new(callback: DeviceChangedCallback) -> Result<Self> {
        Ok(Self {
            backend: SelectedBackend::new(callback)?,
        })
    }

    pub fn stop(&mut self) {
        self.backend.stop();
    }
}

impl Drop for DeviceWatcher {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn is_supported() -> bool {
    SelectedBackend::SUPPORTED
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_platform_backend_support() {
        assert_eq!(
            is_supported(),
            cfg!(any(
                target_os = "windows",
                target_os = "linux",
                target_os = "macos"
            ))
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn watcher_can_be_stopped_more_than_once() {
        let mut watcher = DeviceWatcher::new(Box::new(|_| {})).unwrap();
        watcher.stop();
        watcher.stop();
    }
}
