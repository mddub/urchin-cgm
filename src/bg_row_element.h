#pragma once

#include <pebble.h>
#include "trend_arrow_component.h"

typedef struct BGRowElement {
  GSize parent_size;
  TextLayer *bg_text;
  TrendArrowComponent *trend;
  TextLayer *delta_text;
} BGRowElement;

BGRowElement* bg_row_element_create(Layer *parent);
void bg_row_element_destroy(BGRowElement *el);
void bg_row_element_update(BGRowElement *el, DictionaryIterator *data);
void bg_row_element_tick(BGRowElement *el);
