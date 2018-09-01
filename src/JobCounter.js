export default class JobCounter {
  constructor(tasks, concurrency = 3) {
    this.setTasks(tasks);
    this.setConcurrency(concurrency);
  }

  addTask(task) {
    this.tasks.push(task);
  }

  getDone() {
    return this.done;
  }

  getPrepared() {
    return this.prepared;
  }

  getStats() {
    return {
      done: this.getDone(),
      prepared: this.getPrepared(),
      total: this.getTotal(),
    };
  }

  getTotal() {
    return this.tasks.length;
  }

  incrementDone() {
    this.done += 1;
  }

  incrementPrepared() {
    this.prepared += 1;
  }

  isFinished() {
    return this.getDone() >= this.getTotal();
  }

  isPrepared() {
    return this.getPrepared() >= this.getTotal();
  }

  setConcurrency(concurrency) {
    this.concurrency = concurrency;
  }

  setTasks(tasks) {
    this.tasks = [...tasks];
  }
}

JobCounter.prototype.done = 0;
JobCounter.prototype.prepared = 0;
JobCounter.prototype.total = 0;
