#pragma once

#include <pebble.h>
#include "battery_component.h"

typedef struct StatusBarElement {
  TextLayer *text;
  BatteryComponent *battery;
} StatusBarElement;

StatusBarElement* status_bar_element_create(Layer *parent);
void status_bar_element_destroy(StatusBarElement *el);
void status_bar_element_update(StatusBarElement *el, DictionaryIterator *data);
void status_bar_element_tick(StatusBarElement *el);
