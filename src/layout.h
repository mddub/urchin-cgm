#pragma once

#include <pebble.h>

#define GRAPH_ELEMENT 0
#define SIDEBAR_ELEMENT 1
#define ROW_ELEMENT 2
#define TIME_AREA_ELEMENT 3

typedef struct LayoutElementConfig {
  int el;
  int w;
  int h;
  bool bottom;
  bool right;
} LayoutElementConfig;

typedef struct LayoutLayers {
  Layer *graph;
  Layer *sidebar;
  Layer *row;
  Layer *time_area;
} LayoutLayers;

LayoutLayers init_layout(Window *window);
void deinit_layout();
