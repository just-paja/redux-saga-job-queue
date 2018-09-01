# redux-saga-job-queue

Queue same redux saga tasks and run them in a batch.

## Install

Library is written for ES modules

```javascript
npm install redux-saga-job-queue
```

## Usage

Lets assume that you already have it installed. First we import it.

```javascript
import { createInteractiveQueue } from 'redux-saga-job-queue';
```

Second, we need to define a task that is going to be called for each item.

```javascript
function downloadFile({ payload }) {
  const payload = yield call(fetch, payload);
  yield put({
    type: 'FILE_READY',
    payload,
  });
}
```

Run the jobs in three parallel threads

```javascript
function* downloadFiles(files) {
  const queue = createInteractiveQueue({
    items: files,
    jobFactory: downloadFile,
    concurrency: 3,
  });
  yield call(queue.run);
}
```
