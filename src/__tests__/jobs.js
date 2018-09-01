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
  sinon.stub(jobCounter, 'addTask');
  sinon.stub(jobCounter, 'getDone');
  sinon.stub(jobCounter, 'getPrepared');
  sinon.stub(jobCounter, 'getStats');
  sinon.stub(jobCounter, 'getTotal');
  sinon.stub(jobCounter, 'incrementDone');
  sinon.stub(jobCounter, 'incrementPrepared');
  sinon.stub(jobCounter, 'isFinished');
  sinon.stub(jobCounter, 'setConcurrency');
  sinon.stub(jobCounter, 'setTasks');
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
    clock.restore();
  });

  it('createJob returns a generator', () => {
    expect(createJob({}).constructor).toHaveProperty('name', 'GeneratorFunction');
  });

  it('createJob.runJob calls the job', () => {
    const jobFactory = sinon.spy();
    const runJob = createJob({
      allDoneChannel,
      jobCounter: mockJobCounter([]),
      jobFactory,
    });
    sagaTester.run(runJob);
    expect(jobFactory.calledOnce).toBeTruthy();
  });

  it('createJob.runJob increments done when job finished', () => {
    const jobFactory = sinon.spy();
    const jobCounter = mockJobCounter(['foo']);
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
    const jobCounter = mockJobCounter(['foo']);
    jobCounter.getTotal.returns(1);
    jobCounter.getDone.returns(1);
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
      yield new Promise(res => setTimeout(res, 5));
    }
    const items = ['foo', 'bar', 'zoo', 'tar', 'voo', 'xar'];
    const queue = createInteractiveQueue({
      items,
      jobFactory,
      concurrency: 2,
    });
    sagaTester.run(queue.run);
    clock.tick(5);
    expect(sagaTester.numCalled('TEST')).toEqual(2);
    clock.tick(5);
    return sagaTester.waitFor('TEST', () => {
      expect(sagaTester.numCalled('TEST')).toEqual(4);
      clock.tick(5);
      expect(sagaTester.numCalled('TEST')).toEqual(6);
    });
  });
});