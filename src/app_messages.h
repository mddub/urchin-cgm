#pragma once

#include <pebble.h>

#define GRAPH_MAX_SGV_COUNT 144
#define STATUS_BAR_MAX_LENGTH 256
#define PREDICTION_MAX_LENGTH 60
#define NO_DELTA_VALUE 65536

typedef union GraphExtra {
  uint8_t raw;
  struct {
    uint8_t bolus:1;
    uint8_t basal:5;
    uint8_t _unused:2;
  };
} GraphExtra;

typedef struct __attribute__((__packed__)) DataMessage {
  time_t received_at;
  int32_t recency;
  uint16_t sgv_count;
  uint8_t sgvs[GRAPH_MAX_SGV_COUNT];
  int32_t last_sgv;
  int32_t trend;
  int32_t delta;
  char status_text[STATUS_BAR_MAX_LENGTH];
  int32_t status_recency;
  GraphExtra graph_extra[GRAPH_MAX_SGV_COUNT];
  uint8_t prediction_length;
  uint8_t prediction_1[PREDICTION_MAX_LENGTH];
  uint8_t prediction_2[PREDICTION_MAX_LENGTH];
  uint8_t prediction_3[PREDICTION_MAX_LENGTH];
  int32_t prediction_recency;
} DataMessage;

bool get_int32(DictionaryIterator *data, int32_t *dest, uint8_t key, bool required, int32_t fallback);
bool get_byte_array(DictionaryIterator *data, uint8_t *dest, uint8_t key, size_t max_length, bool required, uint8_t *fallback);
bool get_byte_array_length(DictionaryIterator *data, uint16_t *dest, uint16_t max_length, uint8_t key);
bool get_cstring(DictionaryIterator *data, char *dest, uint8_t key, size_t max_length, bool required, const char* fallback);
bool validate_data_message(DictionaryIterator *data, DataMessage *out);

void save_last_data_message(DataMessage *d);
DataMessage *last_data_message();
