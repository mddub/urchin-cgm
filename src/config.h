#pragma once

#include <pebble.h>

///////////////////////////////////////////////////////
// CONFIGURATION: edit any of these values

// STALENESS ALERTS:
// Show an icon if there is unacceptable lag between any component of:
// Rig -> Nightscout -> Phone -> Pebble

// Longest time (minutes) phone can be unreachable by Bluetooth before alerting
#define PHONE_TO_PEBBLE_MAX_ACCEPTABLE_DELAY 10

// If Bluetooth is working, longest time (minutes) the network can be unreachable before alerting
#define WEB_TO_PHONE_MAX_ACCEPTABLE_DELAY 10

// Maximum age (minutes) of the data in Nightscout before alerting
#define RIG_TO_WEB_MAX_ACCEPTABLE_DELAY 20

// Even though the data is technically "stale" if we don't have a new
// reading every 5 minutes, there is some lag between the components
// of rig -> web -> phone -> Pebble. Give the data some extra time to
// propagate through the system before shifting the graph to the left
// to indicate staleness.
#define GRAPH_STALENESS_GRACE_PERIOD_SECONDS (3*60)

///////////////////////////////////////////////////////

#define GRAPH_MAX_SGV_COUNT 48
#define GRAPH_POINT_SIZE 3
#define GRAPH_INTERVAL_SIZE_SECONDS (5*60)

#define BOLUS_TICK_WIDTH 2
#define BOLUS_TICK_HEIGHT 7

enum {
  GRAPH_ELEMENT,
  SIDEBAR_ELEMENT,
  STATUS_BAR_ELEMENT,
  TIME_AREA_ELEMENT,
  BG_ROW_ELEMENT,
  MAX_LAYOUT_ELEMENTS,
};

// These are used to encode/decode layout preferences.
// The order should match constants.PROPERTIES.
enum {
  ELEMENT_TYPE,
  ELEMENT_ENABLED,
  ELEMENT_WIDTH,
  ELEMENT_HEIGHT,
  ELEMENT_BLACK,
  ELEMENT_BOTTOM,
  ELEMENT_RIGHT,
  NUM_ELEMENT_PROPERTIES,
};

#define NO_ICON -1

#define PERSIST_KEY_VERSION 0
#define PERSIST_KEY_PREFERENCES_OBJECT 1
