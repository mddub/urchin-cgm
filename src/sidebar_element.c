#include "fonts.h"
#include "layout.h"
#include "sidebar_element.h"
#include "text_updates.h"

SidebarElement* sidebar_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);
  FontChoice font = get_font(FONT_24_BOLD);

  int trend_arrow_y = (bounds.size.h - trend_arrow_component_height()) / 2;
  int last_bg_y = (trend_arrow_y / 4 + bounds.size.h / 8) - font.height / 2 - font.padding_top;
  int delta_y = ((bounds.size.h + trend_arrow_y + trend_arrow_component_height()) / 4 + bounds.size.h * 3 / 8) - font.height / 2 - font.padding_top;

  TextLayer *last_bg_text = text_layer_create(GRect(0, last_bg_y, bounds.size.w, font.height + font.padding_top + font.padding_bottom));
  text_layer_set_font(last_bg_text, fonts_get_system_font(font.key));
  text_layer_set_background_color(last_bg_text, GColorClear);
  text_layer_set_text_color(last_bg_text, element_fg(parent));
  text_layer_set_text_alignment(last_bg_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(last_bg_text));

  TrendArrowComponent *trend = trend_arrow_component_create(parent, (bounds.size.w - trend_arrow_component_width()) / 2, trend_arrow_y);

  TextLayer *delta_text = text_layer_create(GRect(0, delta_y, bounds.size.w, font.height + font.padding_top + font.padding_bottom));
  text_layer_set_font(delta_text, fonts_get_system_font(font.key));
  text_layer_set_background_color(delta_text, GColorClear);
  text_layer_set_text_color(delta_text, element_fg(parent));
  text_layer_set_text_alignment(delta_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(delta_text));

  SidebarElement* el = malloc(sizeof(SidebarElement));
  el->last_bg_text = last_bg_text;
  el->trend = trend;
  el->delta_text = delta_text;
  return el;
}

void sidebar_element_destroy(SidebarElement *el) {
  text_layer_destroy(el->last_bg_text);
  trend_arrow_component_destroy(el->trend);
  text_layer_destroy(el->delta_text);
  free(el);
}

void sidebar_element_update(SidebarElement *el, DictionaryIterator *data) {
  last_bg_text_layer_update(el->last_bg_text, data);
  trend_arrow_component_update(el->trend, data);
  delta_text_layer_update(el->delta_text, data);
}

void sidebar_element_tick(SidebarElement *el) {}
