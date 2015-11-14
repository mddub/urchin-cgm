#include "app_keys.h"
#include "config.h"
#include "preferences.h"

static Preferences *s_prefs = NULL;

static void save_prefs() {
  persist_write_int(PERSIST_KEY_VERSION, 1);
  persist_write_data(PERSIST_KEY_PREFERENCES_OBJECT, s_prefs, sizeof(Preferences));
}

static void set_default_prefs() {
  s_prefs->mmol = false;
  save_prefs();
}

void init_prefs() {
  s_prefs = malloc(sizeof(Preferences));
  if (persist_exists(PERSIST_KEY_PREFERENCES_OBJECT)) {
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
  save_prefs();
}
