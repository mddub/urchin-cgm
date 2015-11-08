#include "graph_element.h"

GraphElement* graph_element_create(Layer *parent) {
  GRect bounds = layer_get_bounds(parent);

  Layer* graph_layer = layer_create(GRect(0, 0, bounds.size.w, bounds.size.h));
  layer_add_child(parent, graph_layer);

  GraphElement *el = malloc(sizeof(GraphElement));
  el->graph_layer = graph_layer;
  return el;
}

void graph_element_destroy(GraphElement *el) {
  layer_destroy(el->graph_layer);
  free(el);
}
