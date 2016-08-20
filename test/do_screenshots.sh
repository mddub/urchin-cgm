#!/bin/bash

export BUILD_ENV=test
export MOCK_SERVER_PORT=5555

TEST_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start & background Flask server
python "$TEST_DIR/server.py" & PID=$!
sleep 1
bg

# Run tests
py.test test/ -v $@
TEST_RESULT=$?

pebble kill

# Kill Flask server
kill -9 $PID

unset BUILD_ENV
unset MOCK_SERVER_PORT

if [ $CIRCLECI ]; then
  exit $TEST_RESULT
else
  # Try to open the result in a browser
  OUT_FILE="$TEST_DIR/output/screenshots.html"
  [ `command -v open` ] && open $OUT_FILE
  [ `command -v xdg-open` ] && xdg-open $OUT_FILE
fi
