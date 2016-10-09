#pragma once

#include <pebble.h>
#include "app_messages.h"

typedef struct TrendArrowComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  int8_t last_trend;
} TrendArrowComponent;

uint8_t trend_arrow_component_width();
uint8_t trend_arrow_component_height();
TrendArrowComponent* trend_arrow_component_create(Layer *parent, int16_t x, int16_t y);
void trend_arrow_component_destroy(TrendArrowComponent *c);
void trend_arrow_component_update(TrendArrowComponent *c, DataMessage *data);
void trend_arrow_component_reposition(TrendArrowComponent *c, int16_t x, int16_t y);
bool trend_arrow_component_hidden(TrendArrowComponent *c);
