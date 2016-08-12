#pragma once

#include <pebble.h>

///////////////////////////////////////////////////////
// CONFIGURATION: edit any of these values

// Default delay between the timestamp of the last SGV reading and the
// next request for data
#define SGV_UPDATE_FREQUENCY_SECONDS (5*60 + 30)

// Even though the data is technically "stale" if we don't have a new
// reading every 5 minutes, there is some lag between the components
// of rig -> web -> phone -> Pebble. Give the data some extra time to
// propagate through the system before shifting the graph to the left
// to indicate staleness.
#define GRAPH_STALENESS_GRACE_PERIOD_SECONDS (3*60)

///////////////////////////////////////////////////////
