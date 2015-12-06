#include "app_keys.h"
#include "preferences.h"
#include "staleness.h"
#include "text_updates.h"
#include "format.h"

void last_bg_text_layer_update(TextLayer *text_layer, DictionaryIterator *data) {
  static char last_bg_buffer[8];
  int mgdl = dict_find(data, APP_KEY_LAST_SGV)->value->int32;
  format_bg(last_bg_buffer, sizeof(last_bg_buffer), mgdl, false, get_prefs()->mmol);
  text_layer_set_text(text_layer, last_bg_buffer);
}

bool is_bg_special_value(DictionaryIterator *data) {
  int mgdl = dict_find(data, APP_KEY_LAST_SGV)->value->int32;
  return get_error_string(mgdl) != NULL;
}

void delta_text_layer_update(TextLayer *text_layer, DictionaryIterator *data) {
  static char delta_buffer[8];
  int delta;
  if (graph_staleness_padding() > 0) {
    delta = NO_DELTA_VALUE;
  } else {
    delta = dict_find(data, APP_KEY_DELTA)->value->int32;
  }

  if (delta == NO_DELTA_VALUE) {
    text_layer_set_text(text_layer, "-");
  } else {
    format_bg(delta_buffer, sizeof(delta_buffer), delta, true, get_prefs()->mmol);
    text_layer_set_text(text_layer, delta_buffer);
  }
}
