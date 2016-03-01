#pragma once

#include <pebble.h>

// https://forums.getpebble.com/discussion/7147/text-layer-padding
typedef struct FontChoice {
  const char *key;
  uint8_t height;
  uint8_t padding_top;
  uint8_t padding_bottom;
} FontChoice;

enum {
  FONT_18_BOLD,
  FONT_24_BOLD,
  FONT_28_BOLD,
  FONT_34_NUMBERS,
  FONT_42_BOLD,
};

FontChoice get_font(uint8_t font_size);
