#pragma once

#include <pebble.h>
#include "trend_arrow_component.h"

typedef struct SidebarElement {
  TextLayer *last_bg_text;
  TrendArrowComponent *trend;
  TextLayer *delta_text;
} SidebarElement;

SidebarElement* sidebar_element_create(Layer *parent);
void sidebar_element_destroy(SidebarElement *el);
void sidebar_element_update(SidebarElement *el, DictionaryIterator *data);
void sidebar_element_tick(SidebarElement *el);
