#include "app_keys.h"
#include "config.h"
#include "preferences.h"

static Preferences *s_prefs = NULL;

static void save_prefs() {
  persist_write_int(PERSIST_KEY_VERSION, PREFERENCES_SCHEMA_VERSION);
  persist_write_data(PERSIST_KEY_PREFERENCES_OBJECT, s_prefs, sizeof(Preferences));
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
  save_prefs();
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
    set_default_prefs();
  }
}

void deinit_prefs() {
  free(s_prefs);
}

Preferences* get_prefs() {
  return s_prefs;
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
  save_prefs();
}
