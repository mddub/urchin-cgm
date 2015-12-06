#include "app_keys.h"
#include "config.h"
#include "layout.h"
#include "staleness.h"
#include "trend_arrow_component.h"

#define TREND_ARROW_WIDTH 25

// TODO define a "big" and "small" set of icons
const int TREND_ICONS[] = {
  NO_ICON,
  RESOURCE_ID_ARROW_DOUBLE_UP,
  RESOURCE_ID_ARROW_SINGLE_UP,
  RESOURCE_ID_ARROW_FORTY_FIVE_UP,
  RESOURCE_ID_ARROW_FLAT,
  RESOURCE_ID_ARROW_FORTY_FIVE_DOWN,
  RESOURCE_ID_ARROW_SINGLE_DOWN,
  RESOURCE_ID_ARROW_DOUBLE_DOWN,
  NO_ICON,
  NO_ICON
};

int trend_arrow_component_width() {
  return TREND_ARROW_WIDTH;
}

int trend_arrow_component_height() {
  return TREND_ARROW_WIDTH;
}

TrendArrowComponent* trend_arrow_component_create(Layer *parent, int x, int y) {
  BitmapLayer *icon_layer = bitmap_layer_create(GRect(x, y, TREND_ARROW_WIDTH, TREND_ARROW_WIDTH));
  bitmap_layer_set_compositing_mode(icon_layer, element_comp_op(parent));
  layer_set_hidden(bitmap_layer_get_layer(icon_layer), true);
  layer_add_child(parent, bitmap_layer_get_layer(icon_layer));

  TrendArrowComponent *c = malloc(sizeof(TrendArrowComponent));
  c->icon_layer = icon_layer;
  c->icon_bitmap = NULL;
  c->last_trend = -1;
  return c;
}

void trend_arrow_component_destroy(TrendArrowComponent *c) {
  if (c->icon_bitmap != NULL) {
    gbitmap_destroy(c->icon_bitmap);
  }
  bitmap_layer_destroy(c->icon_layer);
  free(c);
}

void trend_arrow_component_update(TrendArrowComponent *c, DictionaryIterator *data) {
  if (graph_staleness_padding() > 0) {
    c->last_trend = -1;
    layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), true);
    return;
  }

  int trend = dict_find(data, APP_KEY_TREND)->value->int32;
  if (trend == c->last_trend) {
    return;
  }
  c->last_trend = trend;

  if (TREND_ICONS[trend] == NO_ICON) {
    layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), true);
  } else {
    layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), false);
    if (c->icon_bitmap != NULL) {
      gbitmap_destroy(c->icon_bitmap);
    }
    c->icon_bitmap = gbitmap_create_with_resource(TREND_ICONS[trend]);
    bitmap_layer_set_bitmap(c->icon_layer, c->icon_bitmap);
  }
}

void trend_arrow_component_reposition(TrendArrowComponent *c, int x, int y) {
  GRect frame = layer_get_frame(bitmap_layer_get_layer(c->icon_layer));
  layer_set_frame(
    bitmap_layer_get_layer(c->icon_layer),
    GRect(x, y, frame.size.w, frame.size.h)
  );
}

bool trend_arrow_component_hidden(TrendArrowComponent *c) {
  return layer_get_hidden(bitmap_layer_get_layer(c->icon_layer));
}
