import SagaTester from 'redux-saga-tester';
import sinon from 'sinon';

import { put } from 'redux-saga/effects';
import { channel } from 'redux-saga';

import {
  createInteractiveQueue,
  createJob,
  JobCounter,
} from '..';

const mockJobCounter = (...args) => {
  const jobCounter = new JobCounter(...args);
  return jobCounter;
};

describe('jobs sagas', () => {
  let allDoneChannel;
  let sagaTester;
  let onError;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    onError = sinon.spy();
    sagaTester = new SagaTester({
      reducers: state => state,
      initialState: {},
      options: {
        onError,
      },
    });
    allDoneChannel = channel();
    sinon.stub(allDoneChannel, 'put');
  });

  afterEach(() => {
    // clock.restore();
  });

  it('createJob returns a generator', () => {
    expect(createJob({}).constructor).toHaveProperty('name', 'GeneratorFunction');
  });

  it('createJob.runJob calls the job', () => {
    const jobFactory = sinon.spy();
    const runJob = createJob({
      allDoneChannel,
      jobCounter: mockJobCounter(),
      jobFactory,
    });
    sagaTester.run(runJob);
    expect(jobFactory.calledOnce).toBeTruthy();
  });

  it('createJob.runJob increments done when job finished', () => {
    const jobFactory = sinon.spy();
    const jobCounter = mockJobCounter();
    sinon.stub(jobCounter, 'incrementDone');
    jobCounter.addTasks(['foo']);
    const runJob = createJob({
      allDoneChannel,
      jobCounter,
      jobFactory,
    });
    sagaTester.run(runJob, 'foo');
    expect(jobCounter.incrementDone.calledOnce).toBeTruthy();
  });

  it('createJob.runJob puts jobs done action when it is the last task', () => {
    const jobFactory = sinon.spy();
    const jobCounter = mockJobCounter();
    jobCounter.addTasks(['foo']);
    jobCounter.incrementPrepared();
    jobCounter.incrementDone();
    const runJob = createJob({
      allDoneChannel,
      jobCounter,
      jobFactory,
    });
    sagaTester.run(runJob, 'foo');
    expect(allDoneChannel.put.calledOnce).toEqual(true);
    expect(allDoneChannel.put.getCall(0).args).toContainEqual(expect.objectContaining({
      type: 'JOB_QUEUE/JOBS_DONE',
    }));
  });

  it('createInteractiveQueue provides run saga', () => {
    expect(createInteractiveQueue({}).run.constructor).toHaveProperty('name', 'GeneratorFunction');
  });

  it('createInteractiveQueue.run runs all tasks', () => {
    const jobFactory = sinon.spy();
    const items = ['foo', 'bar'];
    const queue = createInteractiveQueue({
      items,
      jobFactory,
    });
    sagaTester.run(queue.run);
    expect(jobFactory.called).toBeTruthy();
  });

  it('createInteractiveQueue.run runs all tasks in packets', () => {
    function* jobFactory(item) {
      yield put({ type: 'TEST', item });
      yield new Promise(resolve => clock.setTimeout(resolve, 5));
    }
    const items = ['foo', 'bar', 'zoo', 'tar', 'voo', 'xar'];
    const queue = createInteractiveQueue({
      items,
      jobFactory,
      concurrency: 2,
    });
    sagaTester.start(queue.run);
    clock.tick(5);
    expect(sagaTester.numCalled('TEST')).toEqual(2);
    clock.tick(5);
    return sagaTester.waitFor('TEST')
      .then(() => {
        expect(sagaTester.numCalled('TEST')).toEqual(4);
        clock.tick(5);
      })
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => {
        expect(sagaTester.numCalled('TEST')).toEqual(6);
      });
  });

  it('createInteractiveQueue.run marks queue done on finish', () => {
    function* jobFactory(item) {
      yield put({ type: 'TEST', item });
      // yield new Promise(res => clock.setTimeout(res, 5));
    }
    const items = ['foo', 'bar', 'zoo'];
    const queue = createInteractiveQueue({
      items,
      jobFactory,
      concurrency: 2,
    });
    sagaTester.run(queue.run);
    expect(queue).toHaveProperty('done', true);
  });
});
