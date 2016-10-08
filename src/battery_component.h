#pragma once

#include <pebble.h>

typedef struct BatteryComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  TextLayer *text_layer;
} BatteryComponent;

uint8_t battery_component_width();
uint8_t battery_component_height();
uint8_t battery_component_vertical_padding();
BatteryComponent* battery_component_create(Layer *parent, int16_t x, int16_t y, bool align_right);
void battery_component_destroy(BatteryComponent *c);
