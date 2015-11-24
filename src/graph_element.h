#pragma once

#include <pebble.h>
#include "connection_status_component.h"

typedef struct GraphElement {
  Layer *graph_layer;
  ConnectionStatusComponent *conn_status;
} GraphElement;

typedef struct GraphData {
  int count;
  char* sgvs;
} GraphData;

GraphElement* graph_element_create(Layer *parent);
void graph_element_destroy(GraphElement *el);
void graph_element_update(GraphElement *el, DictionaryIterator *data);
void graph_element_tick(GraphElement *el);
