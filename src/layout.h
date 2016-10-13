#pragma once

#include <pebble.h>
#include "preferences.h"

typedef struct LayoutLayers {
  Layer *graph;
  Layer *sidebar;
  Layer *status_bar;
  Layer *time_area;
  Layer *bg_row;
} LayoutLayers;

TextLayer* add_text_layer(Layer *parent, GRect bounds, GFont font, GColor fg_color, GTextAlignment alignment);
GColor element_bg(Layer* layer);
GColor element_fg(Layer* layer);
GCompOp element_comp_op(Layer* layer);
ElementConfig* get_element_data(Layer* layer);
GRect element_get_bounds(Layer* layer);
LayoutLayers init_layout(Window *window);
void deinit_layout();
