import SagaTester from 'redux-saga-tester';
import sinon from 'sinon';

import { call, put } from 'redux-saga/effects';
import { channel } from 'redux-saga';

import { createQueue, createJob, Queue } from '..';

const mockJobCounter = (...args) => {
  const jobCounter = new Queue(...args);
  return jobCounter;
};

describe('jobs saga', () => {
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
    sagaTester.run(runJob, { payload: 'foo' });
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

  it('createQueue provides run saga', () => {
    expect(createQueue({}).run.constructor).toHaveProperty('name', 'GeneratorFunction');
  });

  it('createQueue.run passes queueIndex to items', () => {
    const jobFactory = sinon.spy();
    const items = ['foo', 'bar'];
    const queue = createQueue({
      items,
      jobFactory,
    });
    sagaTester.run(queue.run);
    expect(jobFactory.getCall(0).args).toContainEqual(expect.objectContaining({
      meta: expect.objectContaining({
        queueIndex: 0,
      }),
    }));
    expect(jobFactory.getCall(1).args).toContainEqual(expect.objectContaining({
      meta: expect.objectContaining({
        queueIndex: 1,
      }),
    }));
  });

  it('createQueue.run runs all tasks', () => {
    const jobFactory = sinon.spy();
    const items = ['foo', 'bar'];
    const queue = createQueue({
      items,
      jobFactory,
    });
    sagaTester.run(queue.run);
    expect(jobFactory.called).toBeTruthy();
  });

  it('createQueue.run runs all tasks in packets', () => {
    function* jobFactory(item) {
      yield put({ type: 'TEST', item });
      yield new Promise(resolve => clock.setTimeout(resolve, 5));
    }
    const items = ['foo', 'bar', 'zoo', 'tar', 'voo', 'xar'];
    const queue = createQueue({
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

  it('createQueue.run marks queue done on finish', () => {
    function* jobFactory(item) {
      yield put({ type: 'TEST', item });
      // yield new Promise(res => clock.setTimeout(res, 5));
    }
    const items = ['foo', 'bar', 'zoo'];
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 2,
    });
    sagaTester.run(queue.run);
    expect(queue.isFinished()).toBe(true);
  });

  it('createQueue.run finishes running', () => {
    function* jobFactory(item) {
      yield put({ type: 'TEST', item });
      // yield new Promise(res => clock.setTimeout(res, 5));
    }
    const items = ['foo', 'bar', 'zoo'];
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 2,
    });
    function* testSaga() {
      yield call(queue.run);
      yield put({ type: 'TEST_FINISHED' });
    }
    sagaTester.run(testSaga);
    return sagaTester.waitFor('TEST_FINISHED')
      .then(() => expect(queue.isFinished()).toBe(true));
  });

  it('createQueue.addItems to the running queue', () => {
    function* jobFactory(item) {
      yield put({ type: 'TEST', item });
      yield new Promise(res => clock.setTimeout(res, 5));
    }
    const items = ['foo', 'bar', 'zoo'];
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 2,
    });
    sagaTester.run(queue.run);
    clock.tick(5);
    sagaTester.run(queue.addItems, ['zxc', 'vbn']);
    return sagaTester
      .waitFor('TEST')
      .then(() => clock.tick(5))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => clock.tick(5))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => expect(sagaTester.numCalled('TEST')).toBe(5));
  });
});
