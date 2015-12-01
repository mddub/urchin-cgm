#include "bg_row_element.h"
#include "layout.h"
#include "text_updates.h"

// https://forums.getpebble.com/discussion/7147/text-layer-padding
#define ACTUAL_TEXT_HEIGHT_34 24
#define PADDING_TOP_34 10
// because it's a numbers-only font
#define PADDING_BOTTOM_34 0
#define ACTUAL_TEXT_HEIGHT_28 18
#define PADDING_TOP_28 10
#define PADDING_BOTTOM_28 4

#define BG_EDGE_PADDING 2
#define BG_TREND_PADDING 4
#define TREND_DELTA_PADDING 3

static void bg_row_element_rearrange(BGRowElement *el) {
  GRect bg_frame = layer_get_frame(text_layer_get_layer(el->bg_text));
  GSize bg_size = text_layer_get_content_size(el->bg_text);

  trend_arrow_component_reposition(
    el->trend,
    bg_frame.origin.x + bg_size.w + BG_TREND_PADDING,
    (el->parent_size.h - trend_arrow_component_height()) / 2
  );

  GRect delta_frame = layer_get_frame(text_layer_get_layer(el->delta_text));
  layer_set_frame(text_layer_get_layer(el->delta_text), GRect(
    bg_frame.origin.x + bg_size.w + BG_TREND_PADDING + trend_arrow_component_width() + TREND_DELTA_PADDING,
    delta_frame.origin.y,
    delta_frame.size.w,
    delta_frame.size.h
  ));
}

BGRowElement* bg_row_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);

  TextLayer *bg_text = text_layer_create(GRect(
    BG_EDGE_PADDING,
    (bounds.size.h - ACTUAL_TEXT_HEIGHT_34) / 2 - PADDING_TOP_34,
    bounds.size.w - BG_EDGE_PADDING,
    ACTUAL_TEXT_HEIGHT_34 + PADDING_TOP_34 + PADDING_BOTTOM_34
  ));
  text_layer_set_font(bg_text, fonts_get_system_font(FONT_KEY_BITHAM_34_MEDIUM_NUMBERS));
  text_layer_set_text_alignment(bg_text, GTextAlignmentLeft);
  text_layer_set_background_color(bg_text, GColorClear);
  text_layer_set_text_color(bg_text, GColorBlack);
  layer_add_child(parent, text_layer_get_layer(bg_text));

  TrendArrowComponent *trend = trend_arrow_component_create(
    parent,
    0, // set by bg_row_element_rearrange
    (bounds.size.h - trend_arrow_component_height()) / 2
  );

  TextLayer *delta_text = text_layer_create(GRect(
    0, // set by bg_row_element_rearrange
    (bounds.size.h - ACTUAL_TEXT_HEIGHT_28) / 2 - PADDING_TOP_28,
    bounds.size.w,
    ACTUAL_TEXT_HEIGHT_28 + PADDING_TOP_28 + PADDING_BOTTOM_28
  ));
  text_layer_set_font(delta_text, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD));
  text_layer_set_text_alignment(delta_text, GTextAlignmentLeft);
  text_layer_set_background_color(delta_text, GColorClear);
  text_layer_set_text_color(delta_text, GColorBlack);
  layer_add_child(parent, text_layer_get_layer(delta_text));

  BGRowElement *el = malloc(sizeof(BGRowElement));
  el->parent_size = bounds.size;
  el->bg_text = bg_text;
  el->trend = trend;
  el->delta_text = delta_text;
  return el;
}

void bg_row_element_destroy(BGRowElement *el) {
  text_layer_destroy(el->bg_text);
  trend_arrow_component_destroy(el->trend);
  text_layer_destroy(el->delta_text);
  free(el);
}

void bg_row_element_update(BGRowElement *el, DictionaryIterator *data) {
  last_bg_text_layer_update(el->bg_text, data);
  trend_arrow_component_update(el->trend, data);
  delta_text_layer_update(el->delta_text, data);
  bg_row_element_rearrange(el);
}

void bg_row_element_tick(BGRowElement *el) {}
