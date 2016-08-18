#!/bin/bash
# A hacky script to make test-driven iteration much faster.
#
# Call with the name of a test class defined in test_screenshots.py, and it
# will reload the emulator with its config and data on every file change.
#
# For other options, see: python test/set_config.py -h

run () {
  TEST_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

  export MOCK_SERVER_PORT=5555
  set -x

  python "$TEST_DIR/server.py" --test-class "$@" & PID=$!
  sleep 1
  bg

  python "$TEST_DIR/set_config.py" "$@"

  # Requires watchdog
  watchmedo shell-command --patterns="**/test_screenshots.py" --recursive --command="python $TEST_DIR/set_config.py $@" $TEST_DIR

  kill -9 $PID

  set +x
  unset MOCK_SERVER_PORT
}

if [[ $# -eq 0 ]] ; then
  echo 'Name of test class is required argument'
else
  run $@
fi
