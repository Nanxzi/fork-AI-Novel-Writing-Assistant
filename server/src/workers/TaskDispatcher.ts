import { EventEmitter } from "node:events";

type TaskAvailableListener = (hint?: { commandType?: string; taskId?: string }) => void;

/**
 * 进程内事件总线：当新任务入队时通知 worker 立即唤醒，
 * 避免纯数据库轮询的 1.5 秒延迟。
 *
 * 架构要点：
 * - 同进程场景（桌面版、单体部署）直接通过 EventEmitter 实现零延迟通知。
 * - 跨进程场景（server + director-worker 分进程）使用轮询兜底，
 *   未来可扩展为 IPC / Unix socket / Redis pub-sub。
 * - 不替代数据库持久化：所有状态仍以 DB 为准，Dispatcher 仅做唤醒信号。
 */
class TaskDispatcher {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  /** 当新命令入队或状态变更时调用，唤醒空闲 slot。 */
  notify(hint?: { commandType?: string; taskId?: string }): void {
    this.emitter.emit("task-available", hint);
  }

  /** Worker slot 注册监听——有新任务时立即被唤醒。 */
  onTaskAvailable(listener: TaskAvailableListener): () => void {
    this.emitter.on("task-available", listener);
    return () => {
      this.emitter.removeListener("task-available", listener);
    };
  }

  /**
   * 等待下一个唤醒信号或超时（用于替代 setTimeout 轮询）。
   * 返回 true 表示被信号唤醒，false 表示超时。
   */
  waitForSignal(timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(false);
      }, timeoutMs);

      const onSignal = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(true);
      };

      const cleanup = () => {
        this.emitter.removeListener("task-available", onSignal);
      };

      this.emitter.once("task-available", onSignal);
    });
  }
}

export const taskDispatcher = new TaskDispatcher();
