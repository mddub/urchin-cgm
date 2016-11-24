#include "preferences.h"

static Preferences *s_prefs = NULL;

static void save_prefs() {
  persist_write_int(PERSIST_KEY_VERSION, PREFERENCES_SCHEMA_VERSION);
  persist_write_data(PERSIST_KEY_PREFERENCES_OBJECT, s_prefs, sizeof(Preferences));
}

static void set_empty_prefs() {
  s_prefs->num_elements = 0;
}

void init_prefs() {
#ifndef PBL_APLITE
  if (sizeof(Preferences) > PERSIST_DATA_MAX_LENGTH) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Preferences data too big!");
  }
#endif
  s_prefs = malloc(sizeof(Preferences));

  if (
      persist_exists(PERSIST_KEY_VERSION) && \
      persist_exists(PERSIST_KEY_PREFERENCES_OBJECT) && \
      persist_read_int(PERSIST_KEY_VERSION) == PREFERENCES_SCHEMA_VERSION
  ) {
    persist_read_data(PERSIST_KEY_PREFERENCES_OBJECT, s_prefs, sizeof(Preferences));
  } else {
    set_empty_prefs();
  }
}

void deinit_prefs() {
  free(s_prefs);
}

Preferences* get_prefs() {
  return s_prefs;
}

static ElementConfig decode_layout_element(uint8_t *encoded, uint8_t offset) {
  ElementConfig decoded;
  decoded.el = encoded[offset + ELEMENT_TYPE];
  decoded.w = encoded[offset + ELEMENT_WIDTH];
  decoded.h = encoded[offset + ELEMENT_HEIGHT];
  decoded.black = encoded[offset + ELEMENT_BLACK];
  decoded.bottom = encoded[offset + ELEMENT_BOTTOM];
  decoded.right = encoded[offset + ELEMENT_RIGHT];
  return decoded;
}

static void decode_layout_elements(Preferences *prefs, uint8_t num_elements, uint8_t *encoded) {
  for(uint8_t i = 0; i < num_elements; i++) {
    ElementConfig el = decode_layout_element(encoded, NUM_ELEMENT_PROPERTIES * i);
    memcpy(&prefs->elements[i], &el, sizeof(ElementConfig));
  }
}

static void decode_colors(Preferences *prefs, uint8_t *values) {
  for (uint8_t i = 0; i < NUM_COLOR_KEYS; i++) {
    s_prefs->colors[i] = (GColor){.argb=(values[i])};
  }
}

static int32_t get_int32(DictionaryIterator *data, uint8_t key) {
  Tuple *t = dict_find(data, key);
  if (t == NULL) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "No pref %d", (int)key);
    return 0;
  } else {
    return t->value->int32;
  }
}

void set_prefs(DictionaryIterator *data) {
  s_prefs->mmol = get_int32(data, MESSAGE_KEY_mmol);
  s_prefs->top_of_graph = get_int32(data, MESSAGE_KEY_topOfGraph);
  s_prefs->top_of_range = get_int32(data, MESSAGE_KEY_topOfRange);
  s_prefs->bottom_of_range = get_int32(data, MESSAGE_KEY_bottomOfRange);
  s_prefs->bottom_of_graph = get_int32(data, MESSAGE_KEY_bottomOfGraph);
  s_prefs->h_gridlines = get_int32(data, MESSAGE_KEY_hGridlines);
  s_prefs->battery_as_number = get_int32(data, MESSAGE_KEY_batteryAsNumber);
  s_prefs->basal_graph = get_int32(data, MESSAGE_KEY_basalGraph);
  s_prefs->basal_height = get_int32(data, MESSAGE_KEY_basalHeight);
  s_prefs->update_every_minute = get_int32(data, MESSAGE_KEY_updateEveryMinute);
  s_prefs->time_align = get_int32(data, MESSAGE_KEY_timeAlign);
  s_prefs->battery_loc = get_int32(data, MESSAGE_KEY_batteryLoc);
  s_prefs->conn_status_loc = get_int32(data, MESSAGE_KEY_connStatusLoc);
  s_prefs->recency_loc = get_int32(data, MESSAGE_KEY_recencyLoc);
  s_prefs->recency_style = get_int32(data, MESSAGE_KEY_recencyStyle);
  s_prefs->point_shape = get_int32(data, MESSAGE_KEY_pointShape);
  s_prefs->point_rect_height = get_int32(data, MESSAGE_KEY_pointRectHeight);
  s_prefs->point_width = get_int32(data, MESSAGE_KEY_pointWidth);
  s_prefs->point_margin = get_int32(data, MESSAGE_KEY_pointMargin);
  s_prefs->point_right_margin = get_int32(data, MESSAGE_KEY_pointRightMargin);
  s_prefs->plot_line = get_int32(data, MESSAGE_KEY_plotLine);
  s_prefs->plot_line_width = get_int32(data, MESSAGE_KEY_plotLineWidth);
  s_prefs->plot_line_is_custom_color = get_int32(data, MESSAGE_KEY_plotLineIsCustomColor);
  s_prefs->status_min_recency_to_show_minutes = get_int32(data, MESSAGE_KEY_statusMinRecencyToShowMinutes);
  s_prefs->status_max_age_minutes = get_int32(data, MESSAGE_KEY_statusMaxAgeMinutes);
  s_prefs->status_recency_format = get_int32(data, MESSAGE_KEY_statusRecencyFormat);

  s_prefs->num_elements = get_int32(data, MESSAGE_KEY_numElements);
  decode_layout_elements(s_prefs, s_prefs->num_elements, dict_find(data, MESSAGE_KEY_elements)->value->data);

  decode_colors(s_prefs, dict_find(data, MESSAGE_KEY_colors)->value->data);

  save_prefs();
}
