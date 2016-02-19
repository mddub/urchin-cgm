#pragma once

#include <pebble.h>
#include "connection_status_component.h"

#define GRAPH_EXTRA_BOLUS_OFFSET 0
#define GRAPH_EXTRA_BOLUS_BITS 1
#define GRAPH_EXTRA_BASAL_OFFSET 1
#define GRAPH_EXTRA_BASAL_BITS 5

typedef struct GraphElement {
  Layer *graph_layer;
  ConnectionStatusComponent *conn_status;
} GraphElement;

typedef struct GraphData {
  GColor color;
  int count;
  uint8_t* sgvs;
  uint8_t* extra;
} GraphData;

GraphElement* graph_element_create(Layer *parent);
void graph_element_destroy(GraphElement *el);
void graph_element_update(GraphElement *el, DictionaryIterator *data);
void graph_element_tick(GraphElement *el);
