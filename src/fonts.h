#pragma once

#include <pebble.h>

// https://forums.getpebble.com/discussion/7147/text-layer-padding
typedef struct FontChoice {
  const char *key;
  uint8_t height;
  unsigned int padding_top:4;
  unsigned int padding_bottom:4;
} FontChoice;

enum {
  FONT_18_BOLD,
  FONT_24_BOLD,
  FONT_28_BOLD,
  FONT_34_NUMBERS,
  FONT_42_BOLD,
};

FontChoice get_font(uint8_t font_size);
