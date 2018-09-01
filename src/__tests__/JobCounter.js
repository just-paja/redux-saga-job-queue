import { JobCounter } from '..';

describe('JobCounter', () => {
  it('increments done tasks by one', () => {
    const jobCounter = new JobCounter(3);
    jobCounter.incrementDone();
    expect(jobCounter.getDone()).toEqual(1);
  });

  it('increments prepared tasks by one', () => {
    const jobCounter = new JobCounter(3);
    jobCounter.incrementPrepared();
    expect(jobCounter.getPrepared()).toEqual(1);
  });

  it('getStats returns job counter stats', () => {
    const jobCounter = new JobCounter(3);
    jobCounter.addTasks(['foo', 'bar']);
    expect(jobCounter.getStats()).toMatchObject({
      done: 0,
      prepared: 0,
      total: 2,
    });
  });

  it('addTask appends a task', () => {
    const jobCounter = new JobCounter(3);
    jobCounter.addTask('bar');
    expect(jobCounter.getTotal()).toEqual(1);
  });
});
