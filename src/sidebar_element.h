#pragma once

#include <pebble.h>

#define NO_ICON -1

typedef struct SidebarElement {
  TextLayer *last_bg_text;
  GBitmap *trend_bitmap;
  BitmapLayer *trend_layer;
  TextLayer *delta_text;
} SidebarElement;

SidebarElement* sidebar_element_create(Layer *parent);
void sidebar_element_destroy(SidebarElement *el);
void sidebar_element_update(SidebarElement *el, DictionaryIterator *data);
void sidebar_element_tick(SidebarElement *el);
