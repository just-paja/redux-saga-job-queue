export default class JobCounter {
  constructor(concurrency = 3) {
    this.tasks = [];
    this.setConcurrency(concurrency);
  }

  addTask(task) {
    this.tasks.push(task);
  }

  addTasks(tasks) {
    this.tasks = this.tasks.concat(tasks);
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
}

JobCounter.prototype.done = 0;
JobCounter.prototype.prepared = 0;
JobCounter.prototype.total = 0;
