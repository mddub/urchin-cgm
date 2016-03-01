#include "fonts.h"

FontChoice get_font(uint8_t font_size) {
  switch(font_size) {

    case FONT_18_BOLD:
      return (FontChoice) {
        .key = FONT_KEY_GOTHIC_18_BOLD,
        .height = 11,
        .padding_top = 7,
        .padding_bottom = 3,
      };

    case FONT_24_BOLD:
      return (FontChoice) {
        .key = FONT_KEY_GOTHIC_24_BOLD,
        .height = 14,
        .padding_top = 10,
        .padding_bottom = 4,
      };

    case FONT_28_BOLD:
      return (FontChoice) {
        .key = FONT_KEY_GOTHIC_28_BOLD,
        .height = 18,
        .padding_top = 10,
        .padding_bottom = 4,
      };

    case FONT_34_NUMBERS:
      return (FontChoice) {
        .key = FONT_KEY_BITHAM_34_MEDIUM_NUMBERS,
        .height = 24,
        .padding_top = 10,
        .padding_bottom = 0,
      };

    case FONT_42_BOLD:
      return (FontChoice) {
        .key = FONT_KEY_BITHAM_42_BOLD,
        .height = 30,
        .padding_top = 12,
        .padding_bottom = 8,
      };

    default:
      return (FontChoice) {
        .key = FONT_KEY_GOTHIC_24_BOLD,
        .height = 14,
        .padding_top = 10,
        .padding_bottom = 4,
      };

  }
}
