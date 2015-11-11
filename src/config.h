#pragma once

#include <pebble.h>

#define LAYOUT_OPTION_A 0
#define LAYOUT_OPTION_B 1

///////////////////////////////////////////////////////
// CONFIGURATION: edit any of these values

// The details of the layout can be set in config.c
#define LAYOUT LAYOUT_OPTION_A

#define USE_MMOL false

// These must be specified in mg/dL
#define GRAPH_SGV_MIN 40
#define GRAPH_SGV_MAX 300
#define GRAPH_LIMIT_LINES {70, 180}
#define GRAPH_GRIDLINES {40, 50, 100, 150, 200, 250}

///////////////////////////////////////////////////////

#define GRAPH_SGV_COUNT 36

#define GRAPH_ELEMENT 0
#define SIDEBAR_ELEMENT 1
#define STATUS_BAR_ELEMENT 2
#define TIME_AREA_ELEMENT 3

#define MAX_LAYOUT_ELEMENTS 4

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
} LayoutLayers;

LayoutConfig* layout_config_create(int layout_option);
void layout_config_destroy(LayoutConfig* l_config);
