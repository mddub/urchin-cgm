#pragma once

#include <pebble.h>

typedef struct RowElement {
  TextLayer *iob_text;
  TextLayer *data_recency_text;
} RowElement;

RowElement* row_element_create(Layer *parent);
void row_element_destroy(RowElement *el);
