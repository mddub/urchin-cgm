#!/bin/sh
# See the docstring for `pebble_set_config` in test/util.py.
(sleep $SLEEP_TIME; curl "$@") &
