#pragma once

#include <pebble.h>

ElementConfig* get_element_data(Layer* layer);
LayoutLayers init_layout(Window *window, int layout_option);
void deinit_layout();
