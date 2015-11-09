#pragma once

#include <pebble.h>

typedef struct StatusBarElement {
  TextLayer *left_text;
  TextLayer *right_text;
} StatusBarElement;

StatusBarElement* status_bar_element_create(Layer *parent);
void status_bar_element_destroy(StatusBarElement *el);
void status_bar_element_update(StatusBarElement *el, DictionaryIterator *data);
void status_bar_element_tick(StatusBarElement *el);
