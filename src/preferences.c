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
  s_prefs->gub = 300;
  s_prefs->glb = 40;
  s_prefs->ghl = 200;
  s_prefs->gll = 70;
  s_prefs->hgl = 50;
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
  s_prefs->gub = dict_find(data, APP_KEY_GUB)->value->uint16;
  s_prefs->glb = dict_find(data, APP_KEY_GLB)->value->uint16;
  s_prefs->ghl = dict_find(data, APP_KEY_GHL)->value->uint16;
  s_prefs->gll = dict_find(data, APP_KEY_GLL)->value->uint16;
  s_prefs->hgl = dict_find(data, APP_KEY_HGL)->value->uint16;
  save_prefs();
}
