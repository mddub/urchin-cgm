#include "app_messages.h"

// Exclude logging on Aplite
#ifndef PBL_PLATFORM_APLITE
static const char* type_name(TupleType type) {
  switch(type) {
    case TUPLE_BYTE_ARRAY:  return "byte array";
    case TUPLE_CSTRING:     return "cstring";
    case TUPLE_UINT:        return "uint";
    case TUPLE_INT:         return "int";
    default:                return "";
  }
}
#endif

static bool fail_unexpected_type(uint8_t key, TupleType type, const char* expected) {
#ifndef PBL_PLATFORM_APLITE
  APP_LOG(APP_LOG_LEVEL_ERROR, "Expected key %d to have type %s, but has type %s", (int)key, expected, type_name(type));
#endif
  return false;
}

static bool fail_missing_required_value(uint8_t key) {
#ifndef PBL_PLATFORM_APLITE
  APP_LOG(APP_LOG_LEVEL_ERROR, "Missing required value for key %d", (int)key);
#endif
  return false;
}

static bool pass_default_value(uint8_t key, const char * type) {
#ifndef PBL_PLATFORM_APLITE
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Missing %s value for key %d, assigning default", type, (int)key);
#endif
  return true;
}

bool get_int32(DictionaryIterator *data, int32_t *dest, uint8_t key, bool required, int32_t fallback) {
  Tuple *t = dict_find(data, key);
  if (t != NULL) {
    if (t->type == TUPLE_INT) {
      switch(t->length) {
        case 1:     *dest = t->value->int8;     break;
        case 2:     *dest = t->value->int16;    break;
        default:    *dest = t->value->int32;    break;
      }
      return true;
    } else if (t->type == TUPLE_UINT) {
      switch(t->length) {
        case 1:     *dest = t->value->uint8;    break;
        case 2:     *dest = t->value->uint16;   break;
        default:    *dest = t->value->uint32;   break;
      }
      return true;
    } else {
      return fail_unexpected_type(key, t->type, "int or uint");
    }
  } else {
    if (required) {
      return fail_missing_required_value(key);
    } else {
      *dest = fallback;
      return pass_default_value(key, "int32");
    }
  }
}

bool get_byte_array(DictionaryIterator *data, uint8_t *dest, uint8_t key, size_t max_length, bool required, uint8_t *fallback) {
  Tuple *t = dict_find(data, key);
  if (t != NULL) {
    if (t->type == TUPLE_BYTE_ARRAY) {
      memcpy(dest, t->value->data, (t->length < max_length ? t->length : max_length) * sizeof(uint8_t));
      return true;
    } else {
      return fail_unexpected_type(key, t->type, "byte array");
    }
  } else {
    if (required) {
      return fail_missing_required_value(key);
    } else {
      memcpy(dest, fallback, ARRAY_LENGTH(fallback));
      return pass_default_value(key, "byte array");
    }
  }
}

bool get_byte_array_length(DictionaryIterator *data, uint16_t *dest, uint16_t max_length, uint8_t key) {
  // assumes get_byte_array has already succeeded for this key
  uint16_t length = dict_find(data, key)->length;
  if (max_length == 0) {
    *dest = length;
  } else {
    *dest = length > max_length ? max_length : length;
  }
  return true;
}

bool get_cstring(DictionaryIterator *data, char *dest, uint8_t key, size_t max_length, bool required, const char* fallback) {
  Tuple *t = dict_find(data, key);
  if (t != NULL) {
    if (t->type == TUPLE_CSTRING) {
      strncpy(dest, t->value->cstring, max_length);
      return true;
    } else {
      return fail_unexpected_type(key, t->type, "cstring");
    }
  } else {
    if (required) {
      return fail_missing_required_value(key);
    } else {
      strcpy(dest, fallback);
      return pass_default_value(key, "cstring");
    }
  }
}

bool validate_data_message(DictionaryIterator *data, DataMessage *out) {
  /*
   * Validation is not necessary for messages from the PebbleKit JS half of
   * Urchin since it is distributed with the C SDK half, but other clients
   * (Pancreabble, Loop, xDrip(?)) are not guaranteed to be using exactly the
   * same message format as this version of Urchin.
   */
  static uint8_t zeroes[GRAPH_MAX_SGV_COUNT];
  memset(zeroes, 0, GRAPH_MAX_SGV_COUNT);

  out->received_at = time(NULL);

  return true
    && get_int32(data, &out->recency, MESSAGE_KEY_recency, false, 0)
    && get_byte_array(data, out->sgvs, MESSAGE_KEY_sgvs, GRAPH_MAX_SGV_COUNT, true, NULL)
    && get_byte_array_length(data, &out->sgv_count, GRAPH_MAX_SGV_COUNT, MESSAGE_KEY_sgvs)
    && get_int32(data, &out->last_sgv, MESSAGE_KEY_lastSgv, true, 0)
    && get_int32(data, &out->trend, MESSAGE_KEY_trend, false, 0)
    && get_int32(data, &out->delta, MESSAGE_KEY_delta, false, NO_DELTA_VALUE)
    && get_cstring(data, out->status_text, MESSAGE_KEY_statusText, STATUS_BAR_MAX_LENGTH, false, "")
    && get_int32(data, &out->status_recency, MESSAGE_KEY_statusRecency, false, -1)
    && get_byte_array(data, out->graph_extra, MESSAGE_KEY_graphExtra, GRAPH_MAX_SGV_COUNT, false, zeroes);
}

static DataMessage *_last_data_message = NULL;

void save_last_data_message(DataMessage *d) {
  _last_data_message = d;
}

DataMessage *last_data_message() {
  return _last_data_message;
}
