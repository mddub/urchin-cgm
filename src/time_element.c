#include "layout.h"
#include "time_element.h"

// https://forums.getpebble.com/discussion/7147/text-layer-padding
#define ACTUAL_TEXT_HEIGHT_42 30
#define PADDING_TOP_42 12
#define PADDING_BOTTOM_42 8

TimeElement* time_element_create(Layer* parent) {
  GRect bounds = element_get_bounds(parent);
  const int time_margin = 2;
  TextLayer* time_text = text_layer_create(GRect(time_margin, (bounds.size.h - ACTUAL_TEXT_HEIGHT_42) / 2 - PADDING_TOP_42, bounds.size.w - 2 * time_margin, ACTUAL_TEXT_HEIGHT_42 + PADDING_TOP_42 + PADDING_BOTTOM_42));
  text_layer_set_font(time_text, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_background_color(time_text, GColorClear);
  text_layer_set_text_color(time_text, GColorBlack);
  text_layer_set_text_alignment(time_text, GTextAlignmentRight);
  layer_add_child(parent, text_layer_get_layer(time_text));

  BatteryComponent *battery = battery_component_create(parent, battery_component_vertical_padding(), bounds.size.h - battery_component_height());

  TimeElement* out = malloc(sizeof(TimeElement));
  out->time_text = time_text;
  out->battery = battery;
  return out;
}

void time_element_destroy(TimeElement* el) {
  text_layer_destroy(el->time_text);
  battery_component_destroy(el->battery);
  free(el);
}

void time_element_update(TimeElement *el, DictionaryIterator *data) {}

void time_element_tick(TimeElement *el) {
  static char time_buffer[16];

  time_t now = time(NULL);
  struct tm *time_now = localtime(&now);
  strftime(time_buffer, sizeof(time_buffer), "%l:%M", time_now);
  // Remove leading space if present
  if(time_buffer[0] == ' ') {
    memmove(time_buffer, &time_buffer[1], sizeof(time_buffer) - 1);
  };

  text_layer_set_text(el->time_text, time_buffer);
}
