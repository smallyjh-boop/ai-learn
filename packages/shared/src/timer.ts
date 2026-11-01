/**
 * 课程计时（网站和 App 共用）：记录每一步停留的秒数。
 * - 页面不可见 / App 在后台时暂停（由各端调用 pause / resume）
 * - 单步最多计 MAX_STEP_SEC，避免离开不关页面把数据拉偏
 */
export const MAX_STEP_SEC = 600;

export class StepTimer {
  private ms: number[];
  private current = 0;
  private since: number | null;

  constructor(steps: number, now = Date.now()) {
    this.ms = Array(steps).fill(0);
    this.since = now;
  }

  private flush(now: number) {
    if (this.since !== null) this.ms[this.current] = (this.ms[this.current] ?? 0) + Math.max(0, now - this.since);
    this.since = this.since === null ? null : now;
  }

  /** 切换到第 i 步（前进或后退） */
  goTo(i: number, now = Date.now()) {
    this.flush(now);
    this.current = Math.max(0, Math.min(i, this.ms.length - 1));
  }

  pause(now = Date.now()) {
    this.flush(now);
    this.since = null;
  }

  resume(now = Date.now()) {
    if (this.since === null) this.since = now;
  }

  /** 结束时调用，得到上传给 /progress/complete 的数据 */
  result(now = Date.now()): { durationSec: number; stepSeconds: number[] } {
    this.flush(now);
    const stepSeconds = this.ms.map((m) => Math.min(MAX_STEP_SEC, Math.round(m / 1000)));
    return { durationSec: stepSeconds.reduce((a, b) => a + b, 0), stepSeconds };
  }
}
