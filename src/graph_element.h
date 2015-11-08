#pragma once

#include <pebble.h>

typedef struct GraphElement {
  Layer *graph_layer;
} GraphElement;

GraphElement* graph_element_create(Layer *parent);
void graph_element_destroy(GraphElement *el);
