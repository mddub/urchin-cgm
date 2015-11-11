#include "app_keys.h"
#include "config.h"
#include "sidebar_element.h"
#include "units.h"

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

SidebarElement* sidebar_element_create(Layer *parent) {
  GRect bounds = layer_get_bounds(parent);

  TextLayer *last_bg_text = text_layer_create(GRect(0, 3, bounds.size.w, 24));
  text_layer_set_font(last_bg_text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_background_color(last_bg_text, GColorClear);
  text_layer_set_text_alignment(last_bg_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(last_bg_text));

  int trend_arrow_width = 25;
  BitmapLayer *trend_layer = bitmap_layer_create(GRect((bounds.size.w - trend_arrow_width) / 2, 3 + 28, trend_arrow_width, trend_arrow_width));
  layer_add_child(parent, bitmap_layer_get_layer(trend_layer));

  TextLayer *delta_text = text_layer_create(GRect(0, 3 + 22 + 28, bounds.size.w, 24));
  text_layer_set_font(delta_text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_background_color(delta_text, GColorClear);
  text_layer_set_text_alignment(delta_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(delta_text));

  SidebarElement* el = malloc(sizeof(SidebarElement));
  el->last_bg_text = last_bg_text;
  el->trend_layer = trend_layer;
  el->delta_text = delta_text;
  return el;
}

void sidebar_element_destroy(SidebarElement *el) {
  text_layer_destroy(el->last_bg_text);
  text_layer_destroy(el->delta_text);
  if (el->trend_bitmap != NULL) {
    gbitmap_destroy(el->trend_bitmap);
  }
  bitmap_layer_destroy(el->trend_layer);
  free(el);
}

static void update_last_bg(SidebarElement *el, DictionaryIterator *data) {
  static char last_bg_buffer[8];
  int mgdl = dict_find(data, APP_KEY_LAST_SGV)->value->int32;
  format_bg(last_bg_buffer, sizeof(last_bg_buffer), mgdl, false, USE_MMOL);
  text_layer_set_text(el->last_bg_text, last_bg_buffer);
}

static void update_trend(SidebarElement *el, DictionaryIterator *data) {
  static int last_trend = -1;
  int trend = dict_find(data, APP_KEY_TREND)->value->int32;

  if (trend == last_trend) {
    return;
  }
  last_trend = trend;

  if (TREND_ICONS[trend] == NO_ICON) {
    layer_set_hidden(bitmap_layer_get_layer(el->trend_layer), true);
  } else {
    layer_set_hidden(bitmap_layer_get_layer(el->trend_layer), false);
    if (el->trend_bitmap != NULL) {
      gbitmap_destroy(el->trend_bitmap);
    }
    el->trend_bitmap = gbitmap_create_with_resource(TREND_ICONS[trend]);
    bitmap_layer_set_bitmap(el->trend_layer, el->trend_bitmap);
  }
}

static void update_delta(SidebarElement *el, DictionaryIterator *data) {
  static char delta_buffer[8];
  int delta = dict_find(data, APP_KEY_DELTA)->value->int32;
  if (delta == NO_DELTA_VALUE) {
    text_layer_set_text(el->delta_text, "-");
  } else {
    format_bg(delta_buffer, sizeof(delta_buffer), delta, true, USE_MMOL);
    text_layer_set_text(el->delta_text, delta_buffer);
  }
}

void sidebar_element_update(SidebarElement *el, DictionaryIterator *data) {
  update_last_bg(el, data);
  update_trend(el, data);
  update_delta(el, data);
}

void sidebar_element_tick(SidebarElement *el) {}
