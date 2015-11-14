#pragma once

#include <pebble.h>

typedef struct __attribute__((__packed__)) Preferences {
  bool mmol;
} Preferences;

void init_prefs();
void deinit_prefs();
Preferences* get_prefs();
void set_prefs(DictionaryIterator *data);
