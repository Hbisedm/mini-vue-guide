/** 队列 */
const queue: any[] = [];

/** 防止Promise频繁创建 */
let isFlushPending = false;

/** 提供给用户 可以拿到视图异步更新后的数据, */
export function nextTick(fn) {
  return fn ? Promise.resolve().then(fn) : Promise.resolve();
}

export function queueJobs(job) {
  if (!queue.includes(job)) {
    queue.push(job);
  }
  /** 执行加入异步队列 */
  queueFlush();
}

export function queueFlush() {
  if (isFlushPending) return;
  isFlushPending = true;
  /**
   * 每次进来都会创建个Promise
   * 使用个变量去控制Promise的创建
   */

  //   Promise.resolve().then(() => {
  //     flushJobs();
  //   });
  nextTick(flushJobs);
}
function flushJobs() {
  isFlushPending = false;
  let job;
  while ((job = queue.shift())) {
    job && job();
  }
}
