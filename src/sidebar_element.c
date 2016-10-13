#include "fonts.h"
#include "layout.h"
#include "sidebar_element.h"
#include "text_updates.h"

SidebarElement* sidebar_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);
  FontChoice font = get_font(FONT_24_BOLD);

  int16_t trend_arrow_y = (bounds.size.h - trend_arrow_component_height()) / 2;
  int16_t last_bg_y = (trend_arrow_y / 4 + bounds.size.h / 8) - font.height / 2 - font.padding_top;
  int16_t delta_y = ((bounds.size.h + trend_arrow_y + trend_arrow_component_height()) / 4 + bounds.size.h * 3 / 8) - font.height / 2 - font.padding_top;

  TextLayer *last_bg_text = add_text_layer(
    parent,
    GRect(0, last_bg_y, bounds.size.w, font.height + font.padding_top + font.padding_bottom),
    fonts_get_system_font(font.key),
    element_fg(parent),
    GTextAlignmentCenter
  );

  TrendArrowComponent *trend = trend_arrow_component_create(parent, (bounds.size.w - trend_arrow_component_width()) / 2, trend_arrow_y);

  TextLayer *delta_text = add_text_layer(
    parent,
    GRect(0, delta_y, bounds.size.w, font.height + font.padding_top + font.padding_bottom),
    fonts_get_system_font(font.key),
    element_fg(parent),
    GTextAlignmentCenter
  );

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

void sidebar_element_update(SidebarElement *el, DataMessage *data) {
  last_bg_text_layer_update(el->last_bg_text, data);
  trend_arrow_component_update(el->trend, data);
  delta_text_layer_update(el->delta_text, data);
}

void sidebar_element_tick(SidebarElement *el) {}
