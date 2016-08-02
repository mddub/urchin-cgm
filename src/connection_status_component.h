#pragma once

#include <pebble.h>

typedef struct ConnectionStatusComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  TextLayer *staleness_text;
  GColor background;
  int16_t initial_text_width;
  int16_t initial_text_height;
  bool is_showing_request_state;
} ConnectionStatusComponent;

ConnectionStatusComponent* connection_status_component_create(Layer *parent, int x, int y);
void connection_status_component_destroy(ConnectionStatusComponent *c);
void connection_status_component_tick(ConnectionStatusComponent *c);
void connection_status_component_show_request_state(ConnectionStatusComponent *c, RequestState state, AppMessageResult reason);
