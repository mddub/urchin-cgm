#pragma once

#include <pebble.h>

#define LAYOUT_OPTION_A 0
#define LAYOUT_OPTION_B 1

///////////////////////////////////////////////////////
// CONFIGURATION: edit any of these values

// The details of the layout can be set in config.c
#define LAYOUT LAYOUT_OPTION_A

#define UPDATE_FREQUENCY (60*1000)

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

#define GRAPH_ELEMENT 0
#define SIDEBAR_ELEMENT 1
#define STATUS_BAR_ELEMENT 2
#define TIME_AREA_ELEMENT 3
#define BG_ROW_ELEMENT 4

#define MAX_LAYOUT_ELEMENTS 4

#define NO_ICON -1

#define PERSIST_KEY_VERSION 0
#define PERSIST_KEY_PREFERENCES_OBJECT 1

typedef struct ElementConfig {
  int el;
  int w;
  int h;
  bool bottom;
  bool right;
} ElementConfig;

typedef struct LayoutConfig {
  int num_elements;
  ElementConfig* elements;
} LayoutConfig;

typedef struct LayoutLayers {
  Layer *graph;
  Layer *sidebar;
  Layer *status_bar;
  Layer *time_area;
  Layer *bg_row;
} LayoutLayers;

LayoutConfig* layout_config_create(int layout_option);
void layout_config_destroy(LayoutConfig* l_config);
