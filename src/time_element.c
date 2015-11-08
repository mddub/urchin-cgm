#include "time_element.h"

TimeElement* time_element_create(Layer* parent) {
  GRect bounds = layer_get_bounds(parent);
  int time_margin_r = 2;
  TextLayer* time_text = text_layer_create(GRect(0, 4, bounds.size.w - time_margin_r, bounds.size.h));
  text_layer_set_background_color(time_text, GColorClear);
  text_layer_set_font(time_text, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_text_alignment(time_text, GTextAlignmentRight);
  layer_add_child(parent, text_layer_get_layer(time_text));

  TimeElement* out = malloc(sizeof(TimeElement));
  out->time_text = time_text;
  return out;
}

void time_element_destroy(TimeElement* el) {
  text_layer_destroy(el->time_text);
  free(el);
}
