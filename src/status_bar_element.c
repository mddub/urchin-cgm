#include "app_keys.h"
#include "layout.h"
#include "preferences.h"
#include "staleness.h"
#include "status_bar_element.h"

// https://forums.getpebble.com/discussion/7147/text-layer-padding
#define ACTUAL_TEXT_HEIGHT_18 11
#define PADDING_TOP_18 7
#define PADDING_BOTTOM_18 3

StatusBarElement* status_bar_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);

  int sm_text_margin = 2;

  int text_y, height;
  if (bounds.size.h <= ACTUAL_TEXT_HEIGHT_18 + PADDING_TOP_18 + PADDING_BOTTOM_18) {
    // vertically center text if there is only room for one line
    text_y = (bounds.size.h - ACTUAL_TEXT_HEIGHT_18) / 2 - PADDING_TOP_18;
    height = ACTUAL_TEXT_HEIGHT_18 + PADDING_TOP_18 + PADDING_BOTTOM_18;
  } else {
    // otherwise take up all the space, with half the default padding
    text_y = -1 * PADDING_TOP_18 / 2;
    height = bounds.size.h - text_y;
  }

  TextLayer *text = text_layer_create(GRect(
    sm_text_margin,
    text_y,
    bounds.size.w - sm_text_margin,
    height
  ));
  text_layer_set_text_alignment(text, GTextAlignmentLeft);
  text_layer_set_background_color(text, GColorClear);
  text_layer_set_text_color(text, element_fg(parent));

  text_layer_set_font(text, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_overflow_mode(text, GTextOverflowModeWordWrap);
  layer_add_child(parent, text_layer_get_layer(text));

  BatteryComponent *battery = NULL;
  if (get_prefs()->battery_loc == BATTERY_LOC_STATUS_RIGHT) {
    // align the battery to the middle of the lowest line of text
    int lines = (bounds.size.h - text_y) / (ACTUAL_TEXT_HEIGHT_18 + PADDING_TOP_18);
    int battery_y = text_y + (ACTUAL_TEXT_HEIGHT_18 + PADDING_TOP_18) * (lines - 1) + PADDING_TOP_18 + ACTUAL_TEXT_HEIGHT_18 / 2 - battery_component_height() / 2 + 1;
    // ...unless that places it too close to the bottom
    if (battery_y + battery_component_height() - battery_component_vertical_padding() > bounds.size.h - sm_text_margin) {
      battery_y = bounds.size.h - battery_component_height() + battery_component_vertical_padding() - sm_text_margin;
    }

    battery = battery_component_create(parent, bounds.size.w - battery_component_width() - sm_text_margin, battery_y);
  }

  StatusBarElement *el = malloc(sizeof(StatusBarElement));
  el->text = text;
  el->battery = battery;
  return el;
}

void status_bar_element_destroy(StatusBarElement *el) {
  text_layer_destroy(el->text);
  if (el->battery != NULL) {
    battery_component_destroy(el->battery);
  }
  free(el);
}

void status_bar_element_update(StatusBarElement *el, DictionaryIterator *data) {
  text_layer_set_text(
    el->text,
    dict_find(data, APP_KEY_STATUS_TEXT)->value->cstring
  );
  status_bar_element_tick(el);
}

void status_bar_element_tick(StatusBarElement *el) {}
