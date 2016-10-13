#pragma once

#include <pebble.h>
#include "app_messages.h"
#include "comm.h"
#include "connection_status_component.h"
#include "recency_component.h"

typedef struct GraphElement {
  Layer *graph_layer;
  ConnectionStatusComponent *conn_status;
  RecencyComponent *recency;
} GraphElement;

typedef struct GraphData {
  GColor color;
} GraphData;

GraphElement* graph_element_create(Layer *parent);
void graph_element_destroy(GraphElement *el);
void graph_element_update(GraphElement *el, DataMessage *data);
void graph_element_tick(GraphElement *el);
void graph_element_show_request_state(GraphElement *el, RequestState state, AppMessageResult reason);
