#pragma once

#include <pebble.h>

typedef struct BatteryComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  TextLayer *text_layer;
} BatteryComponent;

int battery_component_width();
int battery_component_height();
int battery_component_vertical_padding();
BatteryComponent* battery_component_create(Layer *parent, int x, int y, bool align_right);
void battery_component_destroy(BatteryComponent *c);
