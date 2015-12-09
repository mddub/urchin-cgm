#include "app_keys.h"
#include "layout.h"
#include "preferences.h"
#include "time_element.h"

// https://forums.getpebble.com/discussion/7147/text-layer-padding
#define ACTUAL_TEXT_HEIGHT_42 30
#define PADDING_TOP_42 12
#define PADDING_BOTTOM_42 8

#include "generated/test_maybe.h"
#define TESTING_TIME_DISPLAY "11:23"

static BatteryComponent *create_battery_component(Layer *parent, unsigned int battery_loc) {
  GRect bounds = element_get_bounds(parent);
  int x = -1;
  int y = -1;
  if (get_prefs()->battery_loc == BATTERY_LOC_TIME_TOP_LEFT) {
    x = battery_component_vertical_padding();
    y = 0;
  } else if (get_prefs()->battery_loc == BATTERY_LOC_TIME_TOP_RIGHT) {
    x = bounds.size.w - battery_component_width() - battery_component_vertical_padding();
    y = 0;
  } else if (get_prefs()->battery_loc == BATTERY_LOC_TIME_BOTTOM_LEFT) {
    x = battery_component_vertical_padding();
    y = bounds.size.h - battery_component_height();
  } else if (get_prefs()->battery_loc == BATTERY_LOC_TIME_BOTTOM_RIGHT) {
    x = bounds.size.w - battery_component_width() - battery_component_vertical_padding();
    y = bounds.size.h - battery_component_height();
  }
  if (x != -1) {
    return battery_component_create(parent, x, y);
  } else {
    return NULL;
  }
}

TimeElement* time_element_create(Layer* parent) {
  GRect bounds = element_get_bounds(parent);
  const int time_margin = 2;
  TextLayer* time_text = text_layer_create(GRect(time_margin, (bounds.size.h - ACTUAL_TEXT_HEIGHT_42) / 2 - PADDING_TOP_42, bounds.size.w - 2 * time_margin, ACTUAL_TEXT_HEIGHT_42 + PADDING_TOP_42 + PADDING_BOTTOM_42));
  text_layer_set_font(time_text, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD));
  text_layer_set_background_color(time_text, GColorClear);
  text_layer_set_text_color(time_text, element_fg(parent));

  if (get_prefs()->time_align == ALIGN_LEFT) {
    text_layer_set_text_alignment(time_text, GTextAlignmentLeft);
  } else if (get_prefs()->time_align == ALIGN_CENTER) {
    text_layer_set_text_alignment(time_text, GTextAlignmentCenter);
  } else {
    text_layer_set_text_alignment(time_text, GTextAlignmentRight);
  }

  layer_add_child(parent, text_layer_get_layer(time_text));

  BatteryComponent *battery = create_battery_component(parent, get_prefs()->battery_loc);
  TimeElement* out = malloc(sizeof(TimeElement));
  out->time_text = time_text;
  out->battery = battery;
  return out;
}

void time_element_destroy(TimeElement* el) {
  text_layer_destroy(el->time_text);
  if (el->battery != NULL) {
    battery_component_destroy(el->battery);
  }
  free(el);
}

void time_element_update(TimeElement *el, DictionaryIterator *data) {}

void time_element_tick(TimeElement *el) {
  static char buffer[16];

#ifdef IS_TEST_BUILD
  strcpy(buffer, TESTING_TIME_DISPLAY);
#else
  clock_copy_time_string(buffer, 16);

  if (!clock_is_24h_style()) {
    // remove " AM" suffix
    if(buffer[4] == ' ') {
      buffer[4] = 0;
    } else {
      buffer[5] = 0;
    };
  }
#endif

  text_layer_set_text(el->time_text, buffer);
}
