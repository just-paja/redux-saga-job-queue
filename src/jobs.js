import { buffers, channel } from '@redux-saga/core'
import { all, call, fork, put, take } from '@redux-saga/core/effects'

import Queue from './Queue'

import { jobsDone } from './actions'

export const createJob = ({
  allDoneChannel,
  jobCounter,
  jobFactory,
  ...other
}) => function * runJob ({ payload, meta }) {
  try {
    yield call(jobFactory, { payload, meta: { ...other, ...meta } })
  } finally {
    jobCounter.incrementDone()
    if (jobCounter.isFinished()) {
      yield allDoneChannel.put(jobsDone())
    }
  }
}

export const createQueue = ({
  jobFactory,
  items,
  concurrency = 3,
  ...other
}) => {
  const jobCounter = new Queue(concurrency)
  let allDoneChannel
  let jobRunner
  let prepareChannel
  let runChannel

  /**
   * Run jobs while there are any
   * @returns void
   */
  function * handleRequest () {
    jobCounter.incrementRunningForks()
    while (!jobCounter.isFinished()) {
      const action = yield take(runChannel)
      yield call(jobRunner, action)
    }
    jobCounter.decrementRunningForks()
  }

  /**
   * Starts amount of concurrent forks required to satisfy the settings and the
   * demand.
   */
  function * startConcurrentForks () {
    const forksRequired = jobCounter.concurrency - jobCounter.getRunningForks()
    yield all(Array(forksRequired).fill(fork(handleRequest)))
  }

  /**
   * Prepares method buffer for making tasks run in specified concurrency. Fills
   * runChannel with items and lets handleRequest process them in groups. Closes
   * the prepareChannel in the end to prevent memleaks.
   * @returns void
   */
  function * watchAddedItems () {
    yield fork(startConcurrentForks)
    while (!jobCounter.isPrepared()) {
      const action = yield take(prepareChannel)
      yield put(runChannel, action)
      jobCounter.incrementPrepared()
    }
    closeChannel(prepareChannel)
  }

  function closeChannel (channelInstance) {
    channelInstance.close()
    channelInstance.open = false
  }

  /**
   * Handles openning a channel when its closed or missing. Internal saga,
   * should not be exposed.
   * @returns void
   */
  function * reopenChannel (channelInstance) {
    const openChannelInstance = (!channelInstance || !channelInstance.open)
      ? yield call(channel, buffers.expanding())
      : channelInstance
    openChannelInstance.open = true
    return openChannelInstance
  }

  /**
   * Open channels necessary for queueing tasks. Internal saga, should not
   * be exposed.
   * @returns void
   */
  function * openAddChannels () {
    prepareChannel = yield call(reopenChannel, prepareChannel)
    runChannel = yield call(reopenChannel, runChannel)
  }

  /**
   * Add items into a running queue. Useful when expading list of tasks to be
   * done is extended, for example files to be downloaded. Exits immediately.
   * Usage: yield call(queue.addItems, ['item1', 'item2'])
   * @returns void
   */
  function * addItems (newItems) {
    yield call(openAddChannels)
    jobCounter.addTasks(newItems)
    /* @FIXME There is a potential problem with forking watchAddedItems saga
     * adding items while items are being added might cause unforseen
     * consequences, like race conditions
     */
    yield fork(watchAddedItems)
    yield all(newItems.map((payload, queueIndex) => put(prepareChannel, {
      payload,
      meta: { queueIndex }
    })))
  }

  /**
   * Run the queue and do all the magic. Saga runs until the whole queue
   * is finished.
   * Usage: yield call(queue.run)
   * @returns void
   */
  function * run () {
    allDoneChannel = yield call(channel)
    jobRunner = createJob({
      allDoneChannel,
      jobCounter,
      jobFactory,
      ...other
    })
    yield fork(addItems, items)
    yield take(allDoneChannel)
    runChannel.close()
  }

  jobCounter.run = run
  jobCounter.addItems = addItems
  return jobCounter
}
