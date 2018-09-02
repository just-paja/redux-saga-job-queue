import { buffers, channel } from 'redux-saga';
import {
  all,
  call,
  fork,
  put,
  take,
} from 'redux-saga/effects';

import Queue from './Queue';

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
      if (jobCounter.isFinished()) {
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
  const jobCounter = new Queue(concurrency);
  let allDoneChannel;
  let jobRunner;
  let prepareChannel;
  let runChannel;

  function* handleRequest() {
    while (!jobCounter.isFinished()) {
      const payload = yield take(runChannel);
      yield call(jobRunner, payload);
    }
  }

  function* watchRequests() {
    yield all(Array(jobCounter.concurrency).fill(fork(handleRequest)));
    while (!jobCounter.isPrepared()) {
      const { payload } = yield take(prepareChannel);
      yield put(runChannel, payload);
      jobCounter.incrementPrepared();
    }
    prepareChannel.close();
    runChannel.close();
  }

  function* run() {
    prepareChannel = yield call(channel, buffers.expanding());
    runChannel = yield call(channel, buffers.expanding());
    allDoneChannel = yield call(channel);
    jobRunner = createJob({
      allDoneChannel,
      jobCounter,
      jobFactory,
      ...other,
    });

    jobCounter.addTasks(items);
    yield fork(watchRequests);
    yield all(items.map(payload => put(prepareChannel, { payload })));
    yield take(allDoneChannel);
  }

  jobCounter.run = run;
  return jobCounter;
};
