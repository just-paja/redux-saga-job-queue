import { buffers, channel } from 'redux-saga';
import {
  all,
  call,
  fork,
  put,
  take,
} from 'redux-saga/effects';

import JobCounter from './JobCounter';

import { jobsDone } from './actions';

export const createJob = ({
  allDoneChannel,
  jobCounter,
  jobFactory,
  ...meta
}) => (
  function* runJob(payload) {
    try {
      yield call(jobFactory, { payload, meta });
    } finally {
      jobCounter.incrementDone();
      if (jobCounter.getTotal() === jobCounter.getDone()) {
        yield allDoneChannel.put(jobsDone());
      }
    }
  }
);

export const createInteractiveQueue = ({
  jobFactory,
  items,
  concurrency = 3,
  ...other
}) => {
  let addTaskChannel;
  let allDoneChannel;
  let jobCounter;
  let runChannel;
  let jobRunner;

  function* handleRequest(requestChannel) {
    while (!jobCounter.isFinished()) {
      const payload = yield take(requestChannel);
      yield jobRunner(payload);
    }
  }

  function* watchRequests() {
    yield all(Array(jobCounter.concurrency).fill(fork(handleRequest, runChannel)));
    while (!jobCounter.isPrepared()) {
      const { payload } = yield take(addTaskChannel);
      yield put(runChannel, payload);
      jobCounter.incrementPrepared();
    }
    addTaskChannel.close();
    runChannel.close();
  }

  function* run() {
    addTaskChannel = yield call(channel, buffers.expanding());
    runChannel = yield call(channel, buffers.expanding());
    allDoneChannel = yield call(channel);
    jobCounter = new JobCounter(items, concurrency);
    jobRunner = createJob({
      allDoneChannel,
      jobCounter,
      jobFactory,
      ...other,
    });

    yield fork(watchRequests);
    yield all(items.map(payload => put(addTaskChannel, { payload })));
    yield take(allDoneChannel);
  }

  return {
    run,
  };
};
