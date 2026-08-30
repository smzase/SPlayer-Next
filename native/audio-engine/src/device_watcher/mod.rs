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

pub(super) type DeviceChangedCallback = Box<dyn Fn() + Send + 'static>;

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
        let mut watcher = DeviceWatcher::new(Box::new(|| {})).unwrap();
        watcher.stop();
        watcher.stop();
    }
}
