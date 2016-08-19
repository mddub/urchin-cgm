#include "app_messages.h"
#include "format.h"
#include "preferences.h"
#include "staleness.h"
#include "text_updates.h"

void last_bg_text_layer_update(TextLayer *text_layer, DataMessage *data) {
  static char last_bg_buffer[8];
  format_bg(last_bg_buffer, sizeof(last_bg_buffer), data->last_sgv, false, get_prefs()->mmol);
  text_layer_set_text(text_layer, last_bg_buffer);
}

bool is_bg_special_value(DataMessage *data) {
  return get_error_string(data->last_sgv) != NULL;
}

void delta_text_layer_update(TextLayer *text_layer, DataMessage *data) {
  static char delta_buffer[8];
  int delta;
  if (graph_staleness_padding() > 0) {
    delta = NO_DELTA_VALUE;
  } else {
    delta = data->delta;
  }

  if (delta == NO_DELTA_VALUE) {
    text_layer_set_text(text_layer, "-");
  } else {
    format_bg(delta_buffer, sizeof(delta_buffer), delta, true, get_prefs()->mmol);
    text_layer_set_text(text_layer, delta_buffer);
  }
}
