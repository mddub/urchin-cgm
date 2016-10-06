#pragma once

#include <pebble.h>

typedef struct ConnectionStatusComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  TextLayer *reason_text;
  GColor background;
  bool align_bottom;
  GSize parent_size;
  int16_t initial_x;
  int16_t initial_y;
  int16_t initial_text_width;
  int16_t initial_text_height;
  bool is_showing_request_state;
} ConnectionStatusComponent;

ConnectionStatusComponent* connection_status_component_create(Layer *parent, int x, int y, bool align_bottom);
void connection_status_component_destroy(ConnectionStatusComponent *c);
void connection_status_component_tick(ConnectionStatusComponent *c);
void connection_status_component_update_offset(ConnectionStatusComponent* c, GSize size);
void connection_status_component_show_request_state(ConnectionStatusComponent *c, RequestState state, AppMessageResult reason);
uint16_t connection_status_component_size();
