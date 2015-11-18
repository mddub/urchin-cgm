#pragma once

#include <pebble.h>
#include "battery_component.h"

typedef struct TimeElement {
  TextLayer *time_text;
  BatteryComponent *battery;
} TimeElement;

TimeElement* time_element_create(Layer *parent);
void time_element_destroy(TimeElement *el);
void time_element_update(TimeElement *el, DictionaryIterator *data);
void time_element_tick(TimeElement *el);
