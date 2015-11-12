#pragma once

#include <pebble.h>

typedef struct ConnectionStatusComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  TextLayer *staleness_text;
} ConnectionStatusComponent;

ConnectionStatusComponent* connection_status_component_create(Layer *parent, int x, int y);
void connection_status_component_destroy(ConnectionStatusComponent *c);
void connection_status_component_refresh(ConnectionStatusComponent *c);
