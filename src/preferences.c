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
  if (sizeof(Preferences) > PERSIST_DATA_MAX_LENGTH) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Preferences data too big!");
  }
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

void set_prefs(DictionaryIterator *data) {
  s_prefs->mmol = dict_find(data, MESSAGE_KEY_mmol)->value->int32;
  s_prefs->top_of_graph = dict_find(data, MESSAGE_KEY_topOfGraph)->value->int32;
  s_prefs->top_of_range = dict_find(data, MESSAGE_KEY_topOfRange)->value->int32;
  s_prefs->bottom_of_range = dict_find(data, MESSAGE_KEY_bottomOfRange)->value->int32;
  s_prefs->bottom_of_graph = dict_find(data, MESSAGE_KEY_bottomOfGraph)->value->int32;
  s_prefs->h_gridlines = dict_find(data, MESSAGE_KEY_hGridlines)->value->int32;
  s_prefs->battery_as_number = dict_find(data, MESSAGE_KEY_batteryAsNumber)->value->int32;
  s_prefs->basal_graph = dict_find(data, MESSAGE_KEY_basalGraph)->value->int32;
  s_prefs->basal_height = dict_find(data, MESSAGE_KEY_basalHeight)->value->int32;
  s_prefs->update_every_minute = dict_find(data, MESSAGE_KEY_updateEveryMinute)->value->int32;
  s_prefs->time_align = dict_find(data, MESSAGE_KEY_timeAlign)->value->int32;
  s_prefs->battery_loc = dict_find(data, MESSAGE_KEY_batteryLoc)->value->int32;
  s_prefs->conn_status_loc = dict_find(data, MESSAGE_KEY_connStatusLoc)->value->int32;
  s_prefs->recency_loc = dict_find(data, MESSAGE_KEY_recencyLoc)->value->int32;
  s_prefs->recency_style = dict_find(data, MESSAGE_KEY_recencyStyle)->value->int32;
  s_prefs->point_shape = dict_find(data, MESSAGE_KEY_pointShape)->value->int32;
  s_prefs->point_rect_height = dict_find(data, MESSAGE_KEY_pointRectHeight)->value->int32;
  s_prefs->point_width = dict_find(data, MESSAGE_KEY_pointWidth)->value->int32;
  s_prefs->point_margin = dict_find(data, MESSAGE_KEY_pointMargin)->value->int32;
  s_prefs->point_right_margin = dict_find(data, MESSAGE_KEY_pointRightMargin)->value->int32;
  s_prefs->plot_line = dict_find(data, MESSAGE_KEY_plotLine)->value->int32;
  s_prefs->plot_line_width = dict_find(data, MESSAGE_KEY_plotLineWidth)->value->int32;
  s_prefs->plot_line_is_custom_color = dict_find(data, MESSAGE_KEY_plotLineIsCustomColor)->value->int32;
  s_prefs->status_min_recency_to_show_minutes = dict_find(data, MESSAGE_KEY_statusMinRecencyToShowMinutes)->value->int32;
  s_prefs->status_max_age_minutes = dict_find(data, MESSAGE_KEY_statusMaxAgeMinutes)->value->int32;
  s_prefs->status_recency_format = dict_find(data, MESSAGE_KEY_statusRecencyFormat)->value->int32;

  s_prefs->num_elements = dict_find(data, MESSAGE_KEY_numElements)->value->int32;
  decode_layout_elements(s_prefs, s_prefs->num_elements, dict_find(data, MESSAGE_KEY_elements)->value->data);

  decode_colors(s_prefs, dict_find(data, MESSAGE_KEY_colors)->value->data);

  save_prefs();
}
