#pragma once

#include <pebble.h>

#define PREFERENCES_SCHEMA_VERSION 4

typedef struct __attribute__((__packed__)) Preferences {
  bool mmol;
  uint16_t top_of_graph;
  uint16_t top_of_range;
  uint8_t bottom_of_range;
  uint8_t bottom_of_graph;
  uint8_t h_gridlines;
} Preferences;

void init_prefs();
void deinit_prefs();
Preferences* get_prefs();
void set_prefs(DictionaryIterator *data);
