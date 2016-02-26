#include "app_keys.h"
#include "preferences.h"

static Preferences *s_prefs = NULL;

static void save_prefs() {
  persist_write_int(PERSIST_KEY_VERSION, PREFERENCES_SCHEMA_VERSION);
  persist_write_data(PERSIST_KEY_PREFERENCES_OBJECT, s_prefs, sizeof(Preferences));
}

static void set_empty_prefs() {
  s_prefs->num_elements = 0;
}

static int preferences_size() {
  return sizeof(Preferences);
}

void init_prefs() {
  if (preferences_size() > PERSIST_DATA_MAX_LENGTH) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Preferences data too big!");
  }
  s_prefs = malloc(preferences_size());

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

static ElementConfig decode_layout_element(uint8_t *encoded, int offset) {
  ElementConfig decoded;
  decoded.el = encoded[offset + ELEMENT_TYPE];
  decoded.w = encoded[offset + ELEMENT_WIDTH];
  decoded.h = encoded[offset + ELEMENT_HEIGHT];
  decoded.black = encoded[offset + ELEMENT_BLACK];
  decoded.bottom = encoded[offset + ELEMENT_BOTTOM];
  decoded.right = encoded[offset + ELEMENT_RIGHT];
  return decoded;
}

static void decode_layout_elements(Preferences *prefs, int num_elements, uint8_t *encoded) {
  for(int i = 0; i < num_elements; i++) {
    ElementConfig el = decode_layout_element(encoded, NUM_ELEMENT_PROPERTIES * i);
    memcpy(&prefs->elements[i], &el, sizeof(ElementConfig));
  }
}

void set_prefs(DictionaryIterator *data) {
  s_prefs->mmol = dict_find(data, APP_KEY_MMOL)->value->int32;
  s_prefs->top_of_graph = dict_find(data, APP_KEY_TOP_OF_GRAPH)->value->int32;
  s_prefs->top_of_range = dict_find(data, APP_KEY_TOP_OF_RANGE)->value->int32;
  s_prefs->bottom_of_range = dict_find(data, APP_KEY_BOTTOM_OF_RANGE)->value->int32;
  s_prefs->bottom_of_graph = dict_find(data, APP_KEY_BOTTOM_OF_GRAPH)->value->int32;
  s_prefs->h_gridlines = dict_find(data, APP_KEY_H_GRIDLINES)->value->int32;
  s_prefs->battery_as_number = dict_find(data, APP_KEY_BATTERY_AS_NUMBER)->value->int32;
  s_prefs->basal_graph = dict_find(data, APP_KEY_BASAL_GRAPH)->value->int32;
  s_prefs->basal_height = dict_find(data, APP_KEY_BASAL_HEIGHT)->value->int32;
  s_prefs->update_every_minute = dict_find(data, APP_KEY_UPDATE_EVERY_MINUTE)->value->int32;
  s_prefs->time_align = dict_find(data, APP_KEY_TIME_ALIGN)->value->int32;
  s_prefs->battery_loc = dict_find(data, APP_KEY_BATTERY_LOC)->value->int32;
  s_prefs->num_elements = dict_find(data, APP_KEY_NUM_ELEMENTS)->value->int32;

  decode_layout_elements(s_prefs, s_prefs->num_elements, dict_find(data, APP_KEY_ELEMENTS)->value->data);

  save_prefs();
}
