import SagaTester from 'redux-saga-tester'
import sinon from 'sinon'

import { call, put } from 'redux-saga/effects'
import { channel } from 'redux-saga'

import { createQueue, createJob, Queue } from '..'

const mockJobCounter = (...args) => {
  const jobCounter = new Queue(...args)
  return jobCounter
}

describe('jobs saga', () => {
  let allDoneChannel
  let sagaTester
  let onError
  let clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
    onError = jest.fn()
    sagaTester = new SagaTester({
      reducers: state => state,
      initialState: {},
      options: { onError }
    })
    allDoneChannel = channel()
    jest.spyOn(allDoneChannel, 'put').mockImplementation(() => {})
  })

  afterEach(() => {
    // clock.restore()
  })

  it('createJob returns a generator', () => {
    expect(createJob({}).constructor).toHaveProperty('name', 'GeneratorFunction')
  })

  it('createJob.runJob calls the job', () => {
    const jobFactory = jest.fn()
    const runJob = createJob({
      allDoneChannel,
      jobCounter: mockJobCounter(),
      jobFactory
    })
    sagaTester.run(runJob, { payload: 'foo' })
    expect(jobFactory).toHaveBeenCalledTimes(1)
  })

  it('createJob.runJob increments done when job finished', () => {
    const jobFactory = jest.fn()
    const jobCounter = mockJobCounter()
    jest.spyOn(jobCounter, 'incrementDone').mockImplementation(() => {})
    jobCounter.addTasks(['foo'])
    const runJob = createJob({
      allDoneChannel,
      jobCounter,
      jobFactory
    })
    sagaTester.run(runJob, 'foo')
    expect(jobCounter.incrementDone).toHaveBeenCalledTimes(1)
  })

  it('createJob.runJob puts jobs done action when it is the last task', () => {
    const jobFactory = jest.fn()
    const jobCounter = mockJobCounter()
    jobCounter.addTasks(['foo'])
    jobCounter.incrementPrepared()
    jobCounter.incrementDone()
    const runJob = createJob({
      allDoneChannel,
      jobCounter,
      jobFactory
    })
    sagaTester.run(runJob, 'foo')
    expect(allDoneChannel.put).toHaveBeenCalledTimes(1)
    expect(allDoneChannel.put).toHaveBeenCalledWith(expect.objectContaining({
      type: 'JOB_QUEUE/JOBS_DONE'
    }))
  })

  it('createQueue provides run saga', () => {
    expect(createQueue({}).run.constructor).toHaveProperty('name', 'GeneratorFunction')
  })

  it('createQueue.run passes queueIndex to items', () => {
    const jobFactory = jest.fn()
    const items = ['foo', 'bar']
    const queue = createQueue({
      items,
      jobFactory
    })
    sagaTester.run(queue.run)
    expect(jobFactory).toHaveBeenCalledWith(expect.objectContaining({
      meta: expect.objectContaining({ queueIndex: 0 })
    }))
    expect(jobFactory).toHaveBeenCalledWith(expect.objectContaining({
      meta: expect.objectContaining({ queueIndex: 1 })
    }))
  })

  it('createQueue.run runs all tasks', () => {
    const jobFactory = jest.fn()
    const items = ['foo', 'bar']
    const queue = createQueue({ items, jobFactory })
    sagaTester.run(queue.run)
    expect(jobFactory).toHaveBeenCalled()
  })

  it('createQueue.run runs all tasks in packets', () => {
    function * jobFactory (item) {
      yield put({ type: 'TEST', item })
      yield new Promise(resolve => clock.setTimeout(resolve, 5))
    }
    const items = ['foo', 'bar', 'zoo', 'tar', 'voo', 'xar']
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 2
    })
    sagaTester.start(queue.run)
    clock.tick(5)
    expect(sagaTester.numCalled('TEST')).toEqual(2)
    clock.tick(5)
    return sagaTester.waitFor('TEST')
      .then(() => {
        expect(sagaTester.numCalled('TEST')).toEqual(4)
        clock.tick(5)
      })
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => {
        expect(sagaTester.numCalled('TEST')).toEqual(6)
      })
  })

  it('createQueue.run runs all tasks in packets', () => {
    function * jobFactory (item) {
      yield put({ type: 'TEST', item })
      yield new Promise(resolve => clock.setTimeout(resolve, 5))
    }
    const items = [
      'foo1', 'bar1', 'zoo1', 'tar1', 'voo1', 'xar1',
      'foo2', 'bar2', 'zoo2', 'tar2', 'voo2', 'xar2',
      'foo3', 'bar3', 'zoo3', 'tar3', 'voo3', 'xar3'
    ]
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 3
    })
    sagaTester.start(queue.run)
    // clock.tick(50)
    // expect(sagaTester.numCalled('TEST')).toEqual(2)
    clock.tick(5000)
    return sagaTester.waitFor('TEST')
      .then(() => clock.tick(5000))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => clock.tick(5000))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => clock.tick(5000))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => clock.tick(5000))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => {
        expect(sagaTester.numCalled('TEST')).toEqual(18)
        clock.tick(50)
      })
  })

  it('createQueue.run marks queue done on finish', () => {
    function * jobFactory (item) {
      yield put({ type: 'TEST', item })
      // yield new Promise(res => clock.setTimeout(res, 5))
    }
    const items = ['foo', 'bar', 'zoo']
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 2
    })
    sagaTester.run(queue.run)
    expect(queue.isFinished()).toBe(true)
  })

  it('createQueue.run finishes running', () => {
    function * jobFactory (item) {
      yield put({ type: 'TEST', item })
      // yield new Promise(res => clock.setTimeout(res, 5))
    }
    const items = ['foo', 'bar', 'zoo']
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 2
    })
    function * testSaga () {
      yield call(queue.run)
      yield put({ type: 'TEST_FINISHED' })
    }
    sagaTester.run(testSaga)
    return sagaTester.waitFor('TEST_FINISHED')
      .then(() => expect(queue.isFinished()).toBe(true))
  })

  it('createQueue.addItems to the running queue', () => {
    function * jobFactory (item) {
      yield put({ type: 'TEST', item })
      yield new Promise((resolve, reject) => clock.setTimeout(resolve, 5))
    }
    const items = ['foo', 'bar', 'zoo']
    const queue = createQueue({
      items,
      jobFactory,
      concurrency: 2
    })
    sagaTester.run(queue.run)
    clock.tick(5)
    sagaTester.run(queue.addItems, ['zxc', 'vbn'])
    return sagaTester
      .waitFor('TEST')
      .then(() => clock.tick(5))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => clock.tick(5))
      .then(() => sagaTester.waitFor('TEST'))
      .then(() => expect(sagaTester.numCalled('TEST')).toBe(5))
  })
})
