#include "fonts.h"
#include "format.h"
#include "layout.h"
#include "preferences.h"
#include "staleness.h"
#include "status_bar_element.h"

#define SM_TEXT_MARGIN (2)

StatusBarElement* status_bar_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);

  FontChoice font = get_font(FONT_28_BOLD);

  int16_t text_y, height;
  if (bounds.size.h <= font.height * 2 + font.padding_top + font.padding_bottom) {
    // vertically center text if there is only room for one line
    text_y = (bounds.size.h - font.height) / 2 - font.padding_top;
    height = font.height + font.padding_top + font.padding_bottom;
  } else {
    // otherwise take up all the space, with half the default padding
    text_y = -1 * font.padding_top / 2;
    height = bounds.size.h - text_y;
  }

  StatusBarElement *el = malloc(sizeof(StatusBarElement));

  el->text = add_text_layer(
    parent,
    GRect(
      SM_TEXT_MARGIN,
      text_y,
      bounds.size.w - SM_TEXT_MARGIN,
      height
    ),
    fonts_get_system_font(font.key),
    element_fg(parent),
    GTextAlignmentLeft
  );
  text_layer_set_overflow_mode(el->text, GTextOverflowModeWordWrap);

  int8_t lines;

  el->battery = NULL;
  if (get_prefs()->battery_loc == BATTERY_LOC_STATUS_RIGHT) {
    // align the battery to the middle of the lowest line of text
    lines = (bounds.size.h - text_y) / (font.height + font.padding_top);
    int8_t battery_y = text_y + (font.height + font.padding_top) * (lines - 1) + font.padding_top + font.height / 2 - battery_component_height() / 2;
    // ...unless that places it too close to the bottom
    if (battery_y + battery_component_height() - battery_component_vertical_padding() > bounds.size.h - SM_TEXT_MARGIN) {
      battery_y = bounds.size.h - battery_component_height() + battery_component_vertical_padding() - SM_TEXT_MARGIN;
    }

    el->battery = battery_component_create(parent, bounds.size.w - battery_component_width() - SM_TEXT_MARGIN, battery_y, true);
  }

  el->recency = NULL;
  if (get_prefs()->recency_loc == RECENCY_LOC_STATUS_TOP_RIGHT || get_prefs()->recency_loc == RECENCY_LOC_STATUS_BOTTOM_RIGHT) {
    if (get_prefs()->recency_loc == RECENCY_LOC_STATUS_TOP_RIGHT) {
      lines = 1;
    } else {
      lines = (bounds.size.h - text_y) / (font.height + font.padding_top);
    }
    // vertically align with the center of the first/last line of text
    int16_t recency_y = text_y + (font.height + font.padding_top) * (lines - 1) + font.padding_top + font.height / 2 - recency_component_height() / 2;
    // keep it within the bounds
    if (recency_y + recency_component_padding() < 0) {
      recency_y = -recency_component_padding();
    } else if (recency_y + recency_component_height() > bounds.size.h) {
      recency_y = bounds.size.h - recency_component_height() + recency_component_padding();
    }

    el->recency = recency_component_create(parent, recency_y, true, NULL, NULL);
  }

  return el;
}

void status_bar_element_destroy(StatusBarElement *el) {
  text_layer_destroy(el->text);
  if (el->battery != NULL) {
    battery_component_destroy(el->battery);
  }
  if (el->recency != NULL) {
    recency_component_destroy(el->recency);
  }
  free(el);
}

void status_bar_element_update(StatusBarElement *el, DataMessage *data) {
  status_bar_element_tick(el);
}

void status_bar_element_tick(StatusBarElement *el) {
  if (last_data_message() == NULL) {
    return;
  }
  static char buffer[STATUS_BAR_MAX_LENGTH + 16];
  format_status_bar_text(buffer, sizeof(buffer), last_data_message());
  text_layer_set_text(el->text, buffer);

  if (el->recency != NULL) {
    recency_component_tick(el->recency);
  }
}
