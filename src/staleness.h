#pragma once

#include <pebble.h>

bool ever_had_phone_contact();
bool ever_received_data();
int phone_to_pebble_staleness();
int web_to_phone_staleness();
int rig_to_web_staleness();
int total_data_staleness();
void staleness_update(DictionaryIterator *data);
