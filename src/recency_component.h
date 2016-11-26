#pragma once

#include <pebble.h>

typedef struct RecencyComponent {
  Layer *circle_layer;
} RecencyComponent;

typedef struct RecencyProps {
  bool align_right;
  GColor parent_bg;
  GColor parent_fg;
  void (*size_changed_callback)(GSize, void*);
  void *size_changed_context;
} RecencyProps;

typedef struct RecencyStyle {
  uint8_t font;
  uint8_t diameter;
  uint8_t inset;
} RecencyStyle;

uint16_t recency_component_height();
uint16_t recency_component_x_padding();
uint16_t recency_component_y_padding();
RecencyComponent* recency_component_create(Layer *parent, uint16_t y, bool align_right, void (*size_changed_callback)(GSize, void*), void *size_changed_context);
void recency_component_destroy(RecencyComponent *c);
void recency_component_tick(RecencyComponent *c);
