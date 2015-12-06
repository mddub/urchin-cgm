#pragma once

#include <pebble.h>

typedef struct TrendArrowComponent {
  BitmapLayer *icon_layer;
  GBitmap *icon_bitmap;
  int last_trend;
} TrendArrowComponent;

int trend_arrow_component_width();
int trend_arrow_component_height();
int trend_arrow_component_vertical_padding();
TrendArrowComponent* trend_arrow_component_create(Layer *parent, int x, int y);
void trend_arrow_component_destroy(TrendArrowComponent *c);
void trend_arrow_component_update(TrendArrowComponent *c, DictionaryIterator *data);
void trend_arrow_component_reposition(TrendArrowComponent *c, int x, int y);
bool trend_arrow_component_hidden(TrendArrowComponent *c);
