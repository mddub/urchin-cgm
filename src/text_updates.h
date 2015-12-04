#pragma once

#include <pebble.h>

void last_bg_text_layer_update(TextLayer *text_layer, DictionaryIterator *data);
bool is_bg_special_value(DictionaryIterator *data);
void delta_text_layer_update(TextLayer *text_layer, DictionaryIterator *data);
