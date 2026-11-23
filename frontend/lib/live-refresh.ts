const refreshInterval = 2_000;

export function startLiveRefresh(refresh: (signal: AbortSignal) => Promise<void>) {
  const controller = new AbortController();
  let inProgress = false;

  async function run() {
    if (inProgress || controller.signal.aborted || document.visibilityState === "hidden") return;
    inProgress = true;
    try {
      await refresh(controller.signal);
    } finally {
      inProgress = false;
    }
  }

  void run();
  const timer = window.setInterval(run, refreshInterval);
  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", run);
  return () => {
    controller.abort();
    window.clearInterval(timer);
    window.removeEventListener("focus", run);
    document.removeEventListener("visibilitychange", run);
  };
}
