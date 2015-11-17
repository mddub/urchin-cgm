#pragma once

#include <pebble.h>

#define PREFERENCES_SCHEMA_VERSION 3

typedef struct __attribute__((__packed__)) Preferences {
  bool mmol;
  uint16_t gub;
  uint8_t glb;
  uint16_t ghl;
  uint8_t gll;
  uint16_t hgl;
} Preferences;

void init_prefs();
void deinit_prefs();
Preferences* get_prefs();
void set_prefs(DictionaryIterator *data);
