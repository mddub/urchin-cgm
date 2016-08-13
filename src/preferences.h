#pragma once

#include <pebble.h>

#define PERSIST_KEY_VERSION 0
#define PERSIST_KEY_PREFERENCES_OBJECT 1

#define PREFERENCES_SCHEMA_VERSION 10

enum {
  ALIGN_LEFT,
  ALIGN_CENTER,
  ALIGN_RIGHT,
};

enum {
  BATTERY_LOC_NONE,
  BATTERY_LOC_STATUS_RIGHT,
  BATTERY_LOC_TIME_TOP_LEFT,
  BATTERY_LOC_TIME_TOP_RIGHT,
  BATTERY_LOC_TIME_BOTTOM_LEFT,
  BATTERY_LOC_TIME_BOTTOM_RIGHT,
};

enum {
  POINT_SHAPE_RECTANGLE,
  POINT_SHAPE_CIRCLE,
};

// The order here should match constants.PROPERTIES.
enum {
  ELEMENT_TYPE,
  ELEMENT_ENABLED,
  ELEMENT_WIDTH,
  ELEMENT_HEIGHT,
  ELEMENT_BLACK,
  ELEMENT_BOTTOM,
  ELEMENT_RIGHT,
  NUM_ELEMENT_PROPERTIES,
};

enum {
  GRAPH_ELEMENT,
  SIDEBAR_ELEMENT,
  STATUS_BAR_ELEMENT,
  TIME_AREA_ELEMENT,
  BG_ROW_ELEMENT,
  MAX_LAYOUT_ELEMENTS,
};

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
  unsigned int point_shape:2;
  unsigned int point_height:5;
  unsigned int point_width:5;
  int8_t point_margin;
  unsigned int point_right_margin:5;
  bool plot_line;
  unsigned int plot_line_width:4;
  unsigned int num_elements:3;
  ElementConfig elements[MAX_LAYOUT_ELEMENTS];
} Preferences;

void init_prefs();
void deinit_prefs();
Preferences* get_prefs();
void set_prefs(DictionaryIterator *data);
