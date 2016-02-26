#pragma once

#include <pebble.h>
#include "config.h"

#define PREFERENCES_SCHEMA_VERSION 9

typedef struct __attribute__((__packed__)) ElementConfig {
  int el;
  int w;
  int h;
  bool black;
  bool bottom;
  bool right;
} ElementConfig;

typedef struct __attribute__((__packed__)) Preferences {
  bool mmol;
  uint16_t top_of_graph;
  uint16_t top_of_range;
  uint8_t bottom_of_range;
  uint8_t bottom_of_graph;
  uint8_t h_gridlines;
  bool battery_as_number;
  bool basal_graph;
  unsigned int basal_height:5;
  bool update_every_minute;
  unsigned int time_align:2;
  unsigned int battery_loc:3;
  unsigned int num_elements:3;
  ElementConfig elements[MAX_LAYOUT_ELEMENTS];
} Preferences;

void init_prefs();
void deinit_prefs();
Preferences* get_prefs();
void set_prefs(DictionaryIterator *data);
