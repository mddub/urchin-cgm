#pragma once

#include <pebble.h>

typedef struct ConnectionStatusComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  TextLayer *reason_text;
  GColor background;
  bool align_bottom;
  GRect parent_bounds;
  int16_t initial_x;
  int16_t initial_y;
  bool is_showing_request_state;
} ConnectionStatusComponent;

ConnectionStatusComponent* connection_status_component_create(Layer *parent, int x, int y, bool align_bottom);
void connection_status_component_destroy(ConnectionStatusComponent *c);
void connection_status_component_tick(ConnectionStatusComponent *c);
void connection_status_component_update_offset(ConnectionStatusComponent* c, GSize size);
void connection_status_component_show_request_state(ConnectionStatusComponent *c, RequestState state, AppMessageResult reason);
uint16_t connection_status_component_size();
