export default class Queue {
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
    return this.tasksFinished;
  }

  getPrepared() {
    return this.tasksPrepared;
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
    this.tasksFinished += 1;
  }

  incrementPrepared() {
    this.tasksPrepared += 1;
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

Queue.prototype.tasksFinished = 0;
Queue.prototype.tasksPrepared = 0;
