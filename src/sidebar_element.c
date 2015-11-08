#include "sidebar_element.h"

SidebarElement* sidebar_element_create(Layer *parent) {
  GRect bounds = layer_get_bounds(parent);

  TextLayer *last_bg_text = text_layer_create(GRect(0, 3, bounds.size.w, 24));
  text_layer_set_font(last_bg_text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_background_color(last_bg_text, GColorClear);
  text_layer_set_text_alignment(last_bg_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(last_bg_text));

  int trend_arrow_width = 25;
  BitmapLayer *trend_layer = bitmap_layer_create(GRect((bounds.size.w - trend_arrow_width) / 2, 3 + 28, trend_arrow_width, trend_arrow_width));
  layer_add_child(parent, bitmap_layer_get_layer(trend_layer));

  TextLayer *delta_text = text_layer_create(GRect(0, 3 + 22 + 28, bounds.size.w, 24));
  text_layer_set_font(delta_text, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD));
  text_layer_set_background_color(delta_text, GColorClear);
  text_layer_set_text_alignment(delta_text, GTextAlignmentCenter);
  layer_add_child(parent, text_layer_get_layer(delta_text));

  SidebarElement* el = malloc(sizeof(SidebarElement));
  el->last_bg_text = last_bg_text;
  el->trend_layer = trend_layer;
  el->delta_text = delta_text;
  return el;
}

void sidebar_element_destroy(SidebarElement *el) {
  text_layer_destroy(el->last_bg_text);
  text_layer_destroy(el->delta_text);
  if (el->trend_bitmap != NULL) {
    gbitmap_destroy(el->trend_bitmap);
  }
  bitmap_layer_destroy(el->trend_layer);
  free(el);
}
