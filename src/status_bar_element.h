#pragma once

#include <pebble.h>
#include "app_messages.h"
#include "battery_component.h"
#include "recency_component.h"

typedef struct StatusBarElement {
  TextLayer *text;
  BatteryComponent *battery;
  RecencyComponent *recency;
} StatusBarElement;

StatusBarElement* status_bar_element_create(Layer *parent);
void status_bar_element_destroy(StatusBarElement *el);
void status_bar_element_update(StatusBarElement *el, DataMessage *data);
void status_bar_element_tick(StatusBarElement *el);
