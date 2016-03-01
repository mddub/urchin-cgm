#include "bg_row_element.h"
#include "fonts.h"
#include "layout.h"
#include "text_updates.h"

#define BG_TREND_PADDING 8
#define TREND_DELTA_PADDING 5
#define MISSING_TREND_BG_DELTA_PADDING 10

static void bg_row_element_rearrange(BGRowElement *el) {
  GSize bg_size = text_layer_get_content_size(el->bg_text);
  GSize delta_size = text_layer_get_content_size(el->delta_text);
  int total_width = bg_size.w \
    + (trend_arrow_component_hidden(el->trend) ? 0 : BG_TREND_PADDING + trend_arrow_component_width()) \
    + (layer_get_hidden(text_layer_get_layer(el->delta_text)) ? 0 : TREND_DELTA_PADDING + delta_size.w);
  int bg_x = (el->parent_size.w - total_width) / 2;

  GRect bg_frame = layer_get_frame(text_layer_get_layer(el->bg_text));
  layer_set_frame(text_layer_get_layer(el->bg_text), GRect(
    bg_x,
    bg_frame.origin.y,
    bg_frame.size.w,
    bg_frame.size.h
  ));

  trend_arrow_component_reposition(
    el->trend,
    bg_x + bg_size.w + BG_TREND_PADDING,
    (el->parent_size.h - trend_arrow_component_height()) / 2
  );

  GRect delta_frame = layer_get_frame(text_layer_get_layer(el->delta_text));
  int delta_x = bg_x + bg_size.w \
    + (trend_arrow_component_hidden(el->trend) \
        ? MISSING_TREND_BG_DELTA_PADDING \
        : BG_TREND_PADDING + trend_arrow_component_width() + TREND_DELTA_PADDING);
  layer_set_frame(text_layer_get_layer(el->delta_text), GRect(
    delta_x,
    delta_frame.origin.y,
    delta_frame.size.w,
    delta_frame.size.h
  ));
}

BGRowElement* bg_row_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);

  FontChoice bg_font = get_font(FONT_34_NUMBERS);
  TextLayer *bg_text = text_layer_create(GRect(
    0,
    (bounds.size.h - bg_font.height) / 2 - bg_font.padding_top,
    bounds.size.w,
    bg_font.height + bg_font.padding_top + bg_font.padding_bottom
  ));
  text_layer_set_font(bg_text, fonts_get_system_font(bg_font.key));
  text_layer_set_text_alignment(bg_text, GTextAlignmentLeft);
  text_layer_set_background_color(bg_text, GColorClear);
  text_layer_set_text_color(bg_text, element_fg(parent));
  layer_add_child(parent, text_layer_get_layer(bg_text));

  TrendArrowComponent *trend = trend_arrow_component_create(
    parent,
    0, // set by bg_row_element_rearrange
    (bounds.size.h - trend_arrow_component_height()) / 2
  );

  FontChoice delta_font = get_font(FONT_28_BOLD);
  TextLayer *delta_text = text_layer_create(GRect(
    0, // set by bg_row_element_rearrange
    (bounds.size.h - delta_font.height) / 2 - delta_font.padding_top,
    bounds.size.w,
    delta_font.height + delta_font.padding_top + delta_font.padding_bottom
  ));
  text_layer_set_font(delta_text, fonts_get_system_font(delta_font.key));
  text_layer_set_text_alignment(delta_text, GTextAlignmentLeft);
  text_layer_set_background_color(delta_text, GColorClear);
  text_layer_set_text_color(delta_text, element_fg(parent));
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
  text_layer_set_font(
    el->bg_text,
    fonts_get_system_font(is_bg_special_value(data) ? get_font(FONT_28_BOLD).key : get_font(FONT_34_NUMBERS).key)
  );
  trend_arrow_component_update(el->trend, data);
  delta_text_layer_update(el->delta_text, data);
  layer_set_hidden(
    text_layer_get_layer(el->delta_text),
    strcmp("-", text_layer_get_text(el->delta_text)) == 0
  );
  bg_row_element_rearrange(el);
}

void bg_row_element_tick(BGRowElement *el) {}
