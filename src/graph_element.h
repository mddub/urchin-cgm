#pragma once

#include <pebble.h>

#define SGV_COUNT 36

typedef struct GraphElement {
  Layer *graph_layer;
} GraphElement;

GraphElement* graph_element_create(Layer *parent);
void graph_element_destroy(GraphElement *el);
void graph_element_update(GraphElement *el, DictionaryIterator *data);
void graph_element_tick(GraphElement *el);
