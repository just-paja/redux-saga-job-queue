import { buffers, channel } from 'redux-saga';
import {
  all,
  call,
  fork,
  put,
  take,
} from 'redux-saga/effects';

function* createQueue(handle, jobCounter) {
  const addTaskChannel = yield call(channel, buffers.expanding());
  const runChannel = yield call(channel, buffers.expanding());

  function* handleRequest(requestChannel) {
    while (!jobCounter.isFinished()) {
      const payload = yield take(requestChannel);
      yield handle(payload);
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

  return {
    watcher: watchRequests,
    addTaskChannel,
  };
}

export default createQueue;
