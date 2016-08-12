#pragma once

#include <pebble.h>

#define GRAPH_MAX_SGV_COUNT 48
#define STATUS_BAR_MAX_LENGTH 256
#define NO_DELTA_VALUE 65536

typedef struct __attribute__((__packed__)) DataMessage {
  int32_t recency;
  uint16_t sgv_count;
  uint8_t sgvs[GRAPH_MAX_SGV_COUNT];
  int32_t last_sgv;
  int32_t trend;
  int32_t delta;
  char status_text[STATUS_BAR_MAX_LENGTH];
  uint8_t graph_extra[GRAPH_MAX_SGV_COUNT];
} DataMessage;

bool get_int32(DictionaryIterator *data, int32_t *dest, uint8_t key, bool required, int32_t fallback);
bool get_byte_array(DictionaryIterator *data, uint8_t *dest, uint8_t key, size_t max_length, bool required, uint8_t *fallback);
bool get_byte_array_length(DictionaryIterator *data, uint16_t *dest, uint16_t max_length, uint8_t key);
bool get_cstring(DictionaryIterator *data, char *dest, uint8_t key, size_t max_length, bool required, const char* fallback);
bool validate_data_message(DictionaryIterator *data, DataMessage *out);
