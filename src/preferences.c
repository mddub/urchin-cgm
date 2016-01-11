#include "app_keys.h"
#include "preferences.h"

static Preferences *s_prefs = NULL;

static void save_prefs() {
  persist_write_int(PERSIST_KEY_VERSION, PREFERENCES_SCHEMA_VERSION);
  persist_write_data(PERSIST_KEY_PREFERENCES_OBJECT, s_prefs, sizeof(Preferences));
}

static void set_default_layout(Preferences *dest) {
  // XXX duplicate layout "a" here
  // this is temporary - need a way to request prefs from phone
  int i = 0;
  dest->elements[i++] = (ElementConfig) {
    .el = TIME_AREA_ELEMENT,
    .w = 100,
    .h = 0,
    .black = false,
    .bottom = true,
    .right = false,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = GRAPH_ELEMENT,
    .w = 75,
    .h = 52,
    .black = false,
    .bottom = true,
    .right = true,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = SIDEBAR_ELEMENT,
    .w = 25,
    .h = 52,
    .black = false,
    .bottom = true,
    .right = false,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = STATUS_BAR_ELEMENT,
    .w = 100,
    .h = 13,
    .black = false,
    .bottom = false,
    .right = false,
  };
  dest->num_elements = i;
}

static void set_default_prefs() {
  // TODO don't duplicate this here; if watch doesn't have valid prefs,
  // request from phone and don't render anything until they are received
  s_prefs->mmol = false;
  s_prefs->top_of_graph = 250;
  s_prefs->top_of_range = 200;
  s_prefs->bottom_of_range = 75;
  s_prefs->bottom_of_graph = 40;
  s_prefs->h_gridlines = 50;
  s_prefs->time_align = ALIGN_CENTER;
  s_prefs->battery_loc = BATTERY_LOC_STATUS_RIGHT;

  set_default_layout(s_prefs);

  save_prefs();
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
    set_default_prefs();
  }
}

void deinit_prefs() {
  free(s_prefs);
}

Preferences* get_prefs() {
  return s_prefs;
}

static ElementConfig decode_layout_element(const char *encoded, int offset) {
  ElementConfig decoded;
  decoded.el = encoded[offset + ELEMENT_TYPE];
  decoded.w = encoded[offset + ELEMENT_WIDTH];
  decoded.h = encoded[offset + ELEMENT_HEIGHT];
  decoded.black = encoded[offset + ELEMENT_BLACK];
  decoded.bottom = encoded[offset + ELEMENT_BOTTOM];
  decoded.right = encoded[offset + ELEMENT_RIGHT];
  return decoded;
}

static void decode_layout_elements(Preferences *prefs, int num_elements, const char * encoded) {
  for(int i = 0; i < num_elements; i++) {
    ElementConfig el = decode_layout_element(encoded, NUM_ELEMENT_PROPERTIES * i);
    memcpy(&prefs->elements[i], &el, sizeof(ElementConfig));
  }
}

void set_prefs(DictionaryIterator *data) {
  s_prefs->mmol = (bool)dict_find(data, APP_KEY_MMOL)->value->uint8;
  s_prefs->top_of_graph = dict_find(data, APP_KEY_TOP_OF_GRAPH)->value->uint16;
  s_prefs->top_of_range = dict_find(data, APP_KEY_TOP_OF_RANGE)->value->uint16;
  s_prefs->bottom_of_range = dict_find(data, APP_KEY_BOTTOM_OF_RANGE)->value->uint8;
  s_prefs->bottom_of_graph = dict_find(data, APP_KEY_BOTTOM_OF_GRAPH)->value->uint8;
  s_prefs->h_gridlines = dict_find(data, APP_KEY_H_GRIDLINES)->value->uint8;
  s_prefs->time_align = dict_find(data, APP_KEY_TIME_ALIGN)->value->uint8;
  s_prefs->battery_loc = dict_find(data, APP_KEY_BATTERY_LOC)->value->uint8;
  s_prefs->num_elements = dict_find(data, APP_KEY_NUM_ELEMENTS)->value->uint8;

  decode_layout_elements(s_prefs, s_prefs->num_elements, dict_find(data, APP_KEY_ELEMENTS)->value->cstring);

  save_prefs();
}
