#pragma once

#include <pebble.h>

typedef struct TimeElement {
  TextLayer *time_text;
} TimeElement;

TimeElement* time_element_create(Layer *parent);
void time_element_destroy(TimeElement *el);
