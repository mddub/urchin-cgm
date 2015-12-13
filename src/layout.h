#pragma once

#include <pebble.h>
#include "config.h"
#include "preferences.h"

typedef struct LayoutLayers {
  Layer *graph;
  Layer *sidebar;
  Layer *status_bar;
  Layer *time_area;
  Layer *bg_row;
} LayoutLayers;

GColor element_bg(Layer* layer);
GColor element_fg(Layer* layer);
GCompOp element_comp_op(Layer* layer);
ElementConfig* get_element_data(Layer* layer);
GRect element_get_bounds(Layer* layer);
LayoutLayers init_layout(Window *window);
void deinit_layout();
