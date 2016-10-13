#pragma once

#include <pebble.h>
#include "app_messages.h"

void last_bg_text_layer_update(TextLayer *text_layer, DataMessage *data);
void delta_text_layer_update(TextLayer *text_layer, DataMessage *data);
