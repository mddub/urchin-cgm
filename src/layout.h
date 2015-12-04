#pragma once

#include <pebble.h>
#include "config.h"

GColor element_bg(Layer* layer);
GColor element_fg(Layer* layer);
GCompOp element_comp_op(Layer* layer);
ElementConfig* get_element_data(Layer* layer);
GRect element_get_bounds(Layer* layer);
LayoutLayers init_layout(Window *window, int layout_option);
void deinit_layout();
