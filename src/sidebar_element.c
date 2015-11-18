#include "app_keys.h"
#include "config.h"
#include "layout.h"
#include "preferences.h"
#include "sidebar_element.h"
#include "staleness.h"
#include "units.h"

#define TREND_ARROW_WIDTH 25

// https://forums.getpebble.com/discussion/7147/text-layer-padding
#define ACTUAL_TEXT_HEIGHT_24 14
#define PADDING_TOP_24 10
#define PADDING_BOTTOM_24 4

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
  GRect bounds = element_get_bounds(parent);

  int trend_arrow_y = (bounds.size.h - TREND_ARROW_WIDTH) / 2;
  int last_bg_y = (trend_arrow_y / 4 + bounds.size.h / 8) - ACTUAL_TEXT_HEIGHT_24 / 2 - PADDING_TOP_24;
  int delta_y = ((bounds.size.h + trend_arrow_y + TREND_ARROW_WIDTH) / 4 + bounds.size.h * 3 / 8) - ACTUAL_TEXT_HEIGHT_24 / 2 - PADDING_TOP_24;

  TextLayer *last_bg_text = text_layer_create(GRect(0, last_bg_y, bounds.size.w, ACTUAL_TEXT_HEIGHT_24 + PADDING_TOP_24 + PADDING_BOTTOM_24));
  text_layer_set_font(last_bg_text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_background_color(last_bg_text, GColorClear);
  text_layer_set_text_alignment(last_bg_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(last_bg_text));

  BitmapLayer *trend_layer = bitmap_layer_create(GRect((bounds.size.w - TREND_ARROW_WIDTH) / 2, trend_arrow_y, TREND_ARROW_WIDTH, TREND_ARROW_WIDTH));
  bitmap_layer_set_compositing_mode(trend_layer, GCompOpAnd);
  layer_add_child(parent, bitmap_layer_get_layer(trend_layer));

  TextLayer *delta_text = text_layer_create(GRect(0, delta_y, bounds.size.w, ACTUAL_TEXT_HEIGHT_24 + PADDING_TOP_24 + PADDING_BOTTOM_24));
  text_layer_set_font(delta_text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_background_color(delta_text, GColorClear);
  text_layer_set_text_alignment(delta_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(delta_text));

  SidebarElement* el = malloc(sizeof(SidebarElement));
  el->last_bg_text = last_bg_text;
  el->trend_layer = trend_layer;
  el->trend_bitmap = NULL;
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
  format_bg(last_bg_buffer, sizeof(last_bg_buffer), mgdl, false, get_prefs()->mmol);
  text_layer_set_text(el->last_bg_text, last_bg_buffer);
}

static void update_trend(SidebarElement *el, DictionaryIterator *data) {
  static int last_trend = -1;

  if (graph_staleness_padding() > 0) {
    last_trend = -1;
    layer_set_hidden(bitmap_layer_get_layer(el->trend_layer), true);
    return;
  }

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
  int delta;
  if (graph_staleness_padding() > 0) {
    delta = NO_DELTA_VALUE;
  } else {
    delta = dict_find(data, APP_KEY_DELTA)->value->int32;
  }

  if (delta == NO_DELTA_VALUE) {
    text_layer_set_text(el->delta_text, "-");
  } else {
    format_bg(delta_buffer, sizeof(delta_buffer), delta, true, get_prefs()->mmol);
    text_layer_set_text(el->delta_text, delta_buffer);
  }
}

void sidebar_element_update(SidebarElement *el, DictionaryIterator *data) {
  update_last_bg(el, data);
  update_trend(el, data);
  update_delta(el, data);
}

void sidebar_element_tick(SidebarElement *el) {}
