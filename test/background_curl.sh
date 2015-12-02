#!/bin/sh
# See the docstring for `pebble_set_config` in test/util.py.
(sleep 0.5; curl "$@") &
